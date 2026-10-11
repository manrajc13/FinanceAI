import type { NextConfig } from "next";

// Deployed (Vercel): NEXT_PUBLIC_API_URL is the Render URL and the browser calls it directly.
// Local dev: leave it unset; /api/* is proxied to uvicorn below.
const devApi = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [{ source: "/api/:path*", destination: `${devApi}/api/:path*` }];
  },
  experimental: {
    // Dev proxy only: an AI explanation can take ~60 s (two 30 s Groq requests).
    proxyTimeout: 90_000,
  },
};

export default nextConfig;
