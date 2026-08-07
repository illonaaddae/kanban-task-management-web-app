import { api } from "./api";

/** What the caller may do in an organization. `admin` is the platform role. */
export type OrgRole = "member" | "orgAdmin" | "owner" | "admin";

/** A role that can be granted. Owners are not "granted". */
export type OrgGrantableRole = "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  myRole: OrgRole;
  memberCount: number;
  createdAt: string;
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: OrgGrantableRole | "owner";
  joinedAt: string | null;
}

export interface OrganizationDetail extends Organization {
  members: OrgMember[];
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: OrgGrantableRole;
  invitedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  expiresAt: string;
  isRedeemable: boolean;
}

export interface InviteResult {
  invitation: PendingInvitation;
  /** False when the mailer is unconfigured or the address bounced. */
  emailSent: boolean;
  emailError?: string;
  /** The one-time link, so an admin can pass it on when email did not work. */
  acceptUrl: string;
}

export interface InvitationPreview {
  organizationName: string;
  invitedBy: string | null;
  email: string;
  role: OrgGrantableRole;
  expiresAt: string;
}

export interface MyInvitation {
  id: string;
  organizationName: string;
  role: OrgGrantableRole;
  expiresAt: string;
}

// ── Organizations ───────────────────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
  const { organizations } = await api.get<{ organizations: Organization[] }>("/orgs");
  return organizations;
}

export async function getOrganization(orgId: string): Promise<OrganizationDetail> {
  const { organization } = await api.get<{ organization: OrganizationDetail }>(
    `/orgs/${orgId}`,
  );
  return organization;
}

export async function createOrganization(name: string): Promise<Organization> {
  const { organization } = await api.post<{ organization: Organization }>("/orgs", {
    name,
  });
  return organization;
}

export async function renameOrganization(
  orgId: string,
  name: string,
): Promise<Organization> {
  const { organization } = await api.patch<{ organization: Organization }>(
    `/orgs/${orgId}`,
    { name },
  );
  return organization;
}

export async function deleteOrganization(orgId: string): Promise<void> {
  await api.delete(`/orgs/${orgId}`);
}

// ── Members ─────────────────────────────────────────────────────────────────

/**
 * Both mutations return the refreshed organization, so the caller never
 * reconstructs the member list locally and cannot drift from the server's view
 * of who has access.
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgGrantableRole,
): Promise<OrganizationDetail> {
  const { organization } = await api.patch<{ organization: OrganizationDetail }>(
    `/orgs/${orgId}/members/${userId}`,
    { role },
  );
  return organization;
}

/** Also the "leave" path — the server allows a member to remove themselves. */
export async function removeMember(orgId: string, userId: string): Promise<void> {
  await api.delete(`/orgs/${orgId}/members/${userId}`);
}

// ── Invitations ─────────────────────────────────────────────────────────────

export async function getInvitations(orgId: string): Promise<PendingInvitation[]> {
  const { invitations } = await api.get<{ invitations: PendingInvitation[] }>(
    `/orgs/${orgId}/invitations`,
  );
  return invitations;
}

export function inviteToOrganization(
  orgId: string,
  email: string,
  role: OrgGrantableRole,
): Promise<InviteResult> {
  return api.post<InviteResult>(`/orgs/${orgId}/invitations`, { email, role });
}

export async function revokeInvitation(
  orgId: string,
  invitationId: string,
): Promise<void> {
  await api.delete(`/orgs/${orgId}/invitations/${invitationId}`);
}

/** Readable without a session: the invitee may not have an account yet. */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const { invitation } = await api.get<{ invitation: InvitationPreview }>(
    `/invitations/${token}`,
  );
  return invitation;
}

export function acceptInvitation(token: string): Promise<{
  organizationId: string;
  organizationName: string;
  role: OrgGrantableRole;
}> {
  return api.post(`/invitations/${token}/accept`);
}

/**
 * Accepts an invitation found in the caller's own pending list.
 *
 * No token needed — the server matches the invitation's address against the
 * session's, which is the check that actually authorises joining. This is the
 * path for someone who no longer has the email.
 */
export function acceptMyInvitation(invitationId: string): Promise<{
  organizationId: string;
  organizationName: string;
  role: OrgGrantableRole;
}> {
  return api.post(`/invitations/mine/${invitationId}/accept`);
}

/** Invitations waiting for the signed-in user's address. */
export async function getMyInvitations(): Promise<MyInvitation[]> {
  const { invitations } = await api.get<{ invitations: MyInvitation[] }>(
    "/invitations/mine",
  );
  return invitations;
}
