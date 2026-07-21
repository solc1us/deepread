import { auth } from "@deepread/auth";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { fromNodeHeaders } from "better-auth/node";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export interface Context {
  auth: null;
  session: AuthSession;
  requestId?: string;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<Context> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(opts.req.headers),
  });
  const requestIdHeader = opts.req.headers["x-request-id"];
  const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

  return {
    auth: null,
    session,
    ...(requestId ? { requestId } : {}),
  };
}
