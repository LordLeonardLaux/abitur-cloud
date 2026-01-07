import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Ensure trailing slashes for proper file routing in Electron
  trailingSlash: true,
};

export default nextConfig;
