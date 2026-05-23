/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@pinguin/shared', '@pinguin/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*`,
      },
      {
        source: '/dashboard',
        destination: '/',
      },
      {
        source: '/dashboard/:path*',
        destination: '/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
