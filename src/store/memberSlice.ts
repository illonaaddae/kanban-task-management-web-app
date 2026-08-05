import * as collaboratorApi from '../services/collaboratorApi';
import type { StoreSet, StoreGet } from './store';
import type { BoardState } from './boardTypes';

type MemberSlice = Pick<
  BoardState,
  | 'members'
  | 'membersLoading'
  | 'fetchMembers'
  | 'inviteCollaborator'
  | 'updateCollaboratorRole'
  | 'removeCollaborator'
>;

/**
 * Board membership.
 *
 * Every mutation replaces the list with what the server returned rather than
 * patching it locally — the server is the authority on who has access, and a
 * locally-patched list would quietly disagree the moment a write partly failed.
 *
 * These throw so the calling modal can toast the API's own message (403 for a
 * non-owner, 404 for an unknown email, 409 for a duplicate).
 */
export const createMemberSlice = (set: StoreSet, get: StoreGet): MemberSlice => ({
  members: [],
  membersLoading: false,

  fetchMembers: async (boardId) => {
    set({ membersLoading: true });
    try {
      const members = await collaboratorApi.getMembers(boardId);
      set({ members, membersLoading: false });
    } catch (error) {
      // Not fatal: the board still renders, the share modal just shows the error.
      set({
        members: [],
        membersLoading: false,
        boardError: error instanceof Error ? error.message : 'Could not load members',
      });
    }
  },

  inviteCollaborator: async (boardId, email, role) => {
    const members = await collaboratorApi.inviteCollaborator(boardId, email, role);
    set({ members });
  },

  updateCollaboratorRole: async (boardId, userId, role) => {
    const members = await collaboratorApi.updateCollaboratorRole(boardId, userId, role);
    set({ members });
  },

  removeCollaborator: async (boardId, userId) => {
    const members = await collaboratorApi.removeCollaborator(boardId, userId);
    set({ members });

    // A removed collaborator loses their assignments server-side, so re-read the
    // board rather than leaving stale assignee chips on the cards.
    await get().refreshCurrentBoard();
  },
});
