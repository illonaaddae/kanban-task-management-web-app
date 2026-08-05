import type { Server } from "node:http";
import app from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  // Connect before listening so the instance never accepts traffic it cannot
  // serve — Render's health check will just retry until this resolves.
  await connectDB();

  server = app.listen(env.PORT, () => {
    logger.info(
      `Kanban API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
    );
    logger.info(`CORS origin: ${env.FRONTEND_URL}`);
    if (!env.googleOAuthEnabled) {
      logger.warn(
        "Google OAuth not configured — /auth/google is disabled, email/password auth still works",
      );
    }
  });
}

async function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ reason }, "Shutting down");

  // Backstop: if a socket refuses to drain, exit anyway rather than hang
  // forever and stall the platform's deploy.
  const force = setTimeout(() => {
    logger.fatal("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  force.unref();

  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info("HTTP server closed");
    }
    await disconnectDB();
  } catch (err) {
    logger.error({ err }, "Error during shutdown");
    exitCode = 1;
  }

  clearTimeout(force);
  process.exit(exitCode);
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  void shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  // Process state is unknown after this — drain and let the platform restart us.
  logger.fatal({ err }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
