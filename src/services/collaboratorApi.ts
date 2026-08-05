import { api } from "./api";
import { toMembers, type ApiBoardDetail } from "./apiShapes";
import type { BoardMember, CollaboratorRole } from "../types";

/**
 * Sharing and membership.
 *
 * Every mutation returns the refreshed member list, so the caller never has to
 * reconstruct it locally and cannot drift from the server's view of who has
 * access. All of these are owner-only server-side; a non-owner gets a 403 whose
 * message the UI shows verbatim.
 */

/** Owner first, then collaborators. Also the source for the assignee select. */
export async function getMembers(boardId: string): Promise<BoardMember[]> {
  const { board } = await api.get<{ board: ApiBoardDetail }>(`/boards/${boardId}`);
  return toMembers(board);
}

export async function inviteCollaborator(
  boardId: string,
  email: string,
  role: CollaboratorRole,
): Promise<BoardMember[]> {
  const { board } = await api.post<{ board: ApiBoardDetail }>(
    `/boards/${boardId}/collaborators`,
    { email, role },
  );

  return toMembers(board);
}

export async function updateCollaboratorRole(
  boardId: string,
  userId: string,
  role: CollaboratorRole,
): Promise<BoardMember[]> {
  const { board } = await api.patch<{ board: ApiBoardDetail }>(
    `/boards/${boardId}/collaborators/${userId}`,
    { role },
  );

  return toMembers(board);
}

export async function removeCollaborator(
  boardId: string,
  userId: string,
): Promise<BoardMember[]> {
  const { board } = await api.delete<{ board: ApiBoardDetail }>(
    `/boards/${boardId}/collaborators/${userId}`,
  );

  return toMembers(board);
}
