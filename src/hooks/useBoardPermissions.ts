import { useLocation } from 'react-router-dom';
import { useBoard } from '../queries/boards';
import type { BoardRole } from '../types';

export interface BoardPermissions {
  myRole: BoardRole;
  /** Create, edit, move and delete tasks and columns. */
  canEdit: boolean;
  /** Rename the board, manage collaborators, delete the board. */
  canManageBoard: boolean;
  /** Read-only: everything is visible, nothing is changeable. */
  isViewer: boolean;
}

/** The board id in the URL, or undefined when we are not on a board. */
export function useRouteBoardId(): string | undefined {
  const { pathname } = useLocation();
  return pathname.match(/^\/board\/([^/]+)/)?.[1];
}

/**
 * The single source of truth for what the UI offers.
 *
 * Mirrors the server's RBAC table so affordances match what the API will
 * actually allow. Presentation only - the API enforces the same rules
 * independently, so a hidden button is convenience, never the control.
 *
 * Reads the board from the route rather than taking an argument, so every call
 * site stays unchanged now that `currentBoard` no longer exists in a store.
 * Defaults to `viewer` while the board loads: showing edit controls that then
 * vanish is worse than showing read-only ones that gain abilities.
 */
export function useBoardPermissions(): BoardPermissions {
  const boardId = useRouteBoardId();
  const { data: board } = useBoard(boardId);

  const myRole = board?.myRole ?? 'viewer';
  const canEdit = myRole === 'editor' || myRole === 'owner' || myRole === 'admin';
  const canManageBoard = myRole === 'owner' || myRole === 'admin';

  return { myRole, canEdit, canManageBoard, isViewer: !canEdit };
}
