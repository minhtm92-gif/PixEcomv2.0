/**
 * Server-side event tracking — fire-and-forget.
 * Uses the same API base URL pattern as storefrontApi.ts.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

// Session ID for dedup — persists per browser tab
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = sessionStorage.getItem('px_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('px_sid', sid);
  }
  return sid;
}

// Fire-and-forget event tracking
export async function trackEvent(
  storeSlug: string,
  event: string,
  data: {
    sellpageSlug?: string;
    productId?: string;
    variantId?: string;
    value?: number;
    quantity?: number;
  } = {},
) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    await fetch(`${BASE}/storefront/${storeSlug}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        sellpageSlug: data.sellpageSlug || '',
        productId: data.productId,
        variantId: data.variantId,
        value: data.value,
        quantity: data.quantity,
        sessionId: getSessionId(),
        utmSource: urlParams.get('utm_source') || '',
        utmCampaign: urlParams.get('utm_campaign') || '',
      }),
    });
  } catch {
    // Fire-and-forget — never block UI
  }
}
