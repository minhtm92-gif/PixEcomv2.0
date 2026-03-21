import { NextRequest, NextResponse } from 'next/server';

/**
 * Custom-domain middleware for PixEcom storefront.
 *
 * When a request arrives on a hostname that is NOT the main platform domain
 * (pixecom.pixelxlab.com / localhost), we treat it as a custom seller domain
 * (e.g. jal2.com).
 *
 * Flow:
 *   1. Extract hostname from the Host header.
 *   2. Skip if it matches the platform domain or is localhost/127.0.0.1.
 *   3. Call the API  GET /storefront/resolve-domain?hostname=...  to get the
 *      seller slug (cached in-memory for 5 minutes).
 *   4. Rewrite the URL to  /{sellerSlug}{pathname}  so the existing
 *      (storefront)/[store]/... route group handles it.
 *
 * Examples:
 *   jal2.com/            → rewrite to /pixelxlab-store-rs59b8
 *   jal2.com/janisie     → rewrite to /pixelxlab-store-rs59b8/janisie
 *   jal2.com/janisie/checkout → rewrite to /pixelxlab-store-rs59b8/janisie/checkout
 */

// ─── In-memory cache for domain → sellerSlug resolution ─────────────────────

interface CacheEntry {
  sellerSlug: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const domainCache = new Map<string, CacheEntry>();

// ─── Platform hostnames that should NOT be rewritten ────────────────────────

const PLATFORM_HOSTS = new Set([
  'pixecom.pixelxlab.com',
  'localhost',
  '127.0.0.1',
]);

// ─── API base URL for server-side calls ─────────────────────────────────────
// In middleware we cannot use NEXT_PUBLIC_ env (it's edge runtime).
// We use a server-side env var, fallback to localhost for dev.
const API_BASE =
  process.env.MIDDLEWARE_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:3001/api';

// ─── Middleware ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? '';

  // Skip platform domains — no rewriting needed
  if (PLATFORM_HOSTS.has(hostname) || hostname === '') {
    return NextResponse.next();
  }

  // Skip internal Next.js routes, static assets, API routes
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap') ||
    pathname === '/health' ||
    /\.\w{2,5}$/.test(pathname) // static files (.js, .css, .png, etc.)
  ) {
    return NextResponse.next();
  }

  // Resolve custom domain → seller slug
  const sellerSlug = await resolveSellerSlug(hostname);

  if (!sellerSlug) {
    // Domain not recognized — show 404
    const url = request.nextUrl.clone();
    url.pathname = '/not-found';
    return NextResponse.rewrite(url);
  }

  // Rewrite: jal2.com/janisie → /{sellerSlug}/janisie
  const url = request.nextUrl.clone();
  url.pathname = `/${sellerSlug}${pathname === '/' ? '' : pathname}`;

  return NextResponse.rewrite(url);
}

// ─── Domain resolution with in-memory cache ────────────────────────────────

async function resolveSellerSlug(hostname: string): Promise<string | null> {
  // Check cache first
  const cached = domainCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.sellerSlug;
  }

  try {
    const res = await fetch(
      `${API_BASE}/storefront/resolve-domain?hostname=${encodeURIComponent(hostname)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Edge runtime doesn't support { cache: ... } options in all cases,
        // so we use our own in-memory cache above.
      },
    );

    if (!res.ok) {
      // Domain not found or server error
      return null;
    }

    const data = (await res.json()) as { sellerSlug: string };

    // Cache the result
    domainCache.set(hostname, {
      sellerSlug: data.sellerSlug,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return data.sellerSlug;
  } catch (err) {
    console.error(`[middleware] Failed to resolve domain "${hostname}":`, err);
    return null;
  }
}

// ─── Matcher — run middleware on all non-static routes ──────────────────────

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
