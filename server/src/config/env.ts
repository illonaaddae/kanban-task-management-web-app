import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Resolve .env relative to the server/ root so it works from both
// src/ (tsx dev) and dist/ (compiled). dotenv never overrides variables
// already present on process.env — the deployment platform wins.
loadDotenv({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Not 5000: macOS Control Center's AirPlay Receiver squats on that port
    // and answers every request with a bodyless 403.
    PORT: z.coerce.number().int().positive().max(65535).default(5050),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_EXPIRES_IN: z.string().min(1).default("1h"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default("7d"),

    FRONTEND_URL: z.url("FRONTEND_URL must be a valid URL").default("http://localhost:5173"),

    // Optional — the app boots and serves email/password auth without them.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.url("GOOGLE_REDIRECT_URI must be a valid URL").optional(),

    // Optional — without it invitations are still created, the link is just
    // logged instead of emailed (see emailService).
    RESEND_API_KEY: z.string().min(1).optional(),
    // `onboarding@resend.dev` is Resend's shared sandbox sender: it works with no
    // domain set up, but only delivers to the address that owns the API key.
    // Point this at a verified domain to reach anyone else.
    EMAIL_FROM: z.string().min(1).default("Kanban <onboarding@resend.dev>"),
    /** How long an organization invitation link stays valid. */
    INVITATION_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(7),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  // All-or-nothing: a half-configured OAuth client fails at redirect time with
  // an opaque Google error, so catch it at boot instead.
  .refine(
    (e) => {
      const parts = [
        e.GOOGLE_CLIENT_ID,
        e.GOOGLE_CLIENT_SECRET,
        e.GOOGLE_REDIRECT_URI,
      ];
      const present = parts.filter(Boolean).length;
      return present === 0 || present === 3;
    },
    {
      path: ["GOOGLE_CLIENT_ID"],
      message:
        "Google OAuth is partially configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI together, or none of them",
    },
  )
  // Refuse to run production on the committed dev secrets.
  .refine(
    (e) =>
      e.NODE_ENV !== "production" || e.JWT_SECRET !== e.JWT_REFRESH_SECRET,
    {
      path: ["JWT_REFRESH_SECRET"],
      message:
        "JWT_SECRET and JWT_REFRESH_SECRET must differ in production — a shared secret lets an access token be replayed as a refresh token",
    },
  );

// `FOO=` in a .env file yields an empty string, not an absent key — which
// would fail `.min(1).optional()` instead of being treated as "not set".
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ""),
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  // Logger depends on env, so this one case has to use console.
  const lines = parsed.error.issues.map((issue) => {
    const field = issue.path.join(".") || "(root)";
    return `  • ${field}: ${issue.message}`;
  });
  console.error(
    `\n Invalid environment configuration:\n${lines.join("\n")}\n\n` +
      ` Copy server/.env.example to server/.env and fill in the missing values.\n`,
  );
  process.exit(1);
}

const data = parsed.data;

export const env = {
  ...data,
  // Listed explicitly so the keys always exist, holding `undefined` when unset.
  // Zod omits an absent `.optional()` field entirely, which would leave the
  // config a different *shape* depending on the deployment — awkward to reason
  // about, and it breaks anything that reads or overrides the property.
  GOOGLE_CLIENT_ID: data.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: data.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: data.GOOGLE_REDIRECT_URI,
  RESEND_API_KEY: data.RESEND_API_KEY,

  isProduction: data.NODE_ENV === "production",
  isTest: data.NODE_ENV === "test",
  isDevelopment: data.NODE_ENV === "development",
  /** True when outbound email can actually be delivered. */
  emailEnabled: Boolean(data.RESEND_API_KEY),
  /** True only when the full Google OAuth triple is configured. */
  googleOAuthEnabled: Boolean(
    data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET && data.GOOGLE_REDIRECT_URI,
  ),
} as const;

export type Env = typeof env;
