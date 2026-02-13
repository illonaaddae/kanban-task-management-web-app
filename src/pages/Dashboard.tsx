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

      <div className={styles.boardGrid}>
        {boards.map((board) => (
          <Link
            key={board.id}
            to={`/board/${board.id}`}
            className={styles.boardCard}
          >
            <h2>{board.name}</h2>
            <div className={styles.stats}>
              <span>{board.columns.length} columns</span>
              <span>
                {board.columns.reduce((total, col) => total + col.tasks.length, 0)} tasks
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
