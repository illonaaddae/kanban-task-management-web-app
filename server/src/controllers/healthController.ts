import type { Request, Response } from "express";
import { dbState, isDbConnected } from "../config/db";
import { env } from "../config/env";

/**
 * GET /health — liveness probe for Render.
 *
 * Returns 200 while the process is up and Mongo is reachable, 503 otherwise,
 * so a half-dead instance (process alive, DB gone) fails the health check
 * instead of quietly serving 500s.
 */
export function getHealth(_req: Request, res: Response): void {
  const healthy = isDbConnected();

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "success" : "error",
    data: {
      status: healthy ? "ok" : "degraded",
      uptime: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: dbState(),
    },
  });
}
