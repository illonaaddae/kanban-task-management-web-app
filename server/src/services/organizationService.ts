import type { Types } from "mongoose";
import type { OrganizationDocument, OrgMemberRole } from "../models/Organization";
import type { UserDocument } from "../models/User";
import type { EffectiveOrgRole } from "../middlewares/orgAccess";
import { invitationRepository } from "../repositories/invitationRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { AppError } from "../utils/AppError";

/** One person in an organization, flattened for the client. */
export interface OrgMemberView {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** `owner` is derived from the organization, not from a members entry. */
  role: OrgMemberRole | "owner";
  joinedAt: string | null;
}

export interface OrganizationView {
  id: string;
  name: string;
  myRole: EffectiveOrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrganizationDetailView extends OrganizationView {
  members: OrgMemberView[];
}

/** A ref that may or may not have been populated. */
type MaybePopulatedUser =
  | Types.ObjectId
  | {
      _id: Types.ObjectId;
      name?: string;
      email?: string;
      avatar?: string;
    };

function toMemberView(
  user: MaybePopulatedUser,
  role: OrgMemberRole | "owner",
  joinedAt: Date | null,
): OrgMemberView | null {
  if (!user) return null;

  const populated = user as {
    _id: Types.ObjectId;
    name?: string;
    email?: string;
    avatar?: string;
  };
  // Unpopulated, or the referenced user was deleted. Either way there is no
  // person to show, and a half-empty row is worse than an absent one.
  if (typeof populated.name !== "string") return null;

  return {
    id: populated._id.toString(),
    name: populated.name,
    email: populated.email ?? "",
    ...(populated.avatar ? { avatar: populated.avatar } : {}),
    role,
    joinedAt: joinedAt ? joinedAt.toISOString() : null,
  };
}

function roleFor(org: OrganizationDocument, userId: string): EffectiveOrgRole | null {
  if (org.owner.toString() === userId) return "owner";
  const entry = org.members.find((m) => m.user.toString() === userId);
  if (!entry) return null;
  return entry.role === "admin" ? "orgAdmin" : "member";
}

export const organizationService = {
  /** Creates an organization owned by the caller. */
  async create(user: UserDocument, name: string): Promise<OrganizationView> {
    const org = await organizationRepository.create({
      name,
      owner: user._id,
    });

    return {
      id: org._id.toString(),
      name: org.name,
      myRole: "owner",
      // The owner is not a members entry, so an organization of one reports 1.
      memberCount: 1,
      createdAt: org.createdAt.toISOString(),
    };
  },

  /** Every organization the caller belongs to, with their role in each. */
  async listForUser(user: UserDocument): Promise<OrganizationView[]> {
    const orgs = await organizationRepository.findForUser(user._id);
    const userId = user._id.toString();

    return orgs.map((org) => ({
      id: org._id.toString(),
      name: org.name,
      myRole: roleFor(org, userId) ?? "admin",
      memberCount: org.members.length + 1,
      createdAt: org.createdAt.toISOString(),
    }));
  },

  /** One organization with its people, owner listed first. */
  async getDetailed(
    orgId: string,
    myRole: EffectiveOrgRole,
  ): Promise<OrganizationDetailView> {
    const org = await organizationRepository.findByIdPopulated(orgId);
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    const owner = toMemberView(org.owner, "owner", org.createdAt);
    const members = org.members
      .map((m) => toMemberView(m.user, m.role, m.joinedAt ?? null))
      .filter((m): m is OrgMemberView => m !== null);

    return {
      id: org._id.toString(),
      name: org.name,
      myRole,
      memberCount: org.members.length + 1,
      createdAt: org.createdAt.toISOString(),
      members: owner ? [owner, ...members] : members,
    };
  },

  async rename(orgId: string, name: string): Promise<OrganizationView> {
    const org = await organizationRepository.updateById(orgId, { name });
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    return {
      id: org._id.toString(),
      name: org.name,
      myRole: "owner",
      memberCount: org.members.length + 1,
      createdAt: org.createdAt.toISOString(),
    };
  },

  /** Deletes an organization and the invitations that pointed at it. */
  async remove(orgId: string): Promise<{ invitations: number }> {
    const org = await organizationRepository.findById(orgId);
    if (!org) {
      throw AppError.notFound("Organization not found");
    }

    // Invitations are meaningless without their organization, and leaving them
    // behind would let a token resolve to a dangling ref.
    const invitations = await invitationRepository.deleteForOrg(orgId);
    await organizationRepository.deleteById(orgId);

    return { invitations };
  },

  /**
   * Changes a member's role.
   *
   * The owner is not a members entry, so there is nothing to change for them -
   * reported as 400 rather than 404, because the user exists and the caller's
   * mistake is asking for something the model does not express.
   */
  async setMemberRole(
    org: OrganizationDocument,
    targetUserId: string,
    role: OrgMemberRole,
    myOrgRole: EffectiveOrgRole,
  ): Promise<OrganizationDetailView> {
    if (org.owner.toString() === targetUserId) {
      throw AppError.badRequest(
        "The organization owner's role cannot be changed",
      );
    }

    const updated = await organizationRepository.updateMemberRole(
      org._id,
      targetUserId,
      role,
    );
    if (!updated) {
      throw AppError.notFound("That user is not a member of this organization");
    }

    return this.getDetailed(org._id.toString(), myOrgRole);
  },

  /**
   * Removes a member. Also the "leave" path: a member removing themselves is
   * allowed by the route, which is why this cannot simply demand admin.
   */
  async removeMember(
    org: OrganizationDocument,
    targetUserId: string,
  ): Promise<void> {
    if (org.owner.toString() === targetUserId) {
      throw AppError.badRequest(
        "The organization owner cannot be removed - delete the organization instead",
      );
    }

    const updated = await organizationRepository.removeMember(
      org._id,
      targetUserId,
    );
    if (!updated) {
      throw AppError.notFound("That user is not a member of this organization");
    }
  },
};

export default organizationService;
