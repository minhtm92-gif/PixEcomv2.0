import { Injectable, Logger } from '@nestjs/common';

/**
 * EmailLinkWrapperService
 *
 * Wraps all links in email HTML with click-tracking redirects and
 * injects a 1x1 tracking pixel for open detection.
 *
 * Used by the email-send processor when EMAIL_TRACKING_ENABLED=true.
 */
@Injectable()
export class EmailLinkWrapperService {
  private readonly logger = new Logger(EmailLinkWrapperService.name);

  /**
   * Patterns to skip when wrapping links.
   * Unsubscribe links, mailto, tel, javascript, anchor-only, and empty hrefs.
   */
  private readonly SKIP_PATTERNS = [
    /^mailto:/i,
    /^tel:/i,
    /^javascript:/i,
    /^#/,
    /^$/,
    /unsubscribe/i,
  ];

  /**
   * Replace all <a href="..."> links in the HTML with tracking redirect URLs.
   *
   * @param html       Raw email HTML
   * @param emailJobId UUID of the EmailJob record
   * @param baseUrl    API base URL (e.g. https://api.pixecom.io)
   * @returns HTML with wrapped links
   */
  wrapLinks(html: string, emailJobId: string, baseUrl: string): string {
    const trackingId = Buffer.from(emailJobId).toString('base64url');
    let linkIndex = 0;

    // Match <a ...href="..."...> — capture the full tag so we can replace
    // the href attribute value only.
    const result = html.replace(
      /<a\s([^>]*?)href\s*=\s*["']([^"']*)["']([^>]*?)>/gi,
      (fullMatch, before, href, after) => {
        // Skip links that match exclusion patterns
        const trimmedHref = (href ?? '').trim();
        if (this.shouldSkipLink(trimmedHref)) {
          return fullMatch;
        }

        // Skip already-wrapped links (idempotency)
        if (trimmedHref.includes('/api/email-tracking/click/')) {
          return fullMatch;
        }

        const currentIndex = linkIndex++;
        const encodedUrl = encodeURIComponent(trimmedHref);

        // Add UTM params for attribution
        const trackingUrl =
          `${baseUrl}/api/email-tracking/click/${trackingId}/${currentIndex}?url=${encodedUrl}`;

        return `<a ${before}href="${trackingUrl}"${after}>`;
      },
    );

    this.logger.debug(
      `Wrapped ${linkIndex} link(s) in email job ${emailJobId}`,
    );

    return result;
  }

  /**
   * Insert a 1x1 transparent tracking pixel before </body>.
   *
   * @param html       Raw email HTML
   * @param emailJobId UUID of the EmailJob record
   * @param baseUrl    API base URL
   * @returns HTML with tracking pixel injected
   */
  addTrackingPixel(
    html: string,
    emailJobId: string,
    baseUrl: string,
  ): string {
    const trackingId = Buffer.from(emailJobId).toString('base64url');
    const pixelUrl = `${baseUrl}/api/email-tracking/open/${trackingId}`;
    const pixelTag =
      `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`;

    // Insert before </body> if present, otherwise append
    if (/<\/body>/i.test(html)) {
      return html.replace(
        /<\/body>/i,
        `${pixelTag}</body>`,
      );
    }

    return html + pixelTag;
  }

  private shouldSkipLink(href: string): boolean {
    return this.SKIP_PATTERNS.some((pattern) => pattern.test(href));
  }
}
