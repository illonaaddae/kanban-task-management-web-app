import { useState } from 'react';
import styles from '../modals/ViewTaskModal.module.css';

interface TaskActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskActionsMenu({ onEdit, onDelete }: TaskActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={styles.menuWrapper}>
      <button
        className={styles.menuButton}
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Task options"
      >
        <svg width="5" height="20" viewBox="0 0 5 20" fill="currentColor">
          <circle cx="2.5" cy="2.5" r="2.5"/>
          <circle cx="2.5" cy="10" r="2.5"/>
          <circle cx="2.5" cy="17.5" r="2.5"/>
        </svg>
      </button>

      {showMenu && (
        <div className={styles.menu}>
          <button className={styles.menuItem} onClick={() => { setShowMenu(false); onEdit(); }}>
            Edit Task
          </button>
          <button className={`${styles.menuItem} ${styles.delete}`}
            onClick={() => { setShowMenu(false); onDelete(); }}>
            Delete Task
          </button>
        </div>
      )}
    </div>
  );
}
