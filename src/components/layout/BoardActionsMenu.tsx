import { useState } from 'react';
import styles from './Header.module.css';

interface BoardActionsMenuProps {
  onEditBoard: () => void;
  onDeleteBoard: () => void;
  onShareBoard: () => void;
  onViewActivity: () => void;
  /** Tasks and columns. Editors and above. */
  canEdit?: boolean;
  /** Rename, share, delete. Owners (and platform admins) only. */
  canManageBoard?: boolean;
}

/**
 * Board overflow menu.
 *
 * Activity is always offered — it is readable by viewers too, and is the only
 * board action a viewer gets. Everything else is gated to match the API, so the
 * menu never advertises an action that would come back 403.
 */
export function BoardActionsMenu({
  onEditBoard,
  onDeleteBoard,
  onShareBoard,
  onViewActivity,
  canEdit = true,
  canManageBoard = true,
}: BoardActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  const run = (action: () => void) => () => {
    setShowMenu(false);
    action();
  };

  return (
    <div className={styles.menuContainer}>
      <button
        className={styles.menuButton}
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Board options"
        aria-expanded={showMenu}
      >
        <svg width="5" height="20" viewBox="0 0 5 20" fill="currentColor">
          <circle cx="2.5" cy="2.5" r="2.5"/>
          <circle cx="2.5" cy="10" r="2.5"/>
          <circle cx="2.5" cy="17.5" r="2.5"/>
        </svg>
      </button>

      {showMenu && (
        <div className={styles.menu}>
          <button onClick={run(onViewActivity)}>Activity</button>
          {canManageBoard && <button onClick={run(onShareBoard)}>Share Board</button>}
          {canEdit && <button onClick={run(onEditBoard)}>Edit Board</button>}
          {canManageBoard && (
            <button className={styles.delete} onClick={run(onDeleteBoard)}>
              Delete Board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
