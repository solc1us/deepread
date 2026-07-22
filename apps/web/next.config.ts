import { warnAboutProductionWebOrigin } from "@deepread/env/web";
import type { NextConfig } from "next";

warnAboutProductionWebOrigin();

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
