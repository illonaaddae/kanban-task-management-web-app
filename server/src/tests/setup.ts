import mongoose from "mongoose";

/**
 * Connects each jest worker to the shared in-memory MongoDB started by
 * globalSetup. Each worker gets its own database so parallel suites cannot
 * clear each other's collections.
 */
beforeAll(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      "MONGO_URI is not set — globalSetup did not run. Check jest.config.js.",
    );
  }

  await mongoose.connect(uri, {
    dbName: `kanban-test-${process.env.JEST_WORKER_ID ?? "1"}`,
  });
});

// Wipe between tests so ordering never matters and a document leaked by one
// test cannot satisfy another's assertion.
afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;

  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.connection.close();
});
