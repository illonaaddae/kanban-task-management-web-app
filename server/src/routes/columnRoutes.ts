import { Router } from "express";
import { deleteColumn, updateColumn } from "../controllers/columnController";
import { protect } from "../middlewares/auth";
import { boardAccess } from "../middlewares/boardAccess";
import { loadColumn } from "../middlewares/loadColumn";
import { validate } from "../middlewares/validate";
import { updateColumnSchema } from "../schemas/columnSchemas";
import { idParamSchema } from "../schemas/commonSchemas";

const router = Router();

router.use(protect);

// The board is not in the path — loadColumn resolves it from column.boardId
// and boardAccess then applies the ordinary board-level check.
router
  .route("/:id")
  .put(
    validate(idParamSchema, "params"),
    validate(updateColumnSchema),
    loadColumn,
    boardAccess("editor"),
    updateColumn,
  )
  .delete(
    validate(idParamSchema, "params"),
    loadColumn,
    boardAccess("editor"),
    deleteColumn,
  );

export default router;
