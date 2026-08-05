import { z } from "zod";
import { objectIdSchema } from "./commonSchemas";

const titleField = z
  .string()
  .trim()
  .min(1, "Column title is required")
  .max(80, "Column title cannot exceed 80 characters");

/**
 * Same `title`/`name` alias as boards — the frontend's `Column` type has
 * always used `name`, and the model exposes it back as a virtual.
 */
const titleOrName = z
  .object({
    title: titleField.optional(),
    name: titleField.optional(),
  })
  .refine((data) => Boolean(data.title ?? data.name), {
    path: ["title"],
    message: "Column title is required",
  })
  .transform((data) => ({ title: (data.title ?? data.name) as string }));

export const createColumnSchema = titleOrName;
export const updateColumnSchema = titleOrName;

export const reorderColumnsSchema = z.object({
  orderedColumnIds: z
    .array(objectIdSchema, "orderedColumnIds must be an array of column ids")
    .min(1, "orderedColumnIds cannot be empty"),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
