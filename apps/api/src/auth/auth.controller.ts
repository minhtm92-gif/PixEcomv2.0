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
import { Throttle } from '@nestjs/throttler';
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
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string;

    const result = await this.authService.register(dto);
    this.authService.logAuditEvent({
      event: 'REGISTER',
      userId: result.user.id,
      email: dto.email,
      ipAddress: ip,
      userAgent: ua,
    });
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string;

    try {
      const result = await this.authService.login(dto, 'seller');
      this.authService.logAuditEvent({
        event: 'LOGIN_SUCCESS',
        userId: result.user.id,
        email: dto.email,
        ipAddress: ip,
        userAgent: ua,
      });
      this.authService.setRefreshCookie(res, result.rawRefreshToken);
      return res.status(HttpStatus.OK).json({
        accessToken: result.accessToken,
        user: result.user,
        seller: result.seller,
      });
    } catch (err) {
      this.authService.logAuditEvent({
        event: 'LOGIN_FAILED',
        email: dto.email,
        ipAddress: ip,
        userAgent: ua,
        metadata: { loginType: 'seller' },
      });
      throw err;
    }
  }

  /**
   * POST /api/auth/admin-login
   * Authenticates superadmin accounts only.
   * Regular seller accounts are rejected — they must use /auth/login.
   * Sets httpOnly refresh token cookie, returns access token + context.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('admin-login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string;

    try {
      const result = await this.authService.login(dto, 'admin');
      this.authService.logAuditEvent({
        event: 'LOGIN_SUCCESS',
        userId: result.user.id,
        email: dto.email,
        ipAddress: ip,
        userAgent: ua,
        metadata: { loginType: 'admin' },
      });
      this.authService.setRefreshCookie(res, result.rawRefreshToken);
      return res.status(HttpStatus.OK).json({
        accessToken: result.accessToken,
        user: result.user,
        seller: result.seller,
      });
    } catch (err) {
      this.authService.logAuditEvent({
        event: 'LOGIN_FAILED',
        email: dto.email,
        ipAddress: ip,
        userAgent: ua,
        metadata: { loginType: 'admin' },
      });
      throw err;
    }
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
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const ua = req.headers['user-agent'] as string;

    const rawToken: string | undefined = req.cookies?.refresh_token;
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    this.authService.logAuditEvent({
      event: 'LOGOUT',
      ipAddress: ip,
      userAgent: ua,
    });
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
    @Req() req: Request,
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

      // Audit: SSO login
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const ua = req.headers['user-agent'] as string;
      this.authService.logAuditEvent({
        event: 'SSO_LOGIN',
        email: ssoUser.email,
        ipAddress: ip,
        userAgent: ua,
        metadata: { ssoRole: ssoUser.role },
      });

      // 3. Set refresh cookie
      this.authService.setRefreshCookie(res, result.rawRefreshToken);

      // 4. Redirect to frontend based on role
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://pixecom.pixelxlab.com');
      const cLevelRoles = ['SUPERADMIN', 'C_LEVEL'];
      const defaultPath = cLevelRoles.includes(ssoUser.role) ? '/admin' : '/orders';
      const targetPath = redirect || defaultPath;
      return res.redirect(`${frontendUrl}${targetPath}`);
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
