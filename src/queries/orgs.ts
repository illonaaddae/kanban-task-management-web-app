import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orgApi from '../services/orgApi';
import * as aiApi from '../services/aiApi';
import { tokenStore } from '../services/api';
import { queryKeys } from './keys';

/**
 * Organizations, members and invitations.
 *
 * Reads and writes live together here rather than split across boards.ts /
 * mutations.ts: the whole surface is one screen (the Team modal), so keeping the
 * invalidation next to the query it invalidates is what stops a write forgetting
 * a reader.
 */

// ── Reads ───────────────────────────────────────────────────────────────────

/** Every organization the signed-in user belongs to. */
export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.orgs.list(),
    queryFn: orgApi.getOrganizations,
    // Nothing to fetch before sign-in; avoids a guaranteed 401.
    enabled: tokenStore.isAuthenticated,
  });
}

/** One organization with its people. `undefined` disables rather than guessing. */
export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orgs.detail(orgId ?? 'none'),
    queryFn: () => orgApi.getOrganization(orgId!),
    enabled: Boolean(orgId) && tokenStore.isAuthenticated,
  });
}

/** Pending invitations. Admin-only server-side, so gated by the caller's role. */
export function useOrgInvitations(orgId: string | undefined, canManage: boolean) {
  return useQuery({
    queryKey: queryKeys.orgs.invitations(orgId ?? 'none'),
    queryFn: () => orgApi.getInvitations(orgId!),
    // A plain member gets a 403 here; not requesting it is kinder than showing
    // an error for something they were never meant to see.
    enabled: Boolean(orgId) && canManage && tokenStore.isAuthenticated,
  });
}

/**
 * Invitations waiting for the signed-in user's address.
 *
 * The path for someone who registered *after* being invited and no longer has
 * the email to hand.
 */
export function useMyInvitations() {
  return useQuery({
    queryKey: queryKeys.invitations.mine(),
    queryFn: orgApi.getMyInvitations,
    enabled: tokenStore.isAuthenticated,
  });
}

/** What the accept screen shows. Deliberately works without a session. */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invitations.preview(token ?? 'none'),
    queryFn: () => orgApi.previewInvitation(token!),
    enabled: Boolean(token),
    // A dead link does not become alive on retry.
    retry: false,
  });
}

/** Everyone across the caller's teams, for the share picker. */
export function useTeammates() {
  return useQuery({
    queryKey: queryKeys.orgs.teammates(),
    queryFn: orgApi.getTeammates,
    enabled: tokenStore.isAuthenticated,
  });
}

/** Per-person progress on one board. `undefined` disables rather than guessing. */
export function useBoardProgress(boardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boards.progress(boardId ?? 'none'),
    queryFn: () => orgApi.getBoardProgress(boardId!),
    enabled: Boolean(boardId) && tokenStore.isAuthenticated,
  });
}

/** Everything assigned to the signed-in user. The member's landing view. */
export function useMyTasks() {
  return useQuery({
    queryKey: queryKeys.tasks.mine(),
    queryFn: orgApi.getMyTasks,
    enabled: tokenStore.isAuthenticated,
  });
}

/** Team-wide roll-up. Gated on the caller being an admin, which the API enforces. */
export function useTeamAnalytics(orgId: string | undefined, canManage: boolean) {
  return useQuery({
    queryKey: queryKeys.orgs.analytics(orgId ?? 'none'),
    queryFn: () => orgApi.getTeamAnalytics(orgId!),
    // A plain member gets a 403; not asking is kinder than showing them an error
    // for something they were never meant to see.
    enabled: Boolean(orgId) && canManage && tokenStore.isAuthenticated,
  });
}

/**
 * Whether the assistant is available.
 *
 * Long `staleTime`: this changes when the server is redeployed, not while somebody
 * is using the app, and every AI affordance reads it.
 */
export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: aiApi.getAiStatus,
    enabled: tokenStore.isAuthenticated,
    staleTime: 10 * 60_000,
  });
}

/** Proposes a description and subtasks. Nothing is saved. */
export function useTaskSuggestion() {
  return useMutation({
    mutationFn: ({ title, context }: { title: string; context: string }) =>
      aiApi.suggestTask(title, context),
  });
}

/** Reads one instruction about a board. Returns a plan, never a change. */
export function useCommandPlan() {
  return useMutation({
    mutationFn: ({ boardId, instruction }: { boardId: string; instruction: string }) =>
      aiApi.interpretCommand(boardId, instruction),
  });
}

/**
 * One turn of a board conversation.
 *
 * A mutation rather than a query even though most turns only read: the transcript
 * is the input, every send is a distinct billed call, and none of it should be
 * cached or refetched on focus.
 */
export function useBoardChat() {
  return useMutation({
    mutationFn: ({
      boardId,
      messages,
    }: {
      boardId: string;
      messages: aiApi.ChatMessage[];
    }) => aiApi.chat(boardId, messages),
  });
}

/** Proposes a team, a first board and an invitee list, for confirmation. */
export function useTeamPlan() {
  return useMutation({
    mutationFn: (prompt: string) => aiApi.planTeam(prompt),
  });
}

// ── Writes ──────────────────────────────────────────────────────────────────

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => orgApi.createOrganization(name),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() }),
  });
}

export function useRenameOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, name }: { orgId: string; name: string }) =>
      orgApi.renameOrganization(orgId, name),
    // `orgs.all()` is a prefix of both list and detail, so one call refreshes
    // the picker and the open organization together.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() }),
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orgId: string) => orgApi.deleteOrganization(orgId),
    onSuccess: (_result, orgId) => {
      // Drop the detail entry outright: the organization is gone, so a refetch
      // would only 404.
      queryClient.removeQueries({ queryKey: queryKeys.orgs.detail(orgId) });
      queryClient.removeQueries({ queryKey: queryKeys.orgs.invitations(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

export function useInviteToOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      email,
      role,
    }: {
      orgId: string;
      email: string;
      role: orgApi.OrgGrantableRole;
    }) => orgApi.inviteToOrganization(orgId, email, role),
    onSuccess: (_result, { orgId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.orgs.invitations(orgId),
      }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, invitationId }: { orgId: string; invitationId: string }) =>
      orgApi.revokeInvitation(orgId, invitationId),
    onSuccess: (_result, { orgId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.orgs.invitations(orgId),
      }),
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      userId,
      role,
    }: {
      orgId: string;
      userId: string;
      role: orgApi.OrgGrantableRole;
    }) => orgApi.updateMemberRole(orgId, userId, role),
    // The server answers with the refreshed organization, so seed the cache with
    // it rather than spending a round trip re-reading what we were just handed.
    onSuccess: (organization, { orgId }) => {
      queryClient.setQueryData(queryKeys.orgs.detail(orgId), organization);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      orgApi.removeMember(orgId, userId),
    onSuccess: (_result, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.detail(orgId) });
      // Leaving changes which organizations the user is in at all.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.list() });
    },
  });
}

/** Accepts from the caller's own pending list, by id rather than token. */
export function useAcceptMyInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => orgApi.acceptMyInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations.mine() });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => orgApi.acceptInvitation(token),
    onSuccess: () => {
      // The user is now in an organization they were not in a moment ago.
      void queryClient.invalidateQueries({ queryKey: queryKeys.orgs.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations.mine() });
    },
  });
}
