import crypto from "node:crypto";
import { env } from "../config/env";
import { isRedeemable, type InvitationDocument } from "../models/Invitation";
import type { OrganizationDocument, OrgMemberRole } from "../models/Organization";
import type { UserDocument } from "../models/User";
import { invitationRepository } from "../repositories/invitationRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { userRepository } from "../repositories/userRepository";
import { AppError } from "../utils/AppError";
import { emailService } from "./emailService";

/** A pending invitation as an admin sees it. Never includes the token. */
export interface InvitationView {
  id: string;
  email: string;
  role: OrgMemberRole;
  invitedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  expiresAt: string;
  /** False once the link has lapsed but before the TTL sweep removes the row. */
  isRedeemable: boolean;
}

/** What an invitee is shown before they commit to joining. */
export interface InvitationPreview {
  organizationName: string;
  invitedBy: string | null;
  email: string;
  role: OrgMemberRole;
  expiresAt: string;
}

export interface CreatedInvitation {
  invitation: InvitationView;
  /** Whether the email actually went out. */
  emailSent: boolean;
  /** Why it did not, when it did not. */
  emailError?: string;
  /**
   * The one-time accept link. Returned to the inviting admin *only* so a
   * key-less or bouncing setup can still be completed by hand - it is never
   * stored and never returned by any read endpoint.
   */
  acceptUrl: string;
}

/**
 * A 256-bit URL-safe token, of which only the SHA-256 is stored.
 *
 * Not a JWT: this needs single use and revocation, which means server state
 * anyway, and a random opaque string cannot be decoded into anything about the
 * organization if it leaks into a referrer header or a chat log.
 */
function mintToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function acceptUrlFor(token: string): string {
  // The frontend route reads the token from the path and posts it back.
  return `${env.FRONTEND_URL}/invite/${token}`;
}

function toInvitationView(invitation: InvitationDocument): InvitationView {
  const inviter = invitation.invitedBy as unknown as {
    _id?: { toString(): string };
    name?: string;
    email?: string;
  } | null;

  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    invitedBy:
      inviter && typeof inviter.name === "string" && inviter._id
        ? {
            id: inviter._id.toString(),
            name: inviter.name,
            email: inviter.email ?? "",
          }
        : null,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    isRedeemable: isRedeemable(invitation),
  };
}

export interface AcceptResult {
  organizationId: string;
  organizationName: string;
  role: OrgMemberRole;
}

/**
 * Adds the user to the organization and consumes the invitation.
 *
 * Callers must already have established that `invitation` is redeemable *and*
 * belongs to `user` - this step only performs the join.
 */
