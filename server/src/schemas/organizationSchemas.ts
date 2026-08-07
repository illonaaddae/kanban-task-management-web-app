import { z } from "zod";
import { ORG_MEMBER_ROLES } from "../models/Organization";
import { objectIdSchema } from "./commonSchemas";

const nameSchema = z
  .string()
  .trim()
  .min(1, "Organization name is required")
  .max(120, "Organization name cannot exceed 120 characters");

const roleSchema = z.enum(ORG_MEMBER_ROLES, {
  message: "Role must be either admin or member",
});

export const createOrganizationSchema = z.object({ name: nameSchema });

export const updateOrganizationSchema = z.object({ name: nameSchema });

export const inviteMemberSchema = z.object({
  email: z.email("Must be a valid email address").trim().toLowerCase(),
  // Defaults to the least privilege, so an omitted role never quietly grants
  // the ability to invite others.
  role: roleSchema.default("member"),
});

export const updateMemberRoleSchema = z.object({ role: roleSchema });

export const orgUserParamsSchema = z.object({
  id: objectIdSchema,
  userId: objectIdSchema,
});

export const orgInvitationParamsSchema = z.object({
  id: objectIdSchema,
  invitationId: objectIdSchema,
});

/**
 * The token is 32 random bytes as base64url - 43 characters, no padding. Bounded
 * here so a garbage path segment is a 400 instead of reaching the hash lookup.
 */
export const invitationTokenParamsSchema = z.object({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,128}$/, "Must be a valid invitation token"),
});

export const invitationIdParamsSchema = z.object({
  invitationId: objectIdSchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type OrgUserParams = z.infer<typeof orgUserParamsSchema>;
export type OrgInvitationParams = z.infer<typeof orgInvitationParamsSchema>;
export type InvitationTokenParams = z.infer<typeof invitationTokenParamsSchema>;
export type InvitationIdParams = z.infer<typeof invitationIdParamsSchema>;
