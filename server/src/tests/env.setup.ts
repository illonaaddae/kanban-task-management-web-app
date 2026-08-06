/**
 * Test environment defaults.
 *
 * Loaded via jest `setupFiles`, i.e. before any test file imports
 * `config/env.ts`. Assigned with `??=` so a real .env or CI variable still
 * wins. DATABASE_URL is a placeholder — setup.ts swaps in the
 * mongodb-memory-server URI before connecting.
 */
process.env.NODE_ENV = "test";
process.env.PORT ??= "5051";
process.env.DATABASE_URL ??= "mongodb://127.0.0.1:27017/kanban-test";
process.env.JWT_SECRET ??= "test-jwt-secret-value-at-least-32-chars-long";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-value-at-least-32-chars";
process.env.JWT_EXPIRES_IN ??= "1h";
process.env.JWT_REFRESH_EXPIRES_IN ??= "7d";
process.env.FRONTEND_URL ??= "http://localhost:5173";
process.env.LOG_LEVEL ??= "silent";

/**
 * Force Google OAuth *off* for the suite, whatever the developer's `.env` says.
 *
 * `config/env.ts` loads `server/.env` through dotenv when it is imported — which
 * happens after this file runs — so a developer who has real GOOGLE_* keys
 * locally would otherwise see the "not configured" tests fail while CI passed.
 *
 * Empty string rather than `delete`, because that is what survives both layers:
 * dotenv skips a key already present in process.env, and `env.ts` strips empty
 * strings before parsing, so Zod sees the variables as genuinely absent. Tests
 * that need OAuth on switch it back on with `jest.replaceProperty`.
 */
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.GOOGLE_REDIRECT_URI = "";
