import type { NextConfig } from "next";

const channel = process.env.BUILD_CHANNEL?.trim();

const nextConfig: NextConfig = {
  distDir: channel ? `.next-${channel}` : ".next",
  /* config options here */
};

export default nextConfig;
