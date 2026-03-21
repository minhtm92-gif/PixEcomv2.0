import { HttpException, Injectable, Logger } from '@nestjs/common';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Meta Business API rate limit: 200 calls per hour per ad account.
 * Reference: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
 */
const MAX_CALLS_PER_HOUR = 200;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms

// ─── Types ────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms when the window resets
}

// ─── MetaRateLimiter ──────────────────────────────────────────────────────────

/**
 * In-memory per-ad-account rate limiter.
 * Matches the Meta Business API limit: 200 calls/hour/ad-account.
 *
 * Pattern mirrors OrdersExportService rate limiter:
 * Map<adAccountExternalId, entry> — no external dependency.
 */
@Injectable()
export class MetaRateLimiter {
  private readonly logger = new Logger(MetaRateLimiter.name);
  private readonly store = new Map<string, RateLimitEntry>();

  /**
   * Check whether the given ad account is within its rate limit.
   * Increments the counter if allowed; throws 429 if at limit.
   *
   * @param adAccountExternalId  The Meta ad account ID (e.g. "act_123456789")
   */
  checkLimit(adAccountExternalId: string): void {
    const now = Date.now();
    const entry = this.store.get(adAccountExternalId);

    if (!entry || now >= entry.resetAt) {
      // First call or window has expired — start fresh
      this.store.set(adAccountExternalId, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return;
    }

    if (entry.count >= MAX_CALLS_PER_HOUR) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      this.logger.warn(
        `Rate limit exceeded for ad account ${adAccountExternalId}. ` +
          `Retry after ${retryAfterSec}s`,
      );
      throw new HttpException(
        {
          message: `Meta API rate limit exceeded for this ad account. Retry after ${retryAfterSec}s.`,
          retryAfter: retryAfterSec,
        },
        429,
      );
    }

    // Increment counter
    entry.count++;
  }

  /**
   * Returns the current rate limit state for an ad account.
   * Useful for monitoring/debugging.
   */
  getStatus(adAccountExternalId: string): {
    remaining: number;
    resetAt: number | null;
  } {
    const now = Date.now();
    const entry = this.store.get(adAccountExternalId);

    if (!entry || now >= entry.resetAt) {
      return { remaining: MAX_CALLS_PER_HOUR, resetAt: null };
    }

    return {
      remaining: Math.max(0, MAX_CALLS_PER_HOUR - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * Reset the counter for an ad account (test helper / admin use).
   */
  reset(adAccountExternalId: string): void {
    this.store.delete(adAccountExternalId);
  }
}
