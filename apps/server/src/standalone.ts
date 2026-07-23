import prisma from "@deepread/db";
import { env } from "@deepread/env/server";

import app from "./express-app";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const FORCED_DISCONNECT_TIMEOUT_MS = 2_000;
const server = app.listen(env.PORT, () => {
  console.info("[Server] Listening", {
    port: env.PORT,
  });
});

let shuttingDown = false;

async function shutdown(signal: "SIGINT" | "SIGTERM") {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.info("[Server] Shutdown started", { signal });

  const forceCloseConnections = setTimeout(() => {
    console.error("[Server] Shutdown timed out", {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    server.closeAllConnections?.();
  }, SHUTDOWN_TIMEOUT_MS);
  forceCloseConnections.unref?.();
  const forcedExit = setTimeout(() => {
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS + FORCED_DISCONNECT_TIMEOUT_MS);
  forcedExit.unref?.();

  server.close(async (error) => {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("[Server] Database disconnect failed", {
        errorType: disconnectError instanceof Error ? disconnectError.name : typeof disconnectError,
      });
      process.exitCode = 1;
    } finally {
      clearTimeout(forceCloseConnections);
      clearTimeout(forcedExit);
    }

    if (error) {
      console.error("[Server] HTTP shutdown failed", {
        errorType: error.name,
      });
      process.exitCode = 1;
    } else {
      console.info("[Server] Shutdown complete", { signal });
    }
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
