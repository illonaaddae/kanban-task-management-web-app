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
