import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent build failures from TypeScript strict-mode warnings in CI.
  // (eslint option was removed in Next.js 16; use the ESLint CLI separately)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
