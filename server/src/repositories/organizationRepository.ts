import type { Types } from "mongoose";
import {
  Organization,
  type OrganizationDocument,
  type OrgMemberRole,
} from "../models/Organization";

export type OrgId = string | Types.ObjectId;
export type UserId = string | Types.ObjectId;

export interface CreateOrganizationInput {
  name: string;
  owner: UserId;
}

export const organizationRepository = {
  create(data: CreateOrganizationInput): Promise<OrganizationDocument> {
    return Organization.create(data);
  },

  findById(id: OrgId): Promise<OrganizationDocument | null> {
    return Organization.findById(id).exec();
  },

  /** Organization plus resolved member identities, for the team list. */
  findByIdPopulated(id: OrgId): Promise<OrganizationDocument | null> {
    return Organization.findById(id)
      .populate("owner", "name email avatar")
      .populate("members.user", "name email avatar")
      .exec();
  },

  /**
   * Every organization the user belongs to — owned plus joined. The $or is
   * served by the `owner` and `members.user` indexes.
   */
  findForUser(userId: UserId): Promise<OrganizationDocument[]> {
    return Organization.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .sort({ createdAt: 1 })
      .exec();
  },

  updateById(
    id: OrgId,
    updates: Partial<{ name: string }>,
  ): Promise<OrganizationDocument | null> {
    return Organization.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).exec();
  },

  deleteById(id: OrgId): Promise<OrganizationDocument | null> {
    return Organization.findByIdAndDelete(id).exec();
  },

  /**
   * Adds a member only if that user is not already one. Returns null when the
   * organization is missing *or* the user is already a member, so the caller can
   * answer 404 vs 409 without a second read — and two simultaneous accepts of
   * the same invitation cannot produce a duplicate entry.
   */
  addMember(
    orgId: OrgId,
    userId: UserId,
    role: OrgMemberRole,
  ): Promise<OrganizationDocument | null> {
    return Organization.findOneAndUpdate(
      { _id: orgId, "members.user": { $ne: userId } },
      { $push: { members: { user: userId, role, joinedAt: new Date() } } },
      { new: true, runValidators: true },
    ).exec();
  },

  /** Null when the organization exists but the user is not a member. */
  updateMemberRole(
    orgId: OrgId,
    userId: UserId,
    role: OrgMemberRole,
  ): Promise<OrganizationDocument | null> {
    return Organization.findOneAndUpdate(
      { _id: orgId, "members.user": userId },
      { $set: { "members.$.role": role } },
      { new: true, runValidators: true },
    ).exec();
  },

  removeMember(orgId: OrgId, userId: UserId): Promise<OrganizationDocument | null> {
    return Organization.findOneAndUpdate(
      { _id: orgId, "members.user": userId },
      { $pull: { members: { user: userId } } },
      { new: true },
    ).exec();
  },
};

export default organizationRepository;
