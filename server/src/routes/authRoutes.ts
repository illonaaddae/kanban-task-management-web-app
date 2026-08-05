import { Router } from "express";
import {
  getMe,
  login,
  logout,
  refresh,
  register,
} from "../controllers/authController";
import {
  googleCallback,
  googleRedirect,
} from "../controllers/googleAuthController";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import { loginSchema, refreshSchema, registerSchema } from "../schemas/authSchemas";

const router = Router();

// Public
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);

// Google OAuth. Both return 503 when the GOOGLE_* keys are unset, so the app
// boots and serves email/password auth without any OAuth configuration.
// The query string is read directly rather than through `validate`: Google owns
// this callback's shape, and a missing `code` or `state` must produce our own
// precise 400/403, not a generic validation envelope.
router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

// Authenticated
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

export default router;
