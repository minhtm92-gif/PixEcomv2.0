/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Cloudflare Pages (storefront).
  // Disabled in dev so admin dynamic routes (sellers/[id], etc.) work.
  // Production CI sets STATIC_EXPORT=true before `next build`.
  ...(process.env.STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  transpilePackages: ['@pixecom/types'],
  images: {
    unoptimized: true, // CF Pages doesn't support next/image optimization
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};

module.exports = nextConfig;
