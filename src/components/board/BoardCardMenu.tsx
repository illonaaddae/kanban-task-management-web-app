import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { BoardRole } from '../../types';
import styles from './BoardCardMenu.module.css';

interface BoardCardMenuProps {
  /** The caller's role on this board - decides which entries appear. */
  myRole?: BoardRole;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}

/**
 * Per-card actions on the dashboard.
 *
 * The card is a `<Link>`, so every click here has to be stopped from bubbling -
 * otherwise opening the menu navigates to the board instead.
 *
 * Entries mirror the API's rules: editors can rename, only owners can share or
 * delete. A viewer sees no menu at all rather than a menu of dead options.
 */
export function BoardCardMenu({ myRole, onEdit, onShare, onDelete }: BoardCardMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const canEdit = myRole === 'editor' || myRole === 'owner' || myRole === 'admin';
  const canManage = myRole === 'owner' || myRole === 'admin';

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  // A viewer has nothing to do here.
  if (!canEdit) return null;

  /** Swallow the click so the surrounding Link does not navigate. */
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const run = (action: () => void) => (event: MouseEvent) => {
    swallow(event);
    setOpen(false);
    action();
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Board actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          swallow(event);
          setOpen((previous) => !previous);
        }}
      >
        <svg width="4" height="16" viewBox="0 0 5 20" fill="currentColor" aria-hidden="true">
          <circle cx="2.5" cy="2.5" r="2.5" />
          <circle cx="2.5" cy="10" r="2.5" />
          <circle cx="2.5" cy="17.5" r="2.5" />
        </svg>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" onClick={run(onEdit)}>
            Edit board
          </button>
          {canManage && (
            <button type="button" role="menuitem" onClick={run(onShare)}>
              Share board
            </button>
          )}
          {canManage && (
            <button
              type="button"
              role="menuitem"
              className={styles.delete}
              onClick={run(onDelete)}
            >
              Delete board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
