import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { ORG_MEMBER_ROLES, type OrgMemberRole } from "./Organization";
import { toJSONOptions } from "./transforms";

export const INVITATION_STATUSES = [
  "pending",
  "accepted",
  "revoked",
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface IInvitation {
  organization: Types.ObjectId;
  /** Who was invited. Lower-cased, because it is matched against User.email. */
  email: string;
  role: OrgMemberRole;
  invitedBy: Types.ObjectId;
  /**
   * SHA-256 of the token that went out in the email - never the token itself.
   * A leaked database dump then yields no usable invitation links, and lookup
   * is still a single indexed read because we hash the incoming token the same
   * way.
   */
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedBy?: Types.ObjectId;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type InvitationDocument = HydratedDocument<IInvitation>;
export type InvitationModel = Model<IInvitation>;

const invitationSchema = new Schema<IInvitation, InvitationModel>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "An invitation needs an email address"],
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: [...ORG_MEMBER_ROLES],
        message: "Invitation role must be either admin or member",
      },
      default: "member",
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: {
        values: [...INVITATION_STATUSES],
        message: "Invitation status must be pending, accepted or revoked",
      },
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
  },
  {
    timestamps: true,
    // `tokenHash` is stripped from every serialisation. It is not a secret in
    // the way the token is, but it is guessing material and no client has any
    // use for it.
    toJSON: toJSONOptions(["tokenHash"]),
    toObject: toJSONOptions(["tokenHash"]),
  },
);

/**
 * One live invitation per address per organization, enforced in the database
 * rather than by a read-then-write in the service - two admins inviting the same
 * person at once would otherwise both pass the check. Partial, so accepted and
 * revoked rows accumulate as history without blocking a re-invite.
 */
invitationSchema.index(
  { organization: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

/**
 * An expired invitation is dead weight - the token no longer works, and the row
 * only exists so the UI can say "expired". Mongo drops it an hour after it
 * lapses. `expireAfterSeconds` counts from the value of `expiresAt` itself.
 */
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

/**
 * True when the invitation can still be accepted right now.
 *
 * A plain function rather than a schema method: the TTL index only sweeps every
 * ~60s, so an invitation can outlive its own expiry in the collection and every
 * read path has to check the clock rather than trust the row's existence.
 */
export function isRedeemable(invitation: IInvitation): boolean {
  return (
    invitation.status === "pending" && invitation.expiresAt.getTime() > Date.now()
  );
}

export const Invitation = model<IInvitation, InvitationModel>(
  "Invitation",
  invitationSchema,
);

export default Invitation;
