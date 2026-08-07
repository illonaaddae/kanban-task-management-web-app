import { z } from "zod";
import { objectIdSchema } from "./commonSchemas";

/**
 * A natural-language instruction about one board.
 *
 * Scoped to a board on purpose: it bounds what the model is asked to reason about,
 * and it means the caller's permission on that board is checked before anything is
 * interpreted.
 */
export const interpretCommandSchema = z.object({
  boardId: objectIdSchema,
  instruction: z
    .string()
    .trim()
    .min(4, "Say what you want to do")
    .max(300, "Keep it under 300 characters"),
});

export type InterpretCommandInput = z.infer<typeof interpretCommandSchema>;

/**
 * A conversation about one board.
 *
 * History comes from the client rather than a server-side session. That keeps the
 * feature stateless, but it means the bound on cost has to live here: without a cap
 * the transcript grows every turn and each request pays for all of it.
 */
export const chatSchema = z.object({
  boardId: objectIdSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(600),
      }),
    )
    .min(1, "Say something first")
    // Eight turns of context is plenty to follow a thread, and it stops one long
    // conversation from costing more than all the short ones put together.
    .max(8, "Only the last few messages are kept"),
});

export type ChatInput = z.infer<typeof chatSchema>;
