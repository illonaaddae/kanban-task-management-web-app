import { Router } from "express";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  inviteMember,
  listInvitations,
  listMembers,
  listOrganizations,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  updateOrganization,
} from "../controllers/organizationController";
import { protect } from "../middlewares/auth";
import { orgAccess } from "../middlewares/orgAccess";
import { validate } from "../middlewares/validate";
import { idParamSchema } from "../schemas/commonSchemas";
import {
  createOrganizationSchema,
  inviteMemberSchema,
  orgInvitationParamsSchema,
  orgUserParamsSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "../schemas/organizationSchemas";

const router = Router();

// Every organization route requires a valid access token.
router.use(protect);

router.get("/", listOrganizations);
router.post("/", validate(createOrganizationSchema), createOrganization);

// Param validation runs before orgAccess so a malformed id is a 400 rather than
// a cast error inside the lookup.
router
  .route("/:id")
  .get(validate(idParamSchema, "params"), orgAccess("member"), getOrganization)
  .patch(
    validate(idParamSchema, "params"),
    validate(updateOrganizationSchema),
    orgAccess("owner"),
    updateOrganization,
  )
  .delete(
    validate(idParamSchema, "params"),
    orgAccess("owner"),
    deleteOrganization,
  );

router.get(
  "/:id/members",
  validate(idParamSchema, "params"),
  orgAccess("member"),
  listMembers,
);

router
  .route("/:id/members/:userId")
  .patch(
    validate(orgUserParamsSchema, "params"),
    validate(updateMemberRoleSchema),
    orgAccess("orgAdmin"),
    updateMemberRole,
  )
  // `member`, not `orgAdmin`: leaving is a member's own business. The controller
  // demands admin when the target is somebody else.
  .delete(
    validate(orgUserParamsSchema, "params"),
    orgAccess("member"),
    removeMember,
  );

// Inviting is an admin-and-above action — it grants access to the team's work.
router
  .route("/:id/invitations")
  .get(validate(idParamSchema, "params"), orgAccess("orgAdmin"), listInvitations)
  .post(
    validate(idParamSchema, "params"),
    validate(inviteMemberSchema),
    orgAccess("orgAdmin"),
    inviteMember,
  );

router.delete(
  "/:id/invitations/:invitationId",
  validate(orgInvitationParamsSchema, "params"),
  orgAccess("orgAdmin"),
  revokeInvitation,
);

export default router;
