import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dual-path guard for the ingest endpoint.
 *
 * Path 1 — API Key:
 *   Header: X-Api-Key: <INGEST_API_KEY env var>
 *   Sets req.user = { source: 'api-key' }
 *
 * Path 2 — Superadmin JWT:
 *   Header: Authorization: Bearer <JWT with isSuperadmin=true>
 *   Validates JWT, checks user.isActive + user.isSuperadmin in DB.
 *   Sets req.user = { userId, isSuperadmin: true }
 *
 * Throws 401 if neither path succeeds.
 */
@Injectable()
export class ApiKeyOrSuperadminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // ── Path 1: API Key ────────────────────────────────────────────────────
    const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
    const expectedKey = this.config.get<string>('INGEST_API_KEY', '');

    if (apiKeyHeader && expectedKey && apiKeyHeader === expectedKey) {
      // Attach synthetic user object so downstream handlers can identify source
      (req as any).user = { source: 'api-key' };
      return true;
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
      return true;
    }

    throw new UnauthorizedException(
      'Provide X-Api-Key header or a superadmin Bearer token',
    );
  }
}
