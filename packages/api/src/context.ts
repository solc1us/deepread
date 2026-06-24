import { auth } from "@deepread/auth";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";

function getHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function createContext(opts: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(opts.req.headers),
  });
  return {
    auth: null,
    adminSecret: getHeaderValue(opts.req.headers["x-admin-secret"]),
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
