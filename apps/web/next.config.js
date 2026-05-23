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
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
