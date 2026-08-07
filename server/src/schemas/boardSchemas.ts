import { z } from "zod";
import { COLLABORATOR_ROLES } from "../models/Board";
import { objectIdSchema } from "./commonSchemas";

const titleField = z
  .string()
  .trim()
  .min(1, "Board title is required")
  .max(120, "Board title cannot exceed 120 characters");

/**
 * The API stores `title`, but the existing frontend has always spoken `name`
 * (and reads it back from the `name` virtual). Accept either on input and
 * normalise to `title` here, so the alias is handled in one place rather than
 * leaking into the service or the client.
 */
const titleOrName = z
  .object({
    title: titleField.optional(),
    name: titleField.optional(),
    /**
     * Makes this a team board. `null` detaches it, making it personal again -
     * distinct from omitting the key, which leaves the current team alone.
     */
    organizationId: objectIdSchema.nullable().optional(),
  })
  .refine((data) => Boolean(data.title ?? data.name), {
    path: ["title"],
    message: "Board title is required",
  })
  .transform((data) => ({
    title: (data.title ?? data.name) as string,
    // Preserved only when present, so "leave it alone" and "detach it" stay
    // different instructions after the transform drops everything else.
    ...(data.organizationId !== undefined
      ? { organizationId: data.organizationId }
      : {}),
  }));

export const createBoardSchema = titleOrName;
export const updateBoardSchema = titleOrName;

export const addCollaboratorSchema = z.object({
  email: z.email("Must be a valid email address"),
  role: z
    .enum(COLLABORATOR_ROLES, "Collaborator role must be either editor or viewer")
    .default("editor"),
});

export const updateCollaboratorSchema = z.object({
  role: z.enum(
    COLLABORATOR_ROLES,
    "Collaborator role must be either editor or viewer",
  ),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type AddCollaboratorInput = z.infer<typeof addCollaboratorSchema>;
export type UpdateCollaboratorInput = z.infer<typeof updateCollaboratorSchema>;
