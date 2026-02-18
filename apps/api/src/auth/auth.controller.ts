import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
   * Authenticates with email + password.
   * Sets httpOnly refresh token cookie, returns access token + context.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const result = await this.authService.login(dto);
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
