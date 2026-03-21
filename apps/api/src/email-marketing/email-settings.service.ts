import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailSettingsDto } from './dto/update-settings.dto';

export interface EmailSettings {
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  enabled: boolean;
  minHoursBetweenEmails: number;
  maxEmailsPerWeek: number;
}

const DEFAULT_SETTINGS: EmailSettings = {
  fromName: '',
  fromEmail: '',
  replyToEmail: '',
  enabled: true,
  minHoursBetweenEmails: 6,
  maxEmailsPerWeek: 3,
};

@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(sellerId: string): Promise<EmailSettings> {
    const sellerSettings = await this.prisma.sellerSettings.findUnique({
      where: { sellerId },
    });

    if (!sellerSettings) {
      return { ...DEFAULT_SETTINGS };
    }

    const raw = (sellerSettings as any).emailConfig;
    if (!raw || typeof raw !== 'object') {
      return {
        ...DEFAULT_SETTINGS,
        fromName: sellerSettings.brandName ?? '',
        fromEmail: sellerSettings.supportEmail ?? '',
        replyToEmail: sellerSettings.supportEmail ?? '',
      };
    }

    return {
      fromName: raw.fromName ?? sellerSettings.brandName ?? '',
      fromEmail: raw.fromEmail ?? sellerSettings.supportEmail ?? '',
      replyToEmail: raw.replyToEmail ?? sellerSettings.supportEmail ?? '',
      enabled: raw.enabled ?? true,
      minHoursBetweenEmails: raw.minHoursBetweenEmails ?? 6,
      maxEmailsPerWeek: raw.maxEmailsPerWeek ?? 3,
    };
  }

  async updateSettings(
    sellerId: string,
    dto: UpdateEmailSettingsDto,
  ): Promise<EmailSettings> {
    const current = await this.getSettings(sellerId);
    const updated: EmailSettings = {
      fromName: dto.fromName ?? current.fromName,
      fromEmail: dto.fromEmail ?? current.fromEmail,
      replyToEmail: dto.replyToEmail ?? current.replyToEmail,
      enabled: dto.enabled ?? current.enabled,
      minHoursBetweenEmails:
        dto.minHoursBetweenEmails ?? current.minHoursBetweenEmails,
      maxEmailsPerWeek: dto.maxEmailsPerWeek ?? current.maxEmailsPerWeek,
    };

    await this.prisma.sellerSettings.upsert({
      where: { sellerId },
      update: {
        ...(updated as any),
      },
      create: {
        sellerId,
        brandName: updated.fromName,
        supportEmail: updated.fromEmail,
      },
    });

    this.logger.log(`Email settings updated for seller ${sellerId}`);
    return updated;
  }
}