async function redeem(
  invitation: InvitationDocument,
  user: UserDocument,
): Promise<AcceptResult> {
  const orgId =
    (invitation.organization as unknown as { _id?: { toString(): string } })._id?.toString() ??
    invitation.organization.toString();

  const org = await organizationRepository.findById(orgId);
  if (!org) {
    throw AppError.notFound("That organization no longer exists");
  }

  // Not an error: a double-clicked link, or an address invited twice across a
  // revoke. Either way the desired end state already holds, so consume the
  // invitation and report success.
  const alreadyIn =
    org.owner.toString() === user._id.toString() ||
    org.members.some((m) => m.user.toString() === user._id.toString());

  if (!alreadyIn) {
    await organizationRepository.addMember(orgId, user._id, invitation.role);
  }

  // Conditional on `status: pending`, so a replayed request cannot add the
  // member twice even if both passed the check above.
  await invitationRepository.markAccepted(invitation._id, user._id);

  return {
    organizationId: orgId,
    organizationName: org.name,
    role: invitation.role,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

export const invitationService = {
  /**
   * Invites an address to an organization and emails the link.
   *
   * Works for people who have no account yet - that was the whole problem with
   * board sharing, which could only find users who had already registered.
   */
  async invite(
    org: OrganizationDocument,
    inviter: UserDocument,
    email: string,
    role: OrgMemberRole,
  ): Promise<CreatedInvitation> {
    const normalised = email.toLowerCase().trim();

    if (normalised === inviter.email.toLowerCase()) {
      throw AppError.badRequest("You are already in this organization");
    }

    // Only checkable for addresses that already have an account; the unique
    // partial index is what actually prevents duplicate *invitations*.
    const existingUser = await userRepository.findByEmail(normalised);
    if (existingUser) {
      const targetId = existingUser._id.toString();
      const isOwner = org.owner.toString() === targetId;
      const isMember = org.members.some((m) => m.user.toString() === targetId);
      if (isOwner || isMember) {
        throw AppError.conflict("That person is already in this organization");
      }
    }

    const { token, tokenHash } = mintToken();
    const expiresAt = new Date(
      Date.now() + env.INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    let invitation: InvitationDocument;
    try {
      invitation = await invitationRepository.create({
        organization: org._id,
        email: normalised,
        role,
        invitedBy: inviter._id,
        tokenHash,
        expiresAt,
      });
    } catch (error) {
      // The partial unique index rejected a second live invitation for this
      // address. Translated here so the message names the real conflict instead
      // of the generic "a record with that organization already exists".
      if (isDuplicateKeyError(error)) {
        throw AppError.conflict(
          "That address already has a pending invitation to this organization",
        );
      }
      throw error;
    }

    const acceptUrl = acceptUrlFor(token);
    const result = await emailService.sendOrganizationInvitation({
      to: normalised,
      inviterName: inviter.name,
      organizationName: org.name,
      role: role === "admin" ? "an admin" : "a member",
      acceptUrl,
      expiresInDays: env.INVITATION_EXPIRES_DAYS,
    });

    // A failed send is reported, not thrown: the invitation exists and the link
    // works, so failing the request would leave the admin unsure whether to
    // retry - and a retry would then 409 against their own first attempt.
    return {
      invitation: toInvitationView(invitation),
      emailSent: result.delivered,
      ...(result.reason ? { emailError: result.reason } : {}),
      acceptUrl,
    };
  },

  async listPending(orgId: string): Promise<InvitationView[]> {
    const invitations = await invitationRepository.findPendingForOrg(orgId);
    return invitations.map(toInvitationView);
  },

  async revoke(orgId: string, invitationId: string): Promise<void> {
    const invitation = await invitationRepository.findById(invitationId);

    // Existence first, then belonging: an id from another organization is a 404
    // here rather than a 403, because the caller was authorised for *this*
    // organization and the resource simply is not in it.
    if (!invitation || invitation.organization.toString() !== orgId) {
      throw AppError.notFound("Invitation not found");
    }

    const revoked = await invitationRepository.markRevoked(invitationId);
    if (!revoked) {
      throw AppError.conflict("That invitation is no longer pending");
    }
  },

  /**
   * What the accept screen shows. Requires the token, which is the only
   * credential involved - deliberately readable without a session, since the
   * invitee may not have an account yet and needs to know what they are
   * signing up for.
   */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await invitationRepository.findByTokenHash(
      hashToken(token),
    );

    if (!invitation || !isRedeemable(invitation)) {
      throw AppError.notFound("This invitation is no longer valid");
    }

    const org = invitation.organization as unknown as { name?: string };
    const inviter = invitation.invitedBy as unknown as { name?: string } | null;

    return {
      organizationName: org?.name ?? "an organization",
      invitedBy: inviter?.name ?? null,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  },

  /**
   * Redeems an invitation for the signed-in user.
   *
   * The account's address must match the invited one. Without that check the
   * link is a bearer credential for anyone it is forwarded to, which is exactly
   * how team-invite links get abused.
   */
  async accept(
    token: string,
    user: UserDocument,
  ): Promise<AcceptResult> {
    const invitation = await invitationRepository.findByTokenHash(
      hashToken(token),
    );

    if (!invitation || !isRedeemable(invitation)) {
      throw AppError.notFound("This invitation is no longer valid");
    }

    // 403 with the invited address, not a 404: whoever holds the link is
    // legitimately looking at a real invitation, and the useful answer is which
    // account to sign in with. The address is already in the email they were
    // forwarded, so naming it discloses nothing new.
    if (invitation.email !== user.email.toLowerCase()) {
      throw AppError.forbidden(
        `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`,
      );
    }

    return redeem(invitation, user);
  },

  /**
   * Redeems an invitation the caller found in their own pending list.
   *
   * No token involved, and no weaker for it: the address match below is what
   * actually authorises this, and unlike the emailed link this path also requires
   * a session. `/invitations/mine` deliberately does not return tokens, so
   * without this an invitee who no longer has the email would be stuck.
   */
  async acceptById(invitationId: string, user: UserDocument): Promise<AcceptResult> {
    const invitation = await invitationRepository.findById(invitationId);

    // Not "forbidden": an invitation for somebody else is not the caller's to
    // know about, so it reads as absent.
    if (
      !invitation ||
      !isRedeemable(invitation) ||
      invitation.email !== user.email.toLowerCase()
    ) {
      throw AppError.notFound("This invitation is no longer valid");
    }

    return redeem(invitation, user);
  },

  /**
   * Invitations waiting for the signed-in user's address.
   *
   * Lets someone who registered *after* being invited find the invitation
   * without needing the email again - the common case when an invite goes to
   * somebody with no account.
   */
  async listForUser(user: UserDocument): Promise<
    Array<{ id: string; organizationName: string; role: OrgMemberRole; expiresAt: string }>
  > {
    const invitations = await invitationRepository.findPendingForEmail(user.email);

    return invitations.filter(isRedeemable).map((invitation) => {
      const org = invitation.organization as unknown as { name?: string };
      return {
        id: invitation._id.toString(),
        organizationName: org?.name ?? "an organization",
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      };
    });
  },
};

export default invitationService;
