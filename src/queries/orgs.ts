import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orgApi from '../services/orgApi';
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
