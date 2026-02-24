/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages (storefront).
  // Disabled in dev so admin dynamic routes (sellers/[id], etc.) work.
  // Production CI sets STATIC_EXPORT=true before `next build`.
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  transpilePackages: ['@pixecom/types'],
  images: {
    unoptimized: true, // CF Pages doesn't support next/image optimization
  },
};

module.exports = nextConfig;
