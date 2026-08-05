import { z } from "zod";
import { objectIdSchema } from "./commonSchemas";

export const subtaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Subtask title is required")
    .max(200, "Subtask title cannot exceed 200 characters"),
  isCompleted: z.boolean().default(false),
});

const titleField = z
  .string()
  .trim()
  .min(1, "Task title is required")
  .max(200, "Task title cannot exceed 200 characters");

const descriptionField = z
  .string()
  .trim()
  .max(2000, "Description cannot exceed 2000 characters");

export const createTaskSchema = z.object({
  boardId: objectIdSchema,
  columnId: objectIdSchema,
  title: titleField,
  description: descriptionField.default(""),
  subtasks: z.array(subtaskSchema).default([]),
  dueDate: z.coerce.date("Due date must be a valid date").nullable().optional(),
  assignedTo: objectIdSchema.nullable().optional(),
});

/**
 * Rejects a field that belongs to the move endpoint instead of silently
 * dropping it — a client that PATCHes `{ columnId }` expecting a move would
 * otherwise get a 200 and no move.
 */
function belongsToMove(field: string) {
  return z
    .any()
    .refine((value) => value === undefined, {
      message: `Use PATCH /tasks/:id/move to change ${field}`,
    })
    .optional();
}

export const updateTaskSchema = z
  .object({
    title: titleField.optional(),
    description: descriptionField.optional(),
    subtasks: z.array(subtaskSchema).optional(),
    dueDate: z.coerce.date("Due date must be a valid date").nullable().optional(),
    assignedTo: objectIdSchema.nullable().optional(),

    columnId: belongsToMove("a task's column"),
    position: belongsToMove("a task's position"),
    status: belongsToMove("a task's status"),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export const moveTaskSchema = z.object({
  columnId: objectIdSchema,
  position: z.coerce
    .number("Position must be a number")
    .int("Position must be a whole number")
    .min(0, "Position cannot be negative"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type SubtaskInput = z.infer<typeof subtaskSchema>;
