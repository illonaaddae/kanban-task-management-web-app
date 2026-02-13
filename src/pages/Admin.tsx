import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { Button } from '../components/ui/Button';
import styles from './Admin.module.css';

export function Admin() {
  const boards = useStore((state) => state.boards);
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const totalTasks = boards.reduce(
    (total, board) =>
      total + board.columns.reduce((sum, col) => sum + col.tasks.length, 0),
    0
  );

  const totalColumns = boards.reduce((total, board) => total + board.columns.length, 0);

  return (
    <div className={styles.admin}>
      <div className={styles.header}>
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {user?.name || 'User'}!</p>
        </div>
        <Button variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <h3>Total Boards</h3>
          <p className={styles.number}>{boards.length}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Columns</h3>
          <p className={styles.number}>{totalColumns}</p>
        </div>
        <div className={styles.statCard}>
          <h3>Total Tasks</h3>
          <p className={styles.number}>{totalTasks}</p>
        </div>
      </div>

      <div className={styles.content}>
        <h2>Board Overview</h2>
        <div className={styles.boardList}>
          {boards.map((board) => (
            <div key={board.id} className={styles.boardItem}>
              <h3>{board.name}</h3>
              <div className={styles.boardStats}>
                <span>{board.columns.length} columns</span>
                <span>
                  {board.columns.reduce((sum, col) => sum + col.tasks.length, 0)} tasks
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
