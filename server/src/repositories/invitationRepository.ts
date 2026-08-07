import type { Types } from "mongoose";
import { Invitation, type InvitationDocument } from "../models/Invitation";
import type { OrgMemberRole } from "../models/Organization";

export type InvitationId = string | Types.ObjectId;
export type OrgId = string | Types.ObjectId;
export type UserId = string | Types.ObjectId;

export interface CreateInvitationInput {
  organization: OrgId;
  email: string;
  role: OrgMemberRole;
  invitedBy: UserId;
  tokenHash: string;
  expiresAt: Date;
}

export const invitationRepository = {
  create(data: CreateInvitationInput): Promise<InvitationDocument> {
    return Invitation.create(data);
  },

  findById(id: InvitationId): Promise<InvitationDocument | null> {
    return Invitation.findById(id).exec();
  },

  /**
   * Looks an invitation up by the hash of the token from the link, with the
   * organization and inviter resolved — the accept screen shows "Illona invited
   * you to Acme" before asking anyone to commit.
   */
  findByTokenHash(tokenHash: string): Promise<InvitationDocument | null> {
    return Invitation.findOne({ tokenHash })
      .populate("organization", "name")
      .populate("invitedBy", "name email")
      .exec();
  },

  /** Outstanding invitations for one organization, newest first. */
  findPendingForOrg(orgId: OrgId): Promise<InvitationDocument[]> {
    return Invitation.find({ organization: orgId, status: "pending" })
      .populate("invitedBy", "name email")
      .sort({ createdAt: -1 })
      .exec();
  },

  /**
   * Every organization someone has been invited to but not yet joined, matched
   * by address. Used on sign-up: a user who registers after being invited should
   * find the invitation waiting rather than needing the email again.
   */
  findPendingForEmail(email: string): Promise<InvitationDocument[]> {
    return Invitation.find({ email: email.toLowerCase(), status: "pending" })
      .populate("organization", "name")
      .sort({ createdAt: -1 })
      .exec();
  },

  /**
   * Marks an invitation accepted, but only from `pending` — so a token replayed
   * twice (double-clicked link, retried request) settles the second attempt
   * against an unchanged row instead of re-adding the member.
   */
  markAccepted(
    id: InvitationId,
    userId: UserId,
  ): Promise<InvitationDocument | null> {
    return Invitation.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "accepted", acceptedBy: userId, acceptedAt: new Date() } },
      { new: true },
    ).exec();
  },

  markRevoked(id: InvitationId): Promise<InvitationDocument | null> {
    return Invitation.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "revoked" } },
      { new: true },
    ).exec();
  },

  /** Cascade target when an organization is deleted. */
  deleteForOrg(orgId: OrgId): Promise<number> {
    return Invitation.deleteMany({ organization: orgId })
      .exec()
      .then((result) => result.deletedCount ?? 0);
  },
};

export default invitationRepository;
