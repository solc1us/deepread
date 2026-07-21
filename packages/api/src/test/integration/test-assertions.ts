import { expect } from "bun:test";

import type { TRPCError } from "@trpc/server";

export async function expectTrpcError(promise: Promise<unknown>, code: TRPCError["code"], message?: string) {
  try {
    await promise;
    throw new Error(`Expected ${code} tRPC error.`);
  } catch (error) {
    const trpcError = error as { code?: string; message?: string };
    expect(trpcError.code).toBe(code);
    if (message) {
      expect(trpcError.message).toBe(message);
    }
  }
}
