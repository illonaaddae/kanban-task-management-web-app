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

/** Somebody the caller shares at least one team with. */
export interface Teammate {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Which shared teams they are in - shown as context in the picker. */
  teams: string[];
}

export interface MemberProgress {
  /** Null for the unassigned bucket. */
  userId: string | null;
  name: string;
  email: string;
  avatar?: string;
  assigned: number;
  completed: number;
  overdue: number;
  subtasks: { total: number; completed: number };
  completionRate: number;
}

export interface BoardProgress {
  boardId: string;
  /** The column treated as done - the last one by position. */
  doneColumn: string | null;
  totals: {
    tasks: number;
    completed: number;
    overdue: number;
    unassigned: number;
    completionRate: number;
  };
  members: MemberProgress[];
}

/** One of the caller's assigned tasks, with the context needed to open it. */
export interface AssignedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  dueDate: string | null;
  isOverdue: boolean;
  isDone: boolean;
  subtasks: { total: number; completed: number };
  board: { id: string; name: string; organizationId: string | null };
  column: { id: string; name: string };
}

export interface TeamAnalytics {
  organizationId: string;
  boards: number;
  totals: {
    tasks: number;
    completed: number;
    overdue: number;
    unassigned: number;
    completionRate: number;
  };
  members: MemberProgress[];
  perBoard: Array<{
    boardId: string;
    name: string;
    tasks: number;
    completed: number;
    overdue: number;
    completionRate: number;
  }>;
}

// ── Teammates & progress ────────────────────────────────────────────────────

/** Everything assigned to the caller, across every board they can reach. */
export async function getMyTasks(): Promise<AssignedTask[]> {
  const { tasks } = await api.get<{ tasks: AssignedTask[] }>("/tasks/mine");
  return tasks;
}

/** Team-wide roll-up. Team admins only, server-side. */
export async function getTeamAnalytics(orgId: string): Promise<TeamAnalytics> {
  const { analytics } = await api.get<{ analytics: TeamAnalytics }>(
    `/orgs/${orgId}/analytics`,
  );
  return analytics;
}

/**
 * Everyone across every team the caller belongs to.
 *
 * Populates the share picker. Being a teammate grants nothing on a board - this
 * only decides whose name is offered, so the board's own collaborator list stays
 * the authorisation model.
 */
export async function getTeammates(): Promise<Teammate[]> {
  const { teammates } = await api.get<{ teammates: Teammate[] }>("/orgs/teammates");
  return teammates;
}

export async function getBoardProgress(boardId: string): Promise<BoardProgress> {
  const { progress } = await api.get<{ progress: BoardProgress }>(
    `/boards/${boardId}/progress`,
  );
  return progress;
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

/** Also the "leave" path - the server allows a member to remove themselves. */
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
 * No token needed - the server matches the invitation's address against the
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
