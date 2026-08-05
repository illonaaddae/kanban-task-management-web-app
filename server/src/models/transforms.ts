import type { ToObjectOptions } from "mongoose";

/**
 * Shared toJSON options: expose `id` (from Mongoose's built-in virtual)
 * instead of `_id`, drop `__v`, and omit any sensitive paths.
 *
 * Every model uses this so the JSON shape the frontend receives is decided in
 * one place rather than per-controller.
 */
export function toJSONOptions(omit: readonly string[] = []): ToObjectOptions {
  return {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      // Mongoose types `ret` as the raw document shape, which makes the
      // required `_id` non-deletable; widen it for the rewrite.
      const out = ret as Record<string, unknown>;
      delete out._id;
      for (const path of omit) delete out[path];
      return out;
    },
  };
}
