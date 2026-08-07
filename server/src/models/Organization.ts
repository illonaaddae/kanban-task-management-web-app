import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { toJSONOptions } from "./transforms";

/**
 * Roles a *member* can hold. The owner is the `owner` field, not an entry here —
 * same shape as Board/collaborators, so there is one way to express "this person
 * created it" across the codebase.
 */
export const ORG_MEMBER_ROLES = ["admin", "member"] as const;
export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

export interface IOrgMember {
  user: Types.ObjectId;
  role: OrgMemberRole;
  joinedAt: Date;
}

export interface IOrganization {
  name: string;
  owner: Types.ObjectId;
  members: IOrgMember[];
  createdAt: Date;
  updatedAt: Date;
}

export type OrganizationDocument = HydratedDocument<IOrganization>;
export type OrganizationModel = Model<IOrganization>;

const orgMemberSchema = new Schema<IOrgMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: {
        values: [...ORG_MEMBER_ROLES],
        message: "Member role must be either admin or member",
      },
      required: true,
      default: "member",
    },
    // Surfaced in the team list: "joined 3 days ago" is the cheapest signal that
    // an invitation actually landed.
    joinedAt: { type: Date, default: () => new Date() },
  },
  // Identified by `user`; a subdocument _id would only be noise in responses.
  { _id: false },
);

const organizationSchema = new Schema<IOrganization, OrganizationModel>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [120, "Organization name cannot exceed 120 characters"],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: { type: [orgMemberSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: toJSONOptions(),
    toObject: toJSONOptions(),
  },
);

// Serves the `members.user` half of organizationRepository.findForUser's $or.
organizationSchema.index({ "members.user": 1 });

export const Organization = model<IOrganization, OrganizationModel>(
  "Organization",
  organizationSchema,
);

export default Organization;
