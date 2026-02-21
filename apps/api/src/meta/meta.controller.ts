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
import { MetaOAuthTokenResponse } from './meta.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const OAUTH_SCOPES = [
  'ads_management',
  'ads_read',
  'pages_read_engagement',
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

      // 2. Exchange code for access token
      const accessToken = await this.exchangeCodeForToken(code);

      // 3. Encrypt token
      const encToken = this.tokenService.encrypt(accessToken);

      // 4. Upsert FbConnection: set accessTokenEnc on the primary AD_ACCOUNT
      //    belonging to this seller. If multiple AD_ACCOUNT connections exist,
      //    update all that are currently active (safer than guessing which one).
      const updated = await this.prisma.fbConnection.updateMany({
        where: {
          sellerId,
          connectionType: 'AD_ACCOUNT',
          isActive: true,
        },
        data: { accessTokenEnc: encToken },
      });

      this.logger.log(
        `OAuth callback: updated ${updated.count} AD_ACCOUNT connection(s) for seller ${sellerId}`,
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
}
