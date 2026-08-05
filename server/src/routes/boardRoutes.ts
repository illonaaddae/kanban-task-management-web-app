import { Router } from "express";
import {
  addCollaborator,
  createBoard,
  deleteBoard,
  getBoard,
  getFullBoard,
  listBoards,
  removeCollaborator,
  updateBoard,
  updateCollaborator,
} from "../controllers/boardController";
import { getBoardActivity } from "../controllers/activityController";
import { createColumn, reorderColumns } from "../controllers/columnController";
import { protect } from "../middlewares/auth";
import { boardAccess } from "../middlewares/boardAccess";
import { validate } from "../middlewares/validate";
import {
  addCollaboratorSchema,
  createBoardSchema,
  updateBoardSchema,
  updateCollaboratorSchema,
} from "../schemas/boardSchemas";
import { createColumnSchema, reorderColumnsSchema } from "../schemas/columnSchemas";
import {
  boardUserParamsSchema,
  idParamSchema,
  paginationSchema,
} from "../schemas/commonSchemas";

const router = Router();

// Every board route requires a valid access token.
router.use(protect);

router.get("/", listBoards);
router.post("/", validate(createBoardSchema), createBoard);

// Param validation runs before boardAccess so a malformed id is a 400 rather
// than a cast error inside the lookup.
router
  .route("/:id")
  .get(validate(idParamSchema, "params"), boardAccess("viewer"), getBoard)
  .put(
    validate(idParamSchema, "params"),
    validate(updateBoardSchema),
    boardAccess("owner"),
    updateBoard,
  )
  .delete(validate(idParamSchema, "params"), boardAccess("owner"), deleteBoard);

// The nested board the frontend renders in one request.
router.get(
  "/:id/full",
  validate(idParamSchema, "params"),
  boardAccess("viewer"),
  getFullBoard,
);

router.get(
  "/:id/activity",
  validate(idParamSchema, "params"),
  validate(paginationSchema, "query"),
  boardAccess("viewer"),
  getBoardActivity,
);

// Columns belonging to a board. Mutations need editor or above.
router.post(
  "/:id/columns",
  validate(idParamSchema, "params"),
  validate(createColumnSchema),
  boardAccess("editor"),
  createColumn,
);

router.patch(
  "/:id/columns/reorder",
  validate(idParamSchema, "params"),
  validate(reorderColumnsSchema),
  boardAccess("editor"),
  reorderColumns,
);

// Collaborator management is owner-only.
router.post(
  "/:id/collaborators",
  validate(idParamSchema, "params"),
  validate(addCollaboratorSchema),
  boardAccess("owner"),
  addCollaborator,
);

router
  .route("/:id/collaborators/:userId")
  .patch(
    validate(boardUserParamsSchema, "params"),
    validate(updateCollaboratorSchema),
    boardAccess("owner"),
    updateCollaborator,
  )
  .delete(
    validate(boardUserParamsSchema, "params"),
    boardAccess("owner"),
    removeCollaborator,
  );

export default router;
