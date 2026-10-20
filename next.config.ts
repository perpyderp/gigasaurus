import type { NextConfig } from "next";

// Map selections live in the query string (?creature=, ?tab=, …). /maps/<slug> itself is
// prerendered, so any URL carrying one of these is served by the dynamic explore route instead.
const MAP_QUERY_KEYS = ["creature", "resource", "place", "tab", "q"];

const nextConfig: NextConfig = {
  // public/ is served from the CDN, never read by server code. Keep it out of
  // traced function bundles so a dynamic fs path can't pull in ~800 MB of images.
  outputFileTracingExcludes: {
    "/*": ["public/**/*"],
  },
  async rewrites() {
    return {
      beforeFiles: MAP_QUERY_KEYS.map((key) => ({
        source: "/maps/:slug",
        has: [{ type: "query" as const, key }],
        destination: "/maps/:slug/explore",
      })),
    };
  },
};

export default nextConfig;
