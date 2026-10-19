import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The hosted-mode e2e build uses its own directory so it doesn't clobber .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
