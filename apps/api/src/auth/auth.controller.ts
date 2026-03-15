import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /api/auth/register
   * Creates user + seller + sellerUser(OWNER) + sellerSettings.
   * Sets httpOnly refresh token cookie, returns access token + context.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    this.authService.setRefreshCookie(res, result.rawRefreshToken);
    return res.status(HttpStatus.CREATED).json({
      accessToken: result.accessToken,
      user: result.user,
      seller: result.seller,
    });
  }

  /**
   * POST /api/auth/login
   * Authenticates seller accounts with email + password.
   * Superadmin accounts are rejected — they must use /auth/admin-login.
   * Sets httpOnly refresh token cookie, returns access token + context.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.authService.login(dto, 'seller');
    this.authService.setRefreshCookie(res, result.rawRefreshToken);
    return res.status(HttpStatus.OK).json({
      accessToken: result.accessToken,
      user: result.user,
      seller: result.seller,
    });
  }

  /**
   * POST /api/auth/admin-login
   * Authenticates superadmin accounts only.
   * Regular seller accounts are rejected — they must use /auth/login.
   * Sets httpOnly refresh token cookie, returns access token + context.
   */
  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.authService.login(dto, 'admin');
    this.authService.setRefreshCookie(res, result.rawRefreshToken);
    return res.status(HttpStatus.OK).json({
      accessToken: result.accessToken,
      user: result.user,
      seller: result.seller,
    });
  }

  /**
   * POST /api/auth/refresh
   * Reads refresh_token cookie, validates + rotates it.
   * Issues new access token + sets new refresh cookie.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const rawToken: string | undefined = req.cookies?.refresh_token;
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const result = await this.authService.refresh(rawToken);
    this.authService.setRefreshCookie(res, result.rawRefreshToken);
    return res.status(HttpStatus.OK).json({ accessToken: result.accessToken });
  }

  /**
   * POST /api/auth/logout
   * Revokes refresh token from DB, clears cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const rawToken: string | undefined = req.cookies?.refresh_token;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    this.authService.clearRefreshCookie(res);
    return res.status(HttpStatus.OK).json({ message: 'Logged out' });
  }

  /**
   * GET /api/auth/me
   * Returns authenticated user + seller context.
   * Requires valid Bearer JWT in Authorization header.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.userId, user.sellerId);
  }

  /**
   * GET /api/auth/sso/callback?token=xxx&redirect=/orders
   * PixHub SSO callback — verifies SSO token, upserts local user, sets session.
   */
  @Get('sso/callback')
  async ssoCallback(
    @Query('token') token: string,
    @Query('redirect') redirect: string,
    @Res() res: Response,
  ) {
    const pixhubApiUrl = this.config.get<string>('PIXHUB_API_URL', 'https://api-hub.pixelxlab.com/api/v1');
    const pixhubLoginUrl = this.config.get<string>('PIXHUB_LOGIN_URL', 'https://hub.pixelxlab.com/login');

    if (!token) {
      return res.redirect(`${pixhubLoginUrl}?redirect_app=PIXECOM`);
    }

    try {
      // 1. Verify SSO token with PixHub
      const verifyRes = await fetch(`${pixhubApiUrl}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const verification = await verifyRes.json() as any;

      if (!verification.valid) {
        this.logger.warn('SSO token verification failed');
        return res.redirect(`${pixhubLoginUrl}?redirect_app=PIXECOM`);
      }

      const ssoUser = verification.user;

      // 2. Upsert local user + seller
      const result = await this.authService.ssoLogin(ssoUser);

      // 3. Set refresh cookie
      this.authService.setRefreshCookie(res, result.rawRefreshToken);

      // 4. Redirect to frontend (auth store will pick up session via /auth/refresh)
      const targetPath = redirect || '/orders';
      return res.redirect(targetPath);
    } catch (err) {
      this.logger.error('SSO callback error', err);
      return res.redirect(`${pixhubLoginUrl}?redirect_app=PIXECOM`);
    }
  }

  /**
   * POST /api/auth/google
   * Stub: Google SSO not yet implemented.
   */
  @Post('google')
  googleStub() {
    throw new HttpException(
      'Google SSO not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
