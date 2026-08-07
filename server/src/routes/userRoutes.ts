import { Router } from "express";
import { listUsers, updateMe } from "../controllers/userController";
import { protect, restrictTo } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { updateMeSchema } from "../schemas/userSchemas";

const router = Router();

// Everything below requires a valid access token.
router.use(protect);

router.patch("/me", validate(updateMeSchema), updateMe);

// Platform admins only - 403 for any other authenticated role.
router.get("/", restrictTo("admin"), listUsers);

export default router;
