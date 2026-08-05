import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

// Reject queries against fields not in the schema instead of silently
// matching everything.
mongoose.set("strictQuery", true);

const READY_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export function dbState(): string {
  return READY_STATES[mongoose.connection.readyState] ?? "unknown";
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function connectDB(uri: string = env.DATABASE_URL): Promise<void> {
  mongoose.connection.on("error", (err) => {
    logger.error({ err }, "MongoDB connection error");
  });
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
  });

  logger.info(
    { db: mongoose.connection.name },
    "MongoDB connected",
  );
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close(false);
  logger.info("MongoDB connection closed");
}
