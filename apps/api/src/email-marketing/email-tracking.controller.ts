import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 1x1 transparent GIF — 43 bytes, hardcoded.
 * Returned for every open-tracking pixel request.
 */
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/**
 * EmailTrackingController
 *
 * Public endpoints (no auth) that handle:
 *   - Open tracking via a 1x1 pixel image
 *   - Click tracking via a 302 redirect
 *
 * These are embedded into outbound emails by EmailLinkWrapperService.
 */
@Controller('email-tracking')
export class EmailTrackingController {
  private readonly logger = new Logger(EmailTrackingController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/email-tracking/open/:trackingId
   *
   * Records the first open event and returns a 1x1 transparent GIF.
   */
  @Get('open/:trackingId')
  async trackOpen(
    @Param('trackingId') trackingId: string,
    @Res() res: Response,
  ) {
    // Always return the pixel, even if DB update fails
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
      const emailJobId = this.decodeTrackingId(trackingId);
      if (!emailJobId) {
        this.logger.debug(`Invalid tracking ID for open: ${trackingId}`);
        return res.send(TRANSPARENT_GIF);
      }

      // Only set openedAt if null (first open)
      await this.prisma.emailJob.updateMany({
        where: {
          id: emailJobId,
          openedAt: null,
        },
        data: {
          openedAt: new Date(),
          status: 'OPENED',
        },
      });

      this.logger.debug(`Open tracked for email job ${emailJobId}`);
    } catch (err: any) {
      // Never fail the pixel response — tracking is best-effort
      this.logger.error(`Failed to track open: ${err.message}`);
    }

    return res.send(TRANSPARENT_GIF);
  }

  /**
   * GET /api/email-tracking/click/:trackingId/:linkIndex?url=...
   *
   * Records the first click event and 302 redirects to the original URL.
   */
  @Get('click/:trackingId/:linkIndex')
  async trackClick(
    @Param('trackingId') trackingId: string,
    @Param('linkIndex') linkIndex: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    // Default redirect in case of errors
    const fallbackUrl = url || '/';
    let redirectUrl = fallbackUrl;

    try {
      // Validate and decode the original URL
      redirectUrl = decodeURIComponent(url || '');
      if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
        redirectUrl = fallbackUrl;
      }
    } catch {
      redirectUrl = fallbackUrl;
    }

    try {
      const emailJobId = this.decodeTrackingId(trackingId);
      if (!emailJobId) {
        this.logger.debug(`Invalid tracking ID for click: ${trackingId}`);
        return res.redirect(302, redirectUrl);
      }

      const parsedLinkIndex = parseInt(linkIndex, 10);

      // Update clickedAt only if null (first click) — also set openedAt
      // because a click implies an open.
      await this.prisma.emailJob.updateMany({
        where: {
          id: emailJobId,
          clickedAt: null,
        },
        data: {
          clickedAt: new Date(),
          openedAt: new Date(), // Clicking implies opening
          status: 'CLICKED',
        },
      });

      // Store click metadata in the emailJob's variables JSON
      // (linkIndex + original URL for analytics)
      try {
        const job = await this.prisma.emailJob.findUnique({
          where: { id: emailJobId },
          select: { variables: true },
        });

        if (job) {
          const variables = (job.variables as Record<string, any>) ?? {};
          const clicks = (variables._clicks as any[]) ?? [];

          clicks.push({
            linkIndex: isNaN(parsedLinkIndex) ? linkIndex : parsedLinkIndex,
            url: redirectUrl,
            clickedAt: new Date().toISOString(),
          });

          await this.prisma.emailJob.update({
            where: { id: emailJobId },
            data: {
              variables: { ...variables, _clicks: clicks } as any,
            },
          });
        }
      } catch (metaErr: any) {
        // Non-critical — click is already recorded via clickedAt
        this.logger.debug(
          `Failed to store click metadata: ${metaErr.message}`,
        );
      }

      this.logger.debug(
        `Click tracked for email job ${emailJobId} (link #${linkIndex})`,
      );
    } catch (err: any) {
      // Never fail the redirect — tracking is best-effort
      this.logger.error(`Failed to track click: ${err.message}`);
    }

    return res.redirect(302, redirectUrl);
  }

  /**
   * Decode a base64url-encoded emailJobId.
   * Returns null if the value is not a valid UUID-like string.
   */
  private decodeTrackingId(trackingId: string): string | null {
    try {
      const decoded = Buffer.from(trackingId, 'base64url').toString('utf8');
      // Basic UUID format check (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          decoded,
        )
      ) {
        return decoded;
      }
      return null;
    } catch {
      return null;
    }
  }
}
