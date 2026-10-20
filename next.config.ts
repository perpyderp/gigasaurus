import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // public/ is served from the CDN, never read by server code. Keep it out of
  // traced function bundles so a dynamic fs path can't pull in ~800 MB of images.
  outputFileTracingExcludes: {
    "/*": ["public/**/*"],
  },
};

export default nextConfig;
