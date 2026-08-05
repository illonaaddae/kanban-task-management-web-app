import { useStore } from '../store/store';
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

/**
 * The single source of truth for what the UI offers.
 *
 * Mirrors the server's RBAC table so the affordances match what the API will
 * actually allow. This is presentation only — the API enforces the same rules
 * independently, so a hidden button is convenience, never the control.
 *
 * Defaults to `viewer` while the board is still loading: showing edit controls
 * that then vanish is worse than showing read-only ones that gain abilities.
 */
export function useBoardPermissions(): BoardPermissions {
  const myRole = useStore((state) => state.currentBoard?.myRole) ?? 'viewer';

  const canEdit = myRole === 'editor' || myRole === 'owner' || myRole === 'admin';
  const canManageBoard = myRole === 'owner' || myRole === 'admin';

  return { myRole, canEdit, canManageBoard, isViewer: !canEdit };
}
