import { useState } from 'react';
import styles from './Header.module.css';

interface BoardActionsMenuProps {
  onEditBoard: () => void;
  onDeleteBoard: () => void;
}

export function BoardActionsMenu({ onEditBoard, onDeleteBoard }: BoardActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={styles.menuContainer}>
      <button
        className={styles.menuButton}
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Board options"
      >
        <svg width="5" height="20" viewBox="0 0 5 20" fill="currentColor">
          <circle cx="2.5" cy="2.5" r="2.5"/>
          <circle cx="2.5" cy="10" r="2.5"/>
          <circle cx="2.5" cy="17.5" r="2.5"/>
        </svg>
      </button>

      {showMenu && (
        <div className={styles.menu}>
          <button onClick={() => { setShowMenu(false); onEditBoard(); }}>Edit Board</button>
          <button className={styles.delete} onClick={() => { setShowMenu(false); onDeleteBoard(); }}>
            Delete Board
          </button>
        </div>
      )}
    </div>
  );
}
