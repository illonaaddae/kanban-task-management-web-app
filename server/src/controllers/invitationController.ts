import type { Request, Response } from "express";
import type {
  InvitationIdParams,
  InvitationTokenParams,
} from "../schemas/organizationSchemas";
import { invitationService } from "../services/invitationService";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

function requireUser(req: Request) {
  if (!req.user) throw AppError.unauthorized("You are not logged in");
  return req.user;
}

/**
 * What the invite screen shows before anyone signs in.
 *
 * Unauthenticated on purpose: the invitee may not have an account yet, and
 * "you have been invited to X by Y" is what tells them which address to
 * register with. The token is the only credential, and it reveals nothing
 * beyond the invitation it belongs to.
 */
export const previewInvitation = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params as unknown as InvitationTokenParams;
  const invitation = await invitationService.preview(token);

  res.status(200).json({ status: "success", data: { invitation } });
});

export const acceptInvitation = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.params as unknown as InvitationTokenParams;
  const result = await invitationService.accept(token, requireUser(req));

  res.status(200).json({ status: "success", data: result });
});

/**
 * Accepts an invitation the caller found in their own pending list.
 *
 * No token: the address match in the service is what authorises this, and this
 * path additionally requires a session. It exists because `/invitations/mine`
 * deliberately does not return tokens, so somebody who has lost the email would
 * otherwise have no way in.
 */
export const acceptMyInvitation = catchAsync(async (req: Request, res: Response) => {
  const { invitationId } = req.params as unknown as InvitationIdParams;
  const result = await invitationService.acceptById(invitationId, requireUser(req));

  res.status(200).json({ status: "success", data: result });
});

/** Invitations waiting for the signed-in user's own address. */
export const listMyInvitations = catchAsync(async (req: Request, res: Response) => {
  const invitations = await invitationService.listForUser(requireUser(req));

  res.status(200).json({
    status: "success",
    data: { invitations, count: invitations.length },
  });
});
