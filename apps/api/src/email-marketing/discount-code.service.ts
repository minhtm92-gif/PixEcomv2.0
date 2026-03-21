import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GenerateRecoveryCodeParams {
  sellerId: string;
  emailJobId?: string;
  percentage: number;
  expiryHours: number;
}

interface ValidateCodeResult {
  valid: boolean;
  type?: string;
  value?: number;
  code?: string;
  discountCodeId?: string;
  message?: string;
}

interface ApplyCodeResult {
  success: boolean;
  type: string;
  value: number;
  discountCodeId: string;
  message?: string;
}

@Injectable()
export class DiscountCodeService {
  private readonly logger = new Logger(DiscountCodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique recovery discount code.
   * Format: SAVE{percentage}-{random4chars}, e.g. SAVE10-A3K9
   * Single use, linked to email job, expires after expiryHours.
   */
  async generateRecoveryCode(
    params: GenerateRecoveryCodeParams,
  ): Promise<{ code: string; discountCodeId: string }> {
    const { sellerId, emailJobId, percentage, expiryHours } = params;

    // Generate unique code with retry
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (true) {
      const random = this.generateRandomSuffix(4);
      code = `SAVE${percentage}-${random}`;

      // Check uniqueness for this seller
      const existing = await this.prisma.discountCode.findUnique({
        where: { sellerId_code: { sellerId, code } },
      });

      if (!existing) break;

      attempts++;
      if (attempts >= maxAttempts) {
        // Use longer suffix for uniqueness
        const longRandom = this.generateRandomSuffix(8);
        code = `SAVE${percentage}-${longRandom}`;
        break;
      }
    }

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const discountCode = await this.prisma.discountCode.create({
      data: {
        sellerId,
        code,
        type: 'PERCENTAGE',
        value: percentage,
        maxUses: 1,
        usedCount: 0,
        expiresAt,
        emailJobId: emailJobId ?? null,
        isActive: true,
      },
    });

    this.logger.log(
      `Generated recovery code ${code} for seller ${sellerId} (expires ${expiresAt.toISOString()})`,
    );

    return { code: discountCode.code, discountCodeId: discountCode.id };
  }

  /**
   * Validate a discount code: check existence, active, not expired, usage limits.
   */
  async validateCode(
    sellerId: string,
    code: string,
  ): Promise<ValidateCodeResult> {
    const normalized = code.trim().toUpperCase();

    const discountCode = await this.prisma.discountCode.findUnique({
      where: { sellerId_code: { sellerId, code: normalized } },
    });

    if (!discountCode) {
      return { valid: false, message: 'Invalid discount code' };
    }

    if (!discountCode.isActive) {
      return { valid: false, message: 'This discount code is no longer active' };
    }

    if (new Date() > discountCode.expiresAt) {
      return { valid: false, message: 'This discount code has expired' };
    }

    if (discountCode.usedCount >= discountCode.maxUses) {
      return {
        valid: false,
        message: 'This discount code has already been used',
      };
    }

    return {
      valid: true,
      type: discountCode.type,
      value: Number(discountCode.value),
      code: discountCode.code,
      discountCodeId: discountCode.id,
    };
  }

  /**
   * Apply a discount code: validate + increment usedCount.
   * Returns discount details for order calculation.
   */
  async applyCode(
    sellerId: string,
    code: string,
  ): Promise<ApplyCodeResult> {
    const validation = await this.validateCode(sellerId, code);

    if (!validation.valid) {
      return {
        success: false,
        type: '',
        value: 0,
        discountCodeId: '',
        message: validation.message,
      };
    }

    // Increment usedCount atomically
    await this.prisma.discountCode.update({
      where: {
        sellerId_code: { sellerId, code: code.trim().toUpperCase() },
      },
      data: { usedCount: { increment: 1 } },
    });

    this.logger.log(
      `Applied discount code ${code} for seller ${sellerId}`,
    );

    return {
      success: true,
      type: validation.type!,
      value: validation.value!,
      discountCodeId: validation.discountCodeId!,
    };
  }

  /**
   * Batch deactivate all expired discount codes.
   * Should be called periodically (e.g., daily cron).
   */
  async deactivateExpired(): Promise<{ deactivatedCount: number }> {
    const { count } = await this.prisma.discountCode.updateMany({
      where: {
        isActive: true,
        expiresAt: { lt: new Date() },
      },
      data: { isActive: false },
    });

    if (count > 0) {
      this.logger.log(`Deactivated ${count} expired discount codes`);
    }

    return { deactivatedCount: count };
  }

  /**
   * Generate a random uppercase alphanumeric suffix.
   */
  private generateRandomSuffix(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, I, 1 to avoid confusion
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
