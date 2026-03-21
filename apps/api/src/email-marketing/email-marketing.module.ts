import { Module } from '@nestjs/common';
import { EmailSendService } from './email-send.service';
import { EmailTemplateService } from './email-template.service';
import { EmailSettingsService } from './email-settings.service';
import { EmailLinkWrapperService } from './email-link-wrapper.service';
import { EmailAnalyticsService } from './email-analytics.service';
import { DiscountCodeService } from './discount-code.service';
import { EmailTemplateController } from './email-template.controller';
import { EmailSettingsController } from './email-settings.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { SendGridWebhookController } from './sendgrid-webhook.controller';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailAnalyticsController } from './email-analytics.controller';

@Module({
  controllers: [
    EmailTemplateController,
    EmailSettingsController,
    UnsubscribeController,
    SendGridWebhookController,
    EmailTrackingController,
    EmailAnalyticsController,
  ],
  providers: [
    EmailSendService,
    EmailTemplateService,
    EmailSettingsService,
    EmailLinkWrapperService,
    EmailAnalyticsService,
    DiscountCodeService,
  ],
  exports: [EmailSendService, EmailLinkWrapperService, DiscountCodeService],
})
export class EmailMarketingModule {}
