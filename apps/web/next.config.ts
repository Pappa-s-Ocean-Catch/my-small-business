import type { NextConfig } from "next";

const channel = process.env.BUILD_CHANNEL?.trim();

const nextConfig: NextConfig = {
  distDir: channel ? `.next-${channel}` : ".next",
  // Transpile workspace packages (shared libraries)
  transpilePackages: [
    '@my-small-business/types',
    '@my-small-business/supabase',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
