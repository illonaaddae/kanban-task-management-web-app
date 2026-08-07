import { Router } from "express";
import { getAiStatus, planTeam, suggestTask } from "../controllers/aiController";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { planTeamSchema, suggestTaskSchema } from "../schemas/aiSchemas";

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

export default router;
