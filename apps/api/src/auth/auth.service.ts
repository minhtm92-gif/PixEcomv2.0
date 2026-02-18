import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_COST = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'refresh_token';

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string;
}

export interface AuthPayload {
  accessToken: string;
  rawRefreshToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  seller: {
    id: string;
    name: string;
    slug: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthPayload> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const slug = this.generateSlug(dto.displayName);

    const { user, seller } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          displayName: dto.displayName,
        },
      });

      const seller = await tx.seller.create({
        data: {
          name: dto.displayName,
          slug,
        },
      });

      await tx.sellerUser.create({
        data: {
          userId: user.id,
          sellerId: seller.id,
          role: 'OWNER',
        },
      });

      await tx.sellerSettings.create({
        data: {
          sellerId: seller.id,
        },
      });

      return { user, seller };
    });

    const tokens = await this.generateTokens(user.id, seller.id, 'OWNER');

    return {
      ...tokens,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      seller: { id: seller.id, name: seller.name, slug: seller.slug },
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthPayload> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sellerUser = await this.prisma.sellerUser.findFirst({
      where: { userId: user.id, isActive: true },
      include: { seller: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (!sellerUser) {
      throw new UnauthorizedException('No active seller account found');
    }

    const tokens = await this.generateTokens(
      user.id,
      sellerUser.sellerId,
      sellerUser.role,
    );

    return {
      ...tokens,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      seller: {
        id: sellerUser.seller.id,
        name: sellerUser.seller.name,
        slug: sellerUser.seller.slug,
      },
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────

  async refresh(rawToken: string): Promise<TokenPair> {
    const hash = this.hashToken(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hash },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    // Rotation: delete old token before issuing new one
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const sellerUser = await this.prisma.sellerUser.findFirst({
      where: { userId: stored.userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!sellerUser) {
      throw new UnauthorizedException('No active seller account found');
    }

    return this.generateTokens(
      stored.userId,
      sellerUser.sellerId,
      sellerUser.role,
    );
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(rawToken: string): Promise<void> {
    const hash = this.hashToken(rawToken);
    await this.prisma.refreshToken.deleteMany({ where: { token: hash } });
  }

  // ─── Me ───────────────────────────────────────────────────────────────────

  async getMe(userId: string, sellerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const sellerUser = await this.prisma.sellerUser.findFirst({
      where: { userId, sellerId, isActive: true },
      select: { role: true },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      sellerId,
      role: sellerUser?.role ?? null,
    };
  }

  // ─── Token Helpers ────────────────────────────────────────────────────────

  async generateTokens(
    userId: string,
    sellerId: string,
    role: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId, sellerId, role },
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m') },
    );

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const hash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { userId, token: hash, expiresAt },
    });

    return { accessToken, rawRefreshToken };
  }

  hashToken(raw: string): string {
    const pepper = this.config.get<string>('REFRESH_TOKEN_PEPPER', '');
    return crypto.createHmac('sha256', pepper).update(raw).digest('hex');
  }

  setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      domain: this.config.get<string>('COOKIE_DOMAIN', ''),
      path: '/api/auth/refresh',
      maxAge: REFRESH_TTL_MS,
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      sameSite: 'lax',
      domain: this.config.get<string>('COOKIE_DOMAIN', ''),
      path: '/api/auth/refresh',
    });
  }

  // ─── Slug Generation ─────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const suffix = Math.random().toString(36).slice(-4);
    return `${base}-${suffix}`;
  }
}
