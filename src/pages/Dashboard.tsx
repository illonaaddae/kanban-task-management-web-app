import { Link } from 'react-router-dom';
import { useStore } from '../store/store';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const boards = useStore((state) => state.boards);

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>Your Boards</h1>
        <p>Select a board to start managing your tasks</p>
      </div>

      {boards.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No boards yet</p>
          <span>Create a new board to get started</span>
        </div>
      ) : (
        <div className={styles.boardGrid}>
          {boards.map((board) => {
            const taskCount = board.columns.reduce(
              (total, col) => total + col.tasks.length,
              0
            );

            return (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className={styles.boardCard}
              >
                {/* Board icon */}
                <div className={styles.boardIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                </div>

                <h2>{board.name}</h2>

                {/* Stats */}
                <div className={styles.stats}>
                  <span className={styles.stat}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v18" />
                      <path d="M5 12h14" />
                    </svg>
                    {board.columns.length} columns
                  </span>
                  <span className={styles.stat}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                    </svg>
                    {taskCount} tasks
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
