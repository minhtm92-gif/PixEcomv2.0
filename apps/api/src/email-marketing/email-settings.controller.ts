import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailSettingsService } from './email-settings.service';
import { EmailSendService } from './email-send.service';
import { UpdateEmailSettingsDto } from './dto/update-settings.dto';

@Controller('email-settings')
@UseGuards(JwtAuthGuard)
export class EmailSettingsController {
  constructor(
    private readonly settingsService: EmailSettingsService,
    private readonly sendService: EmailSendService,
  ) {}

  @Get()
  getSettings(@Req() req: any) {
    const sellerId = req.user.sellerId;
    return this.settingsService.getSettings(sellerId);
  }

  @Put()
  updateSettings(@Req() req: any, @Body() dto: UpdateEmailSettingsDto) {
    const sellerId = req.user.sellerId;
    return this.settingsService.updateSettings(sellerId, dto);
  }

  @Post('test')
  async sendTestEmail(@Req() req: any) {
    const sellerId = req.user.sellerId;
    const settings = await this.settingsService.getSettings(sellerId);
    const testEmail = settings.fromEmail || req.user.email;

    if (!testEmail) {
      return { success: false, message: 'No email address configured' };
    }

    const result = await this.sendService.queueEmail({
      sellerId,
      toEmail: testEmail,
      flowId: 'test_email',
      subject: 'Test Email from Your Store',
      variables: {
        body: 'This is a test email to verify your email marketing configuration is working correctly.',
      },
      priority: 1,
    });

    return {
      success: !!result.jobId,
      jobId: result.jobId,
      message: result.jobId
        ? 'Test email queued successfully'
        : 'Email was suppressed — check suppression settings',
    };
  }
}
