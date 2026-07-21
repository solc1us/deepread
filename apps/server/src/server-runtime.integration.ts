import { once } from "node:events";
import type { Server } from "node:http";

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import prisma from "@deepread/db";
import type { Express } from "express";

import app, { createApp } from "./app";

setDefaultTimeout(15_000);

async function withServer<T>(expressApp: Express, operation: (baseUrl: string) => Promise<T>) {
  const server = expressApp.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("The isolated HTTP test server did not expose a TCP address.");
  }

  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
  }
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function captureErrorLogs<T>(operation: () => Promise<T>) {
  const originalError = console.error;
  const entries: unknown[][] = [];
  console.error = (...values: unknown[]) => {
    entries.push(values);
  };

  try {
    return {
      result: await operation(),
      entries,
    };
  } finally {
    console.error = originalError;
  }
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("server app runtime", () => {
  test("importing the app module does not open a listening port", async () => {
    const child = Bun.spawn(
      [process.execPath, "-e", "await import('./apps/server/src/app.ts')"],
      {
        cwd: process.cwd(),
        env: process.env,
        stdout: "ignore",
        stderr: "ignore",
      },
    );
    const exitCode = await Promise.race([
      child.exited,
      Bun.sleep(3_000).then(() => null),
    ]);

    if (exitCode === null) {
      child.kill();
    }
    expect(exitCode).toBe(0);
  });

  test("health is liveness-only and does not invoke the readiness database check", async () => {
    let readinessChecks = 0;
    const testApp = createApp({
      readinessCheck: async () => {
        readinessChecks += 1;
        throw new Error("This readiness dependency must not run for liveness.");
      },
    });

    await withServer(testApp, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/health`);
      const body = (await response.json()) as { status: string; requestId: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe("ok");
      expect(response.headers.get("x-request-id")).toBe(body.requestId);
    });
    expect(readinessChecks).toBe(0);
  });

  test("readiness succeeds against the isolated local database", async () => {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ready`);
      const body = (await response.json()) as { status: string; requestId: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe("ready");
      expect(response.headers.get("x-request-id")).toBe(body.requestId);
    });
  });

  test("readiness failure is non-2xx and exposes no infrastructure details", async () => {
    const requestId = "readiness-test-request";
    const testApp = createApp({
      readinessCheck: async () => {
        throw new Error(
          "Prisma Invalid invocation C:\\private\\node_modules SELECT DATABASE_URL /home/service",
        );
      },
    });
    const { result, entries } = await captureErrorLogs(() =>
      withServer(testApp, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/ready`, {
          headers: { "x-request-id": requestId },
        });
        return {
          response,
          text: await response.text(),
        };
      }),
    );

    expect(result.response.status).toBe(503);
    expect(result.response.headers.get("x-request-id")).toBe(requestId);
    expect(result.text).toContain("Database readiness check failed.");
    expect(result.text).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL|\/home\//,
    );
    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).toContain(requestId);
    expect(serializedLogs).toContain("readiness_check");
    expect(serializedLogs).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL|\/home\//,
    );
  });

  test("valid request IDs propagate and invalid values are replaced", async () => {
    await withServer(createApp(), async (baseUrl) => {
      const accepted = await fetch(`${baseUrl}/health`, {
        headers: { "x-request-id": "client-request_123" },
      });
      const generated = await fetch(`${baseUrl}/health`, {
        headers: { "x-request-id": "invalid/request/id" },
      });

      expect(accepted.headers.get("x-request-id")).toBe("client-request_123");
      expect(generated.headers.get("x-request-id")).not.toBe("invalid/request/id");
      expect(generated.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  test("unexpected Express errors return and log only sanitized correlated context", async () => {
    const requestId = "express-error-request";
    const testApp = createApp({
      registerTestRoutes(testRoutes) {
        testRoutes.get("/__integration/error", () => {
          throw new Error(
            "Prisma Invalid invocation C:\\private\\node_modules SELECT DATABASE_URL /home/service",
          );
        });
      },
    });
    const { result, entries } = await captureErrorLogs(() =>
      withServer(testApp, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/__integration/error`, {
          headers: { "x-request-id": requestId },
        });
        return {
          response,
          text: await response.text(),
        };
      }),
    );

    expect(result.response.status).toBe(500);
    expect(result.response.headers.get("x-request-id")).toBe(requestId);
    expect(result.text).toContain("Internal server error.");
    expect(result.text).toContain(requestId);
    expect(result.text).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL|\/home\//,
    );
    const serializedLogs = JSON.stringify(entries);
    expect(serializedLogs).toContain(requestId);
    expect(serializedLogs).toContain("express_request");
    expect(serializedLogs).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL|\/home\//,
    );
  });

  test("unexpected tRPC errors use the shared sanitized error formatter", async () => {
    const [{ fetchRequestHandler }, { t }] = await Promise.all([
      import("@trpc/server/adapters/fetch"),
      import("@deepread/api"),
    ]);
    const testRouter = t.router({
      explode: t.procedure.query(() => {
        throw new Error(
          "Prisma Invalid invocation C:\\private\\node_modules SELECT DATABASE_URL /home/service",
        );
      }),
    });
    const response = await fetchRequestHandler({
      endpoint: "/trpc",
      req: new Request("http://localhost/trpc/explode"),
      router: testRouter,
      createContext: () => ({
        auth: null,
        session: null,
        requestId: "trpc-error-request",
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("Internal server error.");
    expect(text).toContain("trpc-error-request");
    expect(text).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL|\/home\//,
    );
  });
});
