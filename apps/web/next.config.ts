import { validateProductionWebEnvironment } from "@deepread/env/web";
import { webServerEnv } from "@deepread/env/web-server";
import type { NextConfig } from "next";

validateProductionWebEnvironment();

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  async headers() {
    const noStoreHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store, max-age=0",
      },
    ];

    return [
      {
        source: "/api/auth/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/trpc/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${webServerEnv.API_UPSTREAM_URL}/api/auth/:path*`,
      },
      {
        source: "/trpc/:path*",
        destination: `${webServerEnv.API_UPSTREAM_URL}/trpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
