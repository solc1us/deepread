import { createEnv } from "@t3-oss/env-core";

import {
  httpOriginSchema,
  validateProductionWebProxy,
} from "./environment-validation";
import { env as webEnv } from "./web";

const webServerSchema = {
  API_UPSTREAM_URL: httpOriginSchema("API_UPSTREAM_URL"),
};

export const webServerEnv = createEnv<undefined, typeof webServerSchema>({
  server: webServerSchema,
  runtimeEnv: {
    API_UPSTREAM_URL:
      process.env.API_UPSTREAM_URL ??
      (process.env.NODE_ENV === "production"
        ? undefined
        : "http://localhost:3000"),
  },
  emptyStringAsUndefined: true,
});

validateProductionWebProxy({
  nodeEnv: process.env.NODE_ENV,
  publicWebOrigin: webEnv.NEXT_PUBLIC_SERVER_URL,
  apiUpstreamUrl: webServerEnv.API_UPSTREAM_URL,
});
