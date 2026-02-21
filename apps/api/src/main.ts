import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown hooks (handles SIGTERM from Railway/Docker)
  app.enableShutdownHooks();

  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const rawOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  const allowedOrigins = rawOrigin.split(",").map((o) => o.trim());
  const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;
  app.enableCors({
    origin: corsOrigin,
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
