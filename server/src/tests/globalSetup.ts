import { MongoMemoryServer } from "mongodb-memory-server";

declare global {
  // eslint-disable-next-line no-var
  var __MONGO_SERVER__: MongoMemoryServer | undefined;
}

/**
 * Boots a single in-memory MongoDB for the entire jest run and publishes its
 * URI on process.env, which jest propagates to every worker.
 *
 * One instance per run rather than per suite: spawning the ~170MB mongod
 * binary repeatedly is what pushes cold starts past the default timeout.
 */
export default async function globalSetup(): Promise<void> {
  const server = await MongoMemoryServer.create({
    instance: { storageEngine: "wiredTiger" },
  });

  globalThis.__MONGO_SERVER__ = server;
  process.env.MONGO_URI = server.getUri();
}
