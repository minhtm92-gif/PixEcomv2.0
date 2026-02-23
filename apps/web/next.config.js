/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  transpilePackages: ['@pixecom/types'],
  images: {
    unoptimized: true, // CF Pages doesn't support next/image optimization
  },
};

module.exports = nextConfig;
