import { createContext } from "@deepread/api/context";
import { appRouter } from "@deepread/api/routers/index";
import { auth } from "@deepread/auth";
import prisma from "@deepread/db";
import { env } from "@deepread/env/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express, { type Express } from "express";

import {
  getRequestId,
  logSanitizedRequestFailure,
  requestIdMiddleware,
} from "./request-id";

const READINESS_TIMEOUT_MS = 2_000;

export interface CreateAppOptions {
  readinessCheck?: () => Promise<void>;
  registerTestRoutes?: (app: Express) => void;
}

async function defaultReadinessCheck() {
  await prisma.$queryRaw`SELECT 1`;
}

function runWithTimeout(operation: () => Promise<void>, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Readiness check timed out"));
    }, timeoutMs);
    timeout.unref?.();

    operation().then(
      () => {
        clearTimeout(timeout);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function isUnexpectedTrpcFailure(error: {
  code: string;
  cause?: unknown;
}) {
  return error.code === "INTERNAL_SERVER_ERROR" && error.cause instanceof Error;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const readinessCheck = options.readinessCheck ?? defaultReadinessCheck;

  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id"],
      credentials: true,
    }),
  );

  app.get("/", (_request, response) => {
    response.status(200).send("OK");
  });

  app.get("/health", (request, response) => {
    response.status(200).json({
      status: "ok",
      requestId: getRequestId(request),
    });
  });

  app.get("/ready", async (request, response) => {
    const requestId = getRequestId(request);

    try {
      await runWithTimeout(readinessCheck, READINESS_TIMEOUT_MS);
      response.status(200).json({
        status: "ready",
        requestId,
      });
    } catch (error) {
      logSanitizedRequestFailure(error, {
        operation: "readiness_check",
        requestId,
        method: request.method,
        path: request.path,
      });
      response.status(503).json({
        status: "not_ready",
        requestId,
        message: "Database readiness check failed.",
      });
    }
  });

  app.all("/api/auth{/*path}", toNodeHandler(auth));

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, req }) {
        if (!isUnexpectedTrpcFailure(error)) {
          return;
        }

        logSanitizedRequestFailure(error.cause, {
          operation: "trpc_request",
          requestId: getRequestId(req),
          method: req.method,
          path: path ?? "unknown",
        });
      },
    }),
  );

  app.use(express.json());

  if (options.registerTestRoutes) {
    if (env.NODE_ENV !== "test") {
      throw new Error("Test routes can only be registered in test mode.");
    }
    options.registerTestRoutes(app);
  }

  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const requestId = getRequestId(request);
    logSanitizedRequestFailure(error, {
      operation: "express_request",
      requestId,
      method: request.method,
      path: request.path,
    });
    response.status(500).json({
      error: "Internal server error.",
      requestId,
    });
  });

  return app;
}

export const app = createApp();

export default app;
