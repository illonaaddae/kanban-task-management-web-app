import cors from "cors";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import authRoutes from "./routes/authRoutes";
import boardRoutes from "./routes/boardRoutes";
import invitationRoutes from "./routes/invitationRoutes";
import organizationRoutes from "./routes/organizationRoutes";
import columnRoutes from "./routes/columnRoutes";
import healthRoutes from "./routes/healthRoutes";
import taskRoutes from "./routes/taskRoutes";
import userRoutes from "./routes/userRoutes";

const app: Express = express();

// Render terminates TLS at its proxy — without this req.protocol/ip are wrong.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  pinoHttp({
    logger,
    // Health checks fire constantly on Render; logging them buries real traffic.
    autoLogging: {
      ignore: (req) => req.url === "/health",
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res) {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
  }),
);

// Bearer tokens, not cookies — no `credentials` flag needed, but the origin
// is still locked to the deployed frontend.
app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/boards", boardRoutes);
app.use("/orgs", organizationRoutes);
app.use("/invitations", invitationRoutes);
app.use("/columns", columnRoutes);
app.use("/tasks", taskRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
