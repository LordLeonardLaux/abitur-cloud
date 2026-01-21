import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  output: process.env.IS_STATIC_BUILD === 'true' ? 'export' : undefined,

  // Ensure trailing slashes for proper file routing in Electron
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
