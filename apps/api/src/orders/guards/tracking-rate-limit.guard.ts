import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../../auth/strategies/jwt.strategy';

/**
 * TrackingRateLimitGuard
 *
 * Limits POST /orders/:id/refresh-tracking to 5 requests per 60 seconds per seller.
 * Uses an in-memory sliding window — no external package required.
 *
 * Must run AFTER JwtAuthGuard so that request.user is populated.
 *
 * On limit exceeded → throws HttpException(429 Too Many Requests).
 */
@Injectable()
export class TrackingRateLimitGuard implements CanActivate {
  private static readonly MAX_REQUESTS = 5;
  private static readonly WINDOW_MS = 60_000; // 60 seconds

  /** sellerId → { count, windowStart } */
  private readonly store = new Map<
    string,
    { count: number; windowStart: number }
  >();

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const sellerId = request.user.sellerId;
    const now = Date.now();

    const entry = this.store.get(sellerId);

    // No existing entry or window has expired — start fresh
    if (!entry || now - entry.windowStart > TrackingRateLimitGuard.WINDOW_MS) {
      this.store.set(sellerId, { count: 1, windowStart: now });
      return true;
    }

    // Within window — check limit
    if (entry.count >= TrackingRateLimitGuard.MAX_REQUESTS) {
      throw new HttpException(
        'Tracking refresh rate limit exceeded: 5 requests per 60 seconds',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
