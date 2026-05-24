/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@pinguin/shared', '@pinguin/ui'],
  allowedDevOrigins: ['192.168.1.130', process.env.NEXT_PUBLIC_DEV_ORIGIN].filter(Boolean),
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://192.168.1.130:4000'}/api/:path*`,
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
