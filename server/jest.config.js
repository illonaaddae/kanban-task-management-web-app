/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],

  // Starts one in-memory MongoDB for the whole run and publishes MONGO_URI.
  globalSetup: "<rootDir>/src/tests/globalSetup.ts",
  globalTeardown: "<rootDir>/src/tests/globalTeardown.ts",

  // Runs before the module registry loads any test file, so config/env.ts sees
  // a valid environment at import time.
  setupFiles: ["<rootDir>/src/tests/env.setup.ts"],
  // Runs after the test framework is installed — connects this worker.
  setupFilesAfterEnv: ["<rootDir>/src/tests/setup.ts"],

  clearMocks: true,
  // Also restore spies and `jest.replaceProperty` overrides between tests.
  // Without this, a replaced property (e.g. an env flag switched on for one
  // describe block) leaks into every test that runs after it — which silently
  // depends on file ordering.
  restoreMocks: true,
  testTimeout: 30_000,

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/tests/**",
    "!src/seed/**",
    "!src/server.ts",
  ],

  // The two layers that hold the business rules and the authorisation checks
  // are held to 80%. The global floor is deliberately lower: type-only files,
  // model declarations and route wiring inflate the denominator without
  // carrying logic worth asserting.
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    "src/services/**/*.ts": {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    "src/middlewares/**/*.ts": {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};
