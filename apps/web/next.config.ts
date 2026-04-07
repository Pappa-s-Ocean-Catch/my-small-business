
const withPWA = require('next-pwa');
import type { NextConfig } from "next";

const channel = process.env.BUILD_CHANNEL?.trim();

const baseConfig: NextConfig = {
  distDir: channel ? `.next-${channel}` : ".next",
  // Expose Bunny pull-zone base to the client so ImageUpload can detect Bunny URLs for remote delete.
  env: {
    NEXT_PUBLIC_BUNNY_CDN_PUBLIC_URL: process.env.BUNNY_CDN_PUBLIC_URL ?? '',
  },
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
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

};

const isProd = process.env.NODE_ENV === 'production';

export default withPWA({
  dest: 'public',
  disable: !isProd,
  register: true,
  skipWaiting: true,
})(baseConfig);

