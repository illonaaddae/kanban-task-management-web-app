import { Router } from "express";
import {
  acceptInvitation,
  acceptMyInvitation,
  listMyInvitations,
  previewInvitation,
} from "../controllers/invitationController";
import { protect } from "../middlewares/auth";
import { validate } from "../middlewares/validate";
import {
  invitationIdParamsSchema,
  invitationTokenParamsSchema,
} from "../schemas/organizationSchemas";

const router = Router();

/**
 * Waiting for the caller's own address. Declared before `/:token` so "mine" is
 * never parsed as a token.
 */
router.get("/mine", protect, listMyInvitations);

// Also under /mine, so it is matched by the literal segment rather than parsed
// as a token.
router.post(
  "/mine/:invitationId/accept",
  protect,
  validate(invitationIdParamsSchema, "params"),
  acceptMyInvitation,
);

// Unauthenticated: the invitee may not have an account yet, and this is what
// tells them which address to register with. The token is the credential.
router.get(
  "/:token",
  validate(invitationTokenParamsSchema, "params"),
  previewInvitation,
);

// Accepting needs a session - the invitation is redeemed *for* an account, and
// the service checks that account's address matches the invited one.
router.post(
  "/:token/accept",
  protect,
  validate(invitationTokenParamsSchema, "params"),
  acceptInvitation,
);

export default router;
