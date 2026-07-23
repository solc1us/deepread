import { createEnv } from "@t3-oss/env-nextjs";

import { httpOriginSchema, validateProductionWebOrigin } from "./environment-validation";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_SERVER_URL: httpOriginSchema("NEXT_PUBLIC_SERVER_URL"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  },
  emptyStringAsUndefined: true,
});

export function validateProductionWebEnvironment() {
  validateProductionWebOrigin({
    nodeEnv: process.env.NODE_ENV,
    serverUrl: env.NEXT_PUBLIC_SERVER_URL,
  });
}
