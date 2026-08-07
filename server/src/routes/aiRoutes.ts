import { Router } from "express";
import {
  chat,
  getAiStatus,
  interpretCommand,
  planTeam,
  suggestTask,
} from "../controllers/aiController";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { planTeamSchema, suggestTaskSchema } from "../schemas/aiSchemas";
import { chatSchema, interpretCommandSchema } from "../schemas/commandSchemas";
import { boardAccess } from "../middlewares/boardAccess";

const router = Router();

/**
 * Every AI route requires a session.
 *
 * The key is the server's, and the spend is the server's, so an unauthenticated
 * caller must never be able to reach a model on this account.
 */
router.use(protect);

// Answers without a key configured, so the frontend can hide the buttons rather
// than offer something that 503s.
router.get("/status", getAiStatus);

router.post("/task-suggestion", validate(suggestTaskSchema), suggestTask);
router.post("/team-plan", validate(planTeamSchema), planTeam);

/**
 * Editor and above: the instruction describes a change, so somebody who could not
 * make that change has no business having it interpreted. `boardAccess` reads the
 * board id from the validated body.
 */
// A reply can carry a proposed change, so it needs the same access as making one.
router.post("/chat", validate(chatSchema), boardAccess("editor"), chat);

router.post(
  "/command",
  validate(interpretCommandSchema),
  boardAccess("editor"),
  interpretCommand,
);

export default router;
