import {
  BadRequestException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { MetaTokenService } from './meta-token.service';
import { MetaAdAccount, MetaLongLivedTokenResponse, MetaOAuthTokenResponse, MetaPage, MetaPixel } from './meta.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v22.0';
const OAUTH_SCOPES = [
  'ads_management',
  'ads_read',
  'pages_read_engagement',
  'pages_show_list',
  'business_management',
].join(',');

/** State token TTL: 10 minutes. */
const STATE_TTL_MS = 10 * 60 * 1000;

// ─── MetaController ───────────────────────────────────────────────────────────

@Controller('meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenService: MetaTokenService,
  ) {}

  // ─── GET /api/meta/auth-url ──────────────────────────────────────────────

  /**
   * Returns the Facebook OAuth authorization URL.
   * The `state` param encodes sellerId + expiry timestamp (AES-256-GCM encrypted).
   * Requires JWT so we always know which seller is initiating the flow.
   */
  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(@CurrentUser() user: AuthUser): { url: string } {
    const appId = this.config.get<string>('META_APP_ID');
    const redirectUri = this.config.get<string>('META_REDIRECT_URI');

    if (!appId || !redirectUri) {
      throw new InternalServerErrorException(
        'META_APP_ID and META_REDIRECT_URI must be configured',
      );
    }

    // State = base64(sellerId + ":" + expiresAt)
    const statePayload = `${user.sellerId}:${Date.now() + STATE_TTL_MS}`;
    const state = this.tokenService.encrypt(statePayload);

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: OAUTH_SCOPES,
      response_type: 'code',
      state,
    });

    const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`;
    return { url };
  }

  // ─── GET /api/meta/callback ──────────────────────────────────────────────

  /**
   * OAuth callback handler.
   * - Receives `code` and `state` from Facebook.
   * - Exchanges `code` for an access token.
   * - Decrypts `state` to recover sellerId + validates TTL.
   * - Encrypts the token and upserts FbConnection.accessTokenEnc.
   * - Redirects to FRONTEND_URL/meta/connected on success.
   * - Redirects to FRONTEND_URL/meta/error on failure.
   *
   * NOTE: This endpoint is public (no JwtAuthGuard) — the state param
   * carries the seller identity already verified at auth-url time.
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') fbError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendBase =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    // FB redirects here with ?error=... if user denies
    if (fbError || !code || !state) {
      this.logger.warn(`OAuth callback error: ${fbError ?? 'missing code/state'}`);
      res.redirect(`${frontendBase}/meta/error?reason=denied`);
      return;
    }

    try {
      // 1. Decrypt + validate state
      const sellerId = this.decryptState(state);

      // 2. Exchange code for short-lived access token
      const shortLivedToken = await this.exchangeCodeForToken(code);

      // 3. Exchange short-lived token for long-lived token (60 days)
      const { accessToken, expiresAt } =
        await this.exchangeForLongLivedToken(shortLivedToken);

      // 4. Fetch Facebook user profile + ad accounts
      const fbUser = await this.fetchFbUserProfile(accessToken);

      // 5. Encrypt token
      const encToken = this.tokenService.encrypt(accessToken);

      // 6. Upsert FbConnections for ALL ad accounts
      const adAccounts = await this.fetchAdAccounts(accessToken);

      if (adAccounts.length > 0) {
        for (let i = 0; i < adAccounts.length; i++) {
          const acc = adAccounts[i];
          await this.prisma.fbConnection.upsert({
            where: {
              uq_fb_connection: {
                sellerId,
                connectionType: 'AD_ACCOUNT',
                externalId: acc.id.replace('act_', ''),
              },
            },
            update: {
              accessTokenEnc: encToken,
              tokenExpiresAt: expiresAt,
              name: acc.name,
              isActive: true,
              metadata: {
                fbUserId: fbUser.id,
                fbUserName: fbUser.name,
                currency: acc.currency,
                timezone: acc.timezone_name,
                accountStatus: acc.account_status,
                spendCap: acc.spend_cap ?? null,
                amountSpent: acc.amount_spent ?? null,
              },
            },
            create: {
              sellerId,
              connectionType: 'AD_ACCOUNT',
              externalId: acc.id.replace('act_', ''),
              name: acc.name,
              accessTokenEnc: encToken,
              tokenExpiresAt: expiresAt,
              isPrimary: i === 0,
              isActive: true,
              metadata: {
                fbUserId: fbUser.id,
                fbUserName: fbUser.name,
                currency: acc.currency,
                timezone: acc.timezone_name,
                accountStatus: acc.account_status,
                spendCap: acc.spend_cap ?? null,
                amountSpent: acc.amount_spent ?? null,
              },
            },
          });
        }
      } else {
        // No ad account found — create a user-level connection so it still shows up
        await this.prisma.fbConnection.upsert({
          where: {
            uq_fb_connection: {
              sellerId,
              connectionType: 'AD_ACCOUNT',
              externalId: fbUser.id,
            },
          },
          update: {
            accessTokenEnc: encToken,
            tokenExpiresAt: expiresAt,
            name: fbUser.name,
            isActive: true,
            metadata: { fbUserId: fbUser.id, fbUserName: fbUser.name },
          },
          create: {
            sellerId,
            connectionType: 'AD_ACCOUNT',
            externalId: fbUser.id,
            name: fbUser.name,
            accessTokenEnc: encToken,
            tokenExpiresAt: expiresAt,
            isPrimary: true,
            isActive: true,
            metadata: { fbUserId: fbUser.id, fbUserName: fbUser.name },
          },
        });
      }

      // 7. Upsert FbConnections for Facebook Pages (personal + business)
      // Note: Page access tokens obtained via /me/accounts are already long-lived
      // and don't expire as long as the user token remains valid.
      const pages = await this.fetchAllPages(accessToken);
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const encPageToken = page.access_token
          ? this.tokenService.encrypt(page.access_token)
          : null;
        await this.prisma.fbConnection.upsert({
          where: {
            uq_fb_connection: {
              sellerId,
              connectionType: 'PAGE',
              externalId: page.id,
            },
          },
          update: {
            accessTokenEnc: encPageToken,
            tokenExpiresAt: expiresAt,
            name: page.name,
            isActive: true,
            metadata: {
              fbUserId: fbUser.id,
              fbUserName: fbUser.name,
              category: page.category,
            },
          },
          create: {
            sellerId,
            connectionType: 'PAGE',
            externalId: page.id,
            name: page.name,
            accessTokenEnc: encPageToken,
            tokenExpiresAt: expiresAt,
            isPrimary: i === 0,
            isActive: true,
            metadata: {
              fbUserId: fbUser.id,
              fbUserName: fbUser.name,
              category: page.category,
            },
          },
        });
      }

      // 8. Upsert FbConnections for Pixels / Datasets (per ad account)
      let totalPixels = 0;
      for (const acc of adAccounts) {
        const adAccountExternalId = acc.id.replace('act_', '');
        const pixels = await this.fetchPixels(accessToken, acc.id);

        // Find the parent FbConnection for this ad account
        const parentConn = await this.prisma.fbConnection.findUnique({
          where: {
            uq_fb_connection: {
              sellerId,
              connectionType: 'AD_ACCOUNT',
              externalId: adAccountExternalId,
            },
          },
          select: { id: true },
        });

        for (const pixel of pixels) {
          await this.prisma.fbConnection.upsert({
            where: {
              uq_fb_connection: {
                sellerId,
                connectionType: 'PIXEL',
                externalId: pixel.id,
              },
            },
            update: {
              accessTokenEnc: encToken,
              tokenExpiresAt: expiresAt,
              name: pixel.name,
              isActive: true,
              parentId: parentConn?.id ?? null,
              metadata: {
                fbUserId: fbUser.id,
                fbUserName: fbUser.name,
                adAccountId: adAccountExternalId,
                lastFiredTime: pixel.last_fired_time ?? null,
                creationTime: pixel.creation_time ?? null,
              },
            },
            create: {
              sellerId,
              connectionType: 'PIXEL',
              externalId: pixel.id,
              name: pixel.name,
              accessTokenEnc: encToken,
              tokenExpiresAt: expiresAt,
              parentId: parentConn?.id ?? null,
              isPrimary: false,
              isActive: true,
              metadata: {
                fbUserId: fbUser.id,
                fbUserName: fbUser.name,
                adAccountId: adAccountExternalId,
                lastFiredTime: pixel.last_fired_time ?? null,
                creationTime: pixel.creation_time ?? null,
              },
            },
          });
        }
        totalPixels += pixels.length;
      }

      this.logger.log(
        `OAuth callback: upserted FbConnections for seller ${sellerId} (FB user: ${fbUser.name}, ad accounts: ${adAccounts.length}, pages: ${pages.length}, pixels: ${totalPixels})`,
      );

      res.redirect(`${frontendBase}/meta/connected`);
    } catch (err) {
      const reason =
        err instanceof UnauthorizedException
          ? 'token_expired'
          : err instanceof BadRequestException
            ? 'invalid_request'
            : 'server_error';

      this.logger.error('OAuth callback failed', err);
      res.redirect(`${frontendBase}/meta/error?reason=${reason}`);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Decrypt and validate the OAuth state parameter.
   * Returns the sellerId embedded in the state.
   */
  private decryptState(state: string): string {
    let payload: string;
    try {
      payload = this.tokenService.decrypt(state);
    } catch {
      throw new UnauthorizedException('Invalid or tampered OAuth state');
    }

    const sep = payload.lastIndexOf(':');
    if (sep === -1) {
      throw new UnauthorizedException('Malformed OAuth state');
    }

    const sellerId = payload.slice(0, sep);
    const expiresAt = parseInt(payload.slice(sep + 1), 10);

    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      throw new UnauthorizedException('OAuth state has expired. Please start the auth flow again.');
    }

    if (!sellerId) {
      throw new UnauthorizedException('OAuth state missing sellerId');
    }

    return sellerId;
  }

  /**
   * Exchange an authorization code for an access token via Meta Graph API.
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');
    const redirectUri = this.config.get<string>('META_REDIRECT_URI');

    if (!appId || !appSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI must be configured',
      );
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const response = await fetch(
      `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
      { method: 'POST' },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Token exchange failed: ${response.status} ${body}`);
      throw new BadRequestException('Failed to exchange Meta authorization code');
    }

    const data = (await response.json()) as MetaOAuthTokenResponse;
    if (!data.access_token) {
      throw new BadRequestException('Meta token exchange returned no access_token');
    }

    return data.access_token;
  }

  /**
   * Exchange a short-lived token for a long-lived token (~60 days).
   * If the exchange fails, falls back to the short-lived token with a
   * conservative 1-hour expiry estimate.
   *
   * @see https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived/
   */
  private async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      this.logger.warn(
        'META_APP_ID/META_APP_SECRET not configured — skipping long-lived token exchange',
      );
      return {
        accessToken: shortLivedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // fallback: 1 hour
      };
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      });

      const response = await fetch(
        `${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`,
      );

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `Long-lived token exchange failed: ${response.status} ${body}. Falling back to short-lived token.`,
        );
        return {
          accessToken: shortLivedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        };
      }

      const data = (await response.json()) as MetaLongLivedTokenResponse;

      if (!data.access_token) {
        this.logger.warn(
          'Long-lived token exchange returned no access_token. Falling back to short-lived token.',
        );
        return {
          accessToken: shortLivedToken,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        };
      }

      // expires_in is in seconds; default to 60 days if not provided
      const expiresInMs = (data.expires_in ?? 60 * 24 * 60 * 60) * 1000;
      const expiresAt = new Date(Date.now() + expiresInMs);

      this.logger.log(
        `Successfully exchanged for long-lived token (expires: ${expiresAt.toISOString()})`,
      );

      return { accessToken: data.access_token, expiresAt };
    } catch (err) {
      this.logger.error('Long-lived token exchange threw an error', err);
      return {
        accessToken: shortLivedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
    }
  }

  /**
   * Fetch the authenticated Facebook user's profile (id + name).
   */
  private async fetchFbUserProfile(
    accessToken: string,
  ): Promise<{ id: string; name: string }> {
    const response = await fetch(
      `${META_GRAPH_BASE}/me?fields=id,name&access_token=${accessToken}`,
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`FB /me failed: ${response.status} ${body}`);
      throw new BadRequestException('Failed to fetch Facebook user profile');
    }

    return (await response.json()) as { id: string; name: string };
  }

  /**
   * Fetch ad accounts accessible by the token.
   */
  private async fetchAdAccounts(
    accessToken: string,
  ): Promise<MetaAdAccount[]> {
    try {
      const response = await fetch(
        `${META_GRAPH_BASE}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,spend_cap,amount_spent&access_token=${accessToken}`,
      );

      if (!response.ok) {
        this.logger.warn(
          `FB /me/adaccounts failed: ${response.status} — proceeding without ad accounts`,
        );
        return [];
      }

      const data = (await response.json()) as { data: MetaAdAccount[] };
      return data.data ?? [];
    } catch (err) {
      this.logger.warn('Failed to fetch ad accounts, proceeding without', err);
      return [];
    }
  }

  /**
   * Fetch Pixels / Datasets for a specific ad account.
   * Meta API still uses the `/adspixels` endpoint (UI renamed to "Datasets").
   */
  private async fetchPixels(
    accessToken: string,
    adAccountId: string,
  ): Promise<MetaPixel[]> {
    try {
      const response = await fetch(
        `${META_GRAPH_BASE}/${adAccountId}/adspixels?fields=id,name,last_fired_time,creation_time&access_token=${accessToken}`,
      );

      if (!response.ok) {
        this.logger.warn(
          `FB /${adAccountId}/adspixels failed: ${response.status} — proceeding without pixels`,
        );
        return [];
      }

      const data = (await response.json()) as { data: MetaPixel[] };
      return data.data ?? [];
    } catch (err) {
      this.logger.warn(`Failed to fetch pixels for ${adAccountId}, proceeding without`, err);
      return [];
    }
  }

  /**
   * Fetch ALL Facebook Pages: personal + business-owned.
   * Deduplicates by page ID (personal pages take priority since they have access_token).
   */
  private async fetchAllPages(accessToken: string): Promise<MetaPage[]> {
    const pageMap = new Map<string, MetaPage>();

    // 1. Personal pages via /me/accounts (these come WITH page access tokens)
    try {
      let url: string | null =
        `${META_GRAPH_BASE}/me/accounts?fields=id,name,category,access_token&limit=100&access_token=${accessToken}`;

      while (url) {
        const response = await fetch(url);
        if (!response.ok) {
          this.logger.warn(`FB /me/accounts failed: ${response.status}`);
          break;
        }
        const data = (await response.json()) as {
          data: MetaPage[];
          paging?: { next?: string };
        };
        for (const page of data.data ?? []) {
          pageMap.set(page.id, page);
        }
        url = data.paging?.next ?? null;
      }
    } catch (err) {
      this.logger.warn('Failed to fetch personal pages', err);
    }

    // 2. Business pages via /me/businesses -> /{biz-id}/owned_pages
    try {
      const bizResponse = await fetch(
        `${META_GRAPH_BASE}/me/businesses?fields=id,name&access_token=${accessToken}`,
      );

      if (bizResponse.ok) {
        const bizData = (await bizResponse.json()) as {
          data: Array<{ id: string; name: string }>;
        };

        for (const biz of bizData.data ?? []) {
          // Fetch owned pages for this business
          try {
            const ownedResponse = await fetch(
              `${META_GRAPH_BASE}/${biz.id}/owned_pages?fields=id,name,category,access_token&limit=100&access_token=${accessToken}`,
            );
            if (ownedResponse.ok) {
              const ownedData = (await ownedResponse.json()) as { data: MetaPage[] };
              for (const page of ownedData.data ?? []) {
                if (!pageMap.has(page.id)) {
                  pageMap.set(page.id, page);
                }
              }
            }
          } catch (err) {
            this.logger.warn(`Failed to fetch owned_pages for business ${biz.id}`, err);
          }

          // Fetch client pages (agency model)
          try {
            const clientResponse = await fetch(
              `${META_GRAPH_BASE}/${biz.id}/client_pages?fields=id,name,category&limit=100&access_token=${accessToken}`,
            );
            if (clientResponse.ok) {
              const clientData = (await clientResponse.json()) as { data: MetaPage[] };
              for (const page of clientData.data ?? []) {
                if (!pageMap.has(page.id)) {
                  pageMap.set(page.id, { ...page, access_token: '' });
                }
              }
            }
          } catch (err) {
            this.logger.warn(`Failed to fetch client_pages for business ${biz.id}`, err);
          }
        }
      }
    } catch (err) {
      this.logger.warn('Failed to fetch businesses, proceeding with personal pages only', err);
    }

    this.logger.log(
      `Fetched ${pageMap.size} total pages (personal + business)`,
    );
    return Array.from(pageMap.values());
  }
}
