import { z } from "zod";

/** 24-character hex — a Mongo ObjectId. */
export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a valid id");

export const idParamSchema = z.object({ id: objectIdSchema });

export const boardUserParamsSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type BoardUserParams = z.infer<typeof boardUserParamsSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
