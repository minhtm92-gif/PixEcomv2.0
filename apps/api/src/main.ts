import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

// ─── Dynamic CORS for custom domains ────────────────────────────────────────
// Platform origins are always allowed. Custom seller domains (from DB) are
// cached in-memory for 5 minutes so we don't query on every request.

const domainCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function isVerifiedDomain(
  prisma: PrismaService,
  hostname: string,
): Promise<boolean> {
  const cached = domainCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;

  try {
    const domain = await prisma.sellerDomain.findFirst({
      where: { hostname, status: "VERIFIED" },
      select: { id: true },
    });
    const allowed = !!domain;
    domainCache.set(hostname, { allowed, expiresAt: Date.now() + CACHE_TTL });
    return allowed;
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable rawBody for Stripe webhook signature verification
    rawBody: true,
  });

  // Reuse the NestJS-managed PrismaService for CORS domain validation
  // (avoids creating a separate PrismaClient that wastes a DB connection)
  const prisma = app.get(PrismaService);

  // Graceful shutdown hooks (handles SIGTERM from Railway/Docker)
  app.enableShutdownHooks();

  // Security headers (Helmet) — disable CSP since frontend is served separately
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Platform origins (always allowed)
  const rawOrigin = process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000";
  const platformOrigins = new Set(rawOrigin.split(",").map((o) => o.trim()));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, etc.)
      if (!origin) return callback(null, true);

      // Platform origins — always allowed
      if (platformOrigins.has(origin)) return callback(null, true);

      // Custom domain check: extract hostname from origin (https://jal2.com → jal2.com)
      try {
        const hostname = new URL(origin).hostname;
        isVerifiedDomain(prisma, hostname).then((allowed) => {
          callback(null, allowed ? origin : false);
        });
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  // Keep connections alive longer than Railway's 60s idle timeout to prevent
  // mid-request drops that surface as 503s
  app.getHttpServer().keepAliveTimeout = 65000;

  console.log(`PixEcom API running on port ${port} [${process.env.NODE_ENV}]`);
}

bootstrap();
