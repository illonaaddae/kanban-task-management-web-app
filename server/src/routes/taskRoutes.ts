import { Router } from "express";
import {
  createTask,
  deleteTask,
  getTask,
  moveTask,
  updateTask,
} from "../controllers/taskController";
import { listMyTasks } from "../controllers/progressController";
import { protect } from "../middlewares/auth";
import { boardAccess } from "../middlewares/boardAccess";
import { loadTask } from "../middlewares/loadTask";
import { validate } from "../middlewares/validate";
import { idParamSchema } from "../schemas/commonSchemas";
import {
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
} from "../schemas/taskSchemas";

const router = Router();

router.use(protect);

/**
 * Everything assigned to the caller. Declared before "/:id" so "mine" is never
 * parsed as a task id, and needs no boardAccess: it resolves the caller's own
 * boards internally rather than being scoped to one.
 */
router.get("/mine", listMyTasks);

// The board comes from the validated body - boardAccess resolves it there.
router.post("/", validate(createTaskSchema), boardAccess("editor"), createTask);

// Drag-and-drop persistence. Registered before "/:id" for readability; the
// paths differ so Express matches them independently either way.
router.patch(
  "/:id/move",
  validate(idParamSchema, "params"),
  validate(moveTaskSchema),
  loadTask,
  boardAccess("editor"),
  moveTask,
);

router
  .route("/:id")
  .get(
    validate(idParamSchema, "params"),
    loadTask,
    boardAccess("viewer"),
    getTask,
  )
  .put(
    validate(idParamSchema, "params"),
    validate(updateTaskSchema),
    loadTask,
    boardAccess("editor"),
    updateTask,
  )
  // PUT and PATCH are both partial here [Lab 2 fix] - the frontend sends
  // whichever it has, and subtask toggling arrives through this route.
  .patch(
    validate(idParamSchema, "params"),
    validate(updateTaskSchema),
    loadTask,
    boardAccess("editor"),
    updateTask,
  )
  .delete(
    validate(idParamSchema, "params"),
    loadTask,
    boardAccess("editor"),
    deleteTask,
  );

export default router;
