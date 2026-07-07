import { env } from "@deepread/env/web";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
          input: false,
          required: false,
        },
      },
    }),
  ],
  sessionOptions: {
    refetchOnWindowFocus: false,
  },
});
