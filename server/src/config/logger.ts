import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.isTest ? "silent" : env.LOG_LEVEL,

  // Never let a credential reach the log sink — Render retains logs, and an
  // Authorization header logged once is a token leaked for its whole lifetime.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "password",
      "*.password",
      "*.passwordConfirm",
      "token",
      "*.token",
      "accessToken",
      "*.accessToken",
      "refreshToken",
      "*.refreshToken",
      "client_secret",
      "*.client_secret",
    ],
    censor: "[REDACTED]",
  },

  ...(env.isDevelopment && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

export default logger;
