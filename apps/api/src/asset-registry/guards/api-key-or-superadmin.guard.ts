import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dual-path guard for the ingest endpoint.
 *
 * Path 1 — API Key (with rotation support):
 *   Header: X-Api-Key: <value>
 *   Accepts INGEST_API_KEY_CURRENT or INGEST_API_KEY_NEXT (zero-downtime rotation).
 *   For backwards-compat also accepts INGEST_API_KEY (legacy single-key env var).
 *   Sets req.user = { source: 'api-key' }
 *
 * Path 2 — Superadmin JWT:
 *   Header: Authorization: Bearer <JWT with isSuperadmin=true>
 *   Validates JWT, checks user.isActive + user.isSuperadmin in DB.
 *   Sets req.user = { userId, isSuperadmin: true }
 *
 * Rate Limit (per IP):
 *   Max INGEST_RATE_LIMIT_MAX (default: 60) requests per
 *   INGEST_RATE_LIMIT_WINDOW_MS (default: 60_000 ms) window.
 *
 * Logging:
 *   Structured log on each ingest attempt: { sourceType, sourceRef, ip, authPath }
 *   Never logs file URLs.
 *
 * Throws 401 if neither path succeeds, 429 if rate limit exceeded.
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class ApiKeyOrSuperadminGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyOrSuperadminGuard.name);

  /** In-memory rate-limit buckets: ip → { count, resetAt } */
  private readonly rateBuckets = new Map<string, RateBucket>();

  private readonly rateLimitMax: number;
  private readonly rateLimitWindowMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.rateLimitMax = Number(
      this.config.get<string>('INGEST_RATE_LIMIT_MAX', '60'),
    );
    this.rateLimitWindowMs = Number(
      this.config.get<string>('INGEST_RATE_LIMIT_WINDOW_MS', '60000'),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(req);

    // ── Rate limit check ──────────────────────────────────────────────────
    this.checkRateLimit(ip);

    // ── Path 1: API Key (dual-key rotation) ───────────────────────────────
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

    if (apiKeyHeader) {
      const validKeys = this.getValidApiKeys();

      if (validKeys.length > 0 && validKeys.includes(apiKeyHeader)) {
        (req as any).user = { source: 'api-key' };

        this.logger.log({
          message: 'Ingest authorized via API key',
          authPath: 'api-key',
          ip,
          sourceType: (req.body as any)?.sourceType,
          sourceRef: (req.body as any)?.ingestionId ?? null,
        });

        return true;
      }

      // Key provided but did not match → deny immediately (don't fall through)
      throw new UnauthorizedException('Invalid API key');
    }

    // ── Path 2: Superadmin JWT ─────────────────────────────────────────────
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      let payload: any;
      try {
        payload = this.jwt.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, isSuperadmin: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      if (!user.isSuperadmin) {
        throw new UnauthorizedException('Superadmin access required');
      }

      (req as any).user = { userId: user.id, isSuperadmin: true };

      this.logger.log({
        message: 'Ingest authorized via superadmin JWT',
        authPath: 'superadmin-jwt',
        userId: user.id,
        ip,
        sourceType: (req.body as any)?.sourceType,
        sourceRef: (req.body as any)?.ingestionId ?? null,
      });

      return true;
    }

    throw new UnauthorizedException(
      'Provide X-Api-Key header or a superadmin Bearer token',
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  /**
   * Returns the list of currently valid API keys.
   * Supports dual-key rotation:
   *   INGEST_API_KEY_CURRENT  (primary)
   *   INGEST_API_KEY_NEXT     (rotation candidate — active during key rotation window)
   *   INGEST_API_KEY          (legacy single-key, backwards-compat)
   */
  private getValidApiKeys(): string[] {
    const keys: string[] = [];
    const current = this.config.get<string>('INGEST_API_KEY_CURRENT', '');
    const next = this.config.get<string>('INGEST_API_KEY_NEXT', '');
    // Legacy single-key fallback
    const legacy = this.config.get<string>('INGEST_API_KEY', '');

    if (current) keys.push(current);
    if (next) keys.push(next);
    if (legacy && !keys.includes(legacy)) keys.push(legacy);

    return keys;
  }

  /**
   * Simple sliding-window rate limiter (in-memory, per-IP).
   * Throws TooManyRequestsException if limit exceeded.
   */
  private checkRateLimit(ip: string): void {
    const now = Date.now();
    let bucket = this.rateBuckets.get(ip);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 1, resetAt: now + this.rateLimitWindowMs };
      this.rateBuckets.set(ip, bucket);
      return;
    }

    bucket.count++;
    if (bucket.count > this.rateLimitMax) {
      this.logger.warn({
        message: 'Ingest rate limit exceeded',
        ip,
        count: bucket.count,
        limit: this.rateLimitMax,
      });
      throw new HttpException('Rate limit exceeded for ingest endpoint', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Extract real client IP, respecting X-Forwarded-For if behind a proxy */
  private getClientIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const first = Array.isArray(xff) ? xff[0] : xff.split(',')[0];
      return first.trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }
}
