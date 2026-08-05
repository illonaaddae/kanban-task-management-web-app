export default async function globalTeardown(): Promise<void> {
  await globalThis.__MONGO_SERVER__?.stop();
  globalThis.__MONGO_SERVER__ = undefined;
}
