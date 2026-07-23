import { validateProductionWebEnvironment } from "@deepread/env/web";
import type { NextConfig } from "next";

validateProductionWebEnvironment();

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
};

export default nextConfig;
