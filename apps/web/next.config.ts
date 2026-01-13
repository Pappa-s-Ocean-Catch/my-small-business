import type { NextConfig } from "next";

const channel = process.env.BUILD_CHANNEL?.trim();

const nextConfig: NextConfig = {
  distDir: channel ? `.next-${channel}` : ".next",
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
