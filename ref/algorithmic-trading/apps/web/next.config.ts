import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@trading/shared', '@trading/engine'],
  serverExternalPackages: ['better-sqlite3']
};

export default nextConfig;
