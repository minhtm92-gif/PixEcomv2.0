'use client';

/**
 * Detect whether the current browser hostname is a custom domain
 * (i.e. NOT the main platform domain or localhost).
 *
 * On custom domains the Next.js middleware rewrites
 *   jal2.com/janisie  →  /pixelxlab-store-rs59b8/janisie
 * so the [store] param is always present in the route. But links
 * rendered in the page must NOT include the seller slug —
 * they should point to  /janisie  not  /pixelxlab-store-rs59b8/janisie.
 */

const PLATFORM_HOSTS = new Set([
  'pixecom.pixelxlab.com',
  'localhost',
  '127.0.0.1',
]);

export function isCustomDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return !PLATFORM_HOSTS.has(hostname);
}

/**
 * Build a storefront link. On the platform domain, returns /{storeSlug}{path}.
 * On custom domains, returns {path} only (the middleware handles the rewrite).
 *
 * @param storeSlug  The seller slug from the [store] route param.
 * @param path       Optional sub-path, e.g. "/janisie", "?cat=NEW_ARRIVALS".
 *                   Should start with "/" or "?" or be empty.
 */
export function storeHref(storeSlug: string, path: string = ''): string {
  if (isCustomDomain()) {
    // On custom domain: /janisie, /?cat=..., /trackings/search, etc.
    // If path is empty, return "/"
    return path === '' ? '/' : path;
  }
  // On platform domain: /pixelxlab-store-rs59b8/janisie
  return `/${storeSlug}${path}`;
}
