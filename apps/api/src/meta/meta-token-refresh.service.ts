import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MetaTokenService } from './meta-token.service';
import { MetaLongLivedTokenResponse } from './meta.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v22.0';

/**
 * How often the refresh loop runs: every 6 hours.
 * This gives us multiple attempts per day to catch expiring tokens.
 */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * How far ahead to look: refresh tokens expiring within 7 days.
 * Long-lived tokens last 60 days, so refreshing at 53 days gives
 * plenty of margin.
 */
const EXPIRY_WINDOW_DAYS = 7;

/**
 * Maximum connections to refresh per cycle to avoid overwhelming Meta API.
 */
const BATCH_SIZE = 50;

/**
 * Delay between individual token refresh requests (ms) to respect rate limits.
 */
const PER_TOKEN_DELAY_MS = 2_000;

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Background service that periodically refreshes Meta long-lived tokens
 * before they expire.
 *
 * Runs every 6 hours. Finds all active FbConnections whose token_expires_at
 * falls within the next 7 days and re-exchanges them for fresh 60-day tokens.
 *
 * This service uses a simple setInterval approach rather than @nestjs/schedule
 * to avoid adding an external dependency.
 */
@Injectable()
export class MetaTokenRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetaTokenRefreshService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokenService: MetaTokenService,
  ) {}

  onModuleInit() {
    // Start the refresh loop.
    // Run an initial check 30 seconds after startup, then every REFRESH_INTERVAL_MS.
    const startupDelay = 30_000;

    setTimeout(() => {
      this.refreshExpiringTokens().catch((err) =>
        this.logger.error('Initial token refresh failed', err),
      );
    }, startupDelay);

    this.intervalHandle = setInterval(() => {
      this.refreshExpiringTokens().catch((err) =>
        this.logger.error('Scheduled token refresh failed', err),
      );
    }, REFRESH_INTERVAL_MS);

    this.logger.log(
      `Token refresh scheduled: every ${REFRESH_INTERVAL_MS / 3_600_000}h, ` +
        `looking ${EXPIRY_WINDOW_DAYS} days ahead`,
    );
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  // ── Core logic ────────────────────────────────────────────────────────────

  /**
   * Find and refresh all tokens expiring within EXPIRY_WINDOW_DAYS.
   *
   * Groups connections by seller + externalId of the user-level token
   * (stored in metadata.fbUserId) so that we only exchange each unique
   * token once, then fan out the update to all connections using it.
   */
  async refreshExpiringTokens(): Promise<void> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      this.logger.warn(
        'META_APP_ID / META_APP_SECRET not configured — skipping token refresh',
      );
      return;
    }

    const cutoff = new Date(
      Date.now() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // Find connections with tokens expiring soon
    const expiring = await this.prisma.fbConnection.findMany({
      where: {
        isActive: true,
        accessTokenEnc: { not: null },
        tokenExpiresAt: {
          not: null,
          lte: cutoff,
        },
      },
      select: {
        id: true,
        sellerId: true,
        accessTokenEnc: true,
        tokenExpiresAt: true,
        connectionType: true,
        externalId: true,
      },
      take: BATCH_SIZE,
      orderBy: { tokenExpiresAt: 'asc' }, // most urgent first
    });

    if (expiring.length === 0) {
      this.logger.debug('No tokens expiring soon — nothing to refresh');
      return;
    }

    this.logger.log(
      `Found ${expiring.length} connection(s) with tokens expiring before ${cutoff.toISOString()}`,
    );

    // Group by encrypted token to avoid refreshing the same underlying token
    // multiple times (e.g., same user token shared across AD_ACCOUNT + PAGE + PIXEL).
    const tokenGroups = new Map<
      string,
      Array<(typeof expiring)[number]>
    >();

    for (const conn of expiring) {
      const key = conn.accessTokenEnc!;
      const group = tokenGroups.get(key) ?? [];
      group.push(conn);
      tokenGroups.set(key, group);
    }

    let refreshed = 0;
    let failed = 0;

    for (const [encToken, connections] of tokenGroups) {
      try {
        // Decrypt the current token
        const currentToken = this.tokenService.decrypt(encToken);

        // Exchange for a new long-lived token
        const result = await this.exchangeForLongLivedToken(
          appId,
          appSecret,
          currentToken,
        );

        if (!result) {
          failed += connections.length;
          continue;
        }

        // Encrypt the new token
        const newEncToken = this.tokenService.encrypt(result.accessToken);

        // Update all connections sharing this token
        const ids = connections.map((c) => c.id);
        await this.prisma.fbConnection.updateMany({
          where: { id: { in: ids } },
          data: {
            accessTokenEnc: newEncToken,
            tokenExpiresAt: result.expiresAt,
          },
        });

        refreshed += connections.length;

        this.logger.log(
          `Refreshed token for ${connections.length} connection(s) ` +
            `(seller: ${connections[0].sellerId}, new expiry: ${result.expiresAt.toISOString()})`,
        );
      } catch (err) {
        failed += connections.length;
        this.logger.error(
          `Failed to refresh token for ${connections.length} connection(s): ${(err as Error).message}`,
        );
      }

      // Rate limit: wait between requests
      if (tokenGroups.size > 1) {
        await sleep(PER_TOKEN_DELAY_MS);
      }
    }

    this.logger.log(
      `Token refresh cycle complete: ${refreshed} refreshed, ${failed} failed`,
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Exchange a long-lived token for a new long-lived token.
   * Returns null if the exchange fails (token may have been revoked).
   */
  private async exchangeForLongLivedToken(
    appId: string,
    appSecret: string,
    currentToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date } | null> {
    try {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken,
      });

      const response = await fetch(
        `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `Token refresh exchange failed (HTTP ${response.status}): ${body}`,
        );
        return null;
      }

      const data = (await response.json()) as MetaLongLivedTokenResponse;

      if (!data.access_token) {
        this.logger.warn('Token refresh exchange returned no access_token');
        return null;
      }

      // expires_in is in seconds; default to 60 days if not provided
      const expiresInMs = (data.expires_in ?? 60 * 24 * 60 * 60) * 1000;
      const expiresAt = new Date(Date.now() + expiresInMs);

      return { accessToken: data.access_token, expiresAt };
    } catch (err) {
      this.logger.error('Token refresh exchange threw', err);
      return null;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
