import type { Request, Response } from "express";
import type {
  CreateOrganizationInput,
  InviteMemberInput,
  OrgInvitationParams,
  OrgUserParams,
  UpdateMemberRoleInput,
  UpdateOrganizationInput,
} from "../schemas/organizationSchemas";
import { invitationService } from "../services/invitationService";
import { organizationService } from "../services/organizationService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

/**
 * `protect` guarantees req.user and `orgAccess` guarantees req.organization /
 * req.myOrgRole, but TypeScript only knows they are optional. Narrowed once here
 * so the handlers stay free of non-null assertions.
 */
function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
}

function requireOrg(req: Request) {
  if (!req.organization || !req.myOrgRole) {
    throw new AppError("Organization access was not resolved for this route", 500);
  }
  return { org: req.organization, myOrgRole: req.myOrgRole };
}

export const listOrganizations = catchAsync(async (req: Request, res: Response) => {
  const organizations = await organizationService.listForUser(requireUser(req));

  res.status(200).json({
    status: "success",
    data: { organizations, count: organizations.length },
  });
});

export const createOrganization = catchAsync(async (req: Request, res: Response) => {
  const { name } = req.body as CreateOrganizationInput;
  const organization = await organizationService.create(requireUser(req), name);

  res.status(201).json({ status: "success", data: { organization } });
});

export const getOrganization = catchAsync(async (req: Request, res: Response) => {
  const { org, myOrgRole } = requireOrg(req);
  const organization = await organizationService.getDetailed(
    org._id.toString(),
    myOrgRole,
  );

  res.status(200).json({ status: "success", data: { organization } });
});

export const updateOrganization = catchAsync(async (req: Request, res: Response) => {
  const { org } = requireOrg(req);
  const { name } = req.body as UpdateOrganizationInput;
  const organization = await organizationService.rename(org._id.toString(), name);

  res.status(200).json({ status: "success", data: { organization } });
});

export const deleteOrganization = catchAsync(async (req: Request, res: Response) => {
  const { org } = requireOrg(req);
  const deleted = await organizationService.remove(org._id.toString());

  res.status(200).json({
    status: "success",
    data: { message: "Organization deleted", deleted },
  });
});

export const listMembers = catchAsync(async (req: Request, res: Response) => {
  const { org, myOrgRole } = requireOrg(req);
  const organization = await organizationService.getDetailed(
    org._id.toString(),
    myOrgRole,
  );

  res.status(200).json({
    status: "success",
    data: { members: organization.members, count: organization.members.length },
  });
});

export const updateMemberRole = catchAsync(async (req: Request, res: Response) => {
  const { org, myOrgRole } = requireOrg(req);
  const { userId } = req.params as unknown as OrgUserParams;
  const { role } = req.body as UpdateMemberRoleInput;

  const organization = await organizationService.setMemberRole(
    org,
    userId,
    role,
    myOrgRole,
  );

  res.status(200).json({ status: "success", data: { organization } });
});

/**
 * Removes a member, or leaves the organization.
 *
 * The route only demands `member`, because leaving is a member's own business.
 * Removing *somebody else* needs admin, checked here where both the target and
 * the caller's role are known.
 */
export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const { org, myOrgRole } = requireOrg(req);
  const user = requireUser(req);
  const { userId } = req.params as unknown as OrgUserParams;

  const isSelf = userId === user._id.toString();
  const canRemoveOthers =
    myOrgRole === "owner" || myOrgRole === "orgAdmin" || myOrgRole === "admin";

  if (!isSelf && !canRemoveOthers) {
    throw AppError.forbidden(
      "This action requires admin access to the organization",
    );
  }

  await organizationService.removeMember(org, userId);

  res.status(200).json({
    status: "success",
    data: { message: isSelf ? "You have left the organization" : "Member removed" },
  });
});

export const inviteMember = catchAsync(async (req: Request, res: Response) => {
  const { org } = requireOrg(req);
  const { email, role } = req.body as InviteMemberInput;

  const created = await invitationService.invite(org, requireUser(req), email, role);

  // 201: the invitation was created. `emailSent` reports delivery separately, so
  // a bouncing or unconfigured mailer does not read as a failed invite.
  res.status(201).json({ status: "success", data: created });
});

export const listInvitations = catchAsync(async (req: Request, res: Response) => {
  const { org } = requireOrg(req);
  const invitations = await invitationService.listPending(org._id.toString());

  res.status(200).json({
    status: "success",
    data: { invitations, count: invitations.length },
  });
});

export const revokeInvitation = catchAsync(async (req: Request, res: Response) => {
  const { org } = requireOrg(req);
  const { invitationId } = req.params as unknown as OrgInvitationParams;

  await invitationService.revoke(org._id.toString(), invitationId);

  res.status(200).json({
    status: "success",
    data: { message: "Invitation revoked" },
  });
});
