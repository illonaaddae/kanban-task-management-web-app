import { z } from "zod";

/**
 * Input bounds are the first line of cost control: a pasted document must not
 * become the prompt. The service clamps again, because a schema change should not
 * silently raise the ceiling on spend.
 */
export const suggestTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the task a title of at least 3 characters")
    .max(200, "Titles cannot exceed 200 characters"),
  /** Board name and column names, so the suggestion matches its surroundings. */
  context: z.string().trim().max(300).optional().default(""),
});

export const planTeamSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, "Describe the team in a sentence or two")
    .max(600, "Keep it under 600 characters"),
});

export type SuggestTaskInput = z.infer<typeof suggestTaskSchema>;
export type PlanTeamInput = z.infer<typeof planTeamSchema>;
