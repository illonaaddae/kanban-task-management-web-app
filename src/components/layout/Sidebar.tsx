import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AddBoardModal } from '../modals/AddBoardModal';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const boards = useStore((state) => state.boards);
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract board ID from current URL path — memoized so the regex only
  // re-runs when the pathname actually changes, not on every render
  const activeBoardId = useMemo(
    () => location.pathname.match(/\/board\/([^/]+)/)?.[1] ?? null,
    [location.pathname]
  );
  
  if (!isOpen) {
    return (
      <button className={styles.showButton} onClick={onToggle} aria-label="Show sidebar">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
          <path d="M15.8154 7.38587L9.06541 0.635867C8.80208 0.37253 8.37708 0.37253 8.11374 0.635867C7.85041 0.899201 7.85041 1.3242 8.11374 1.58753L13.5271 7.00003H0.666748C0.298748 7.00003 0.000415802 7.29837 0.000415802 7.66637C0.000415802 8.03437 0.298748 8.3327 0.666748 8.3327H13.5271L8.11374 13.746C7.85041 14.0094 7.85041 14.4344 8.11374 14.6977C8.24541 14.8294 8.42291 14.896 8.59958 14.896C8.77624 14.896 8.95374 14.8294 9.08541 14.6977L15.8354 7.94771C16.0987 7.68437 16.0987 7.2592 15.8154 6.99587V7.38587Z"/>
        </svg>
      </button>
    );
  }
  
  return (
    <>
      {/* Backdrop for mobile overlay */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropVisible : ""}`}
        onClick={onToggle}
      />

      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <button
          className={styles.logoButton}
          onClick={() => navigate("/")}
          aria-label="Go to dashboard"
          title="Go to dashboard"
        >
          <Logo />
        </button>

        <div className={styles.boardSection}>
          <h2 className={styles.boardsHeading}>ALL BOARDS ({boards.length})</h2>

          <div className={styles.boardList}>
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className={`${styles.boardItem} ${activeBoardId === board.id ? styles.active : ""}`}
                onClick={onToggle}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M0.846133 0.846133C0.304363 1.3879 0 2.12271 0 2.88889V13.1111C0 13.8773 0.304363 14.6121 0.846133 15.1538C1.3879 15.6955 2.12271 16 2.88889 16H13.1111C13.8773 16 14.6121 15.6955 15.1538 15.1538C15.6956 14.6121 16 13.8773 16 13.1111V2.88889C16 2.12271 15.6956 1.3879 15.1538 0.846133C14.6121 0.304363 13.8773 0 13.1111 0H2.88889C2.12271 0 1.3879 0.304363 0.846133 0.846133Z" />
                </svg>
                {board.name}
              </Link>
            ))}

            <button
              className={styles.createBoard}
              onClick={() => setShowAddBoardModal(true)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M0.846133 0.846133C0.304363 1.3879 0 2.12271 0 2.88889V13.1111C0 13.8773 0.304363 14.6121 0.846133 15.1538C1.3879 15.6955 2.12271 16 2.88889 16H13.1111C13.8773 16 14.6121 15.6955 15.1538 15.1538C15.6956 14.6121 16 13.8773 16 13.1111V2.88889C16 2.12271 15.6956 1.3879 15.1538 0.846133C14.6121 0.304363 13.8773 0 13.1111 0H2.88889C2.12271 0 1.3879 0.304363 0.846133 0.846133Z" />
              </svg>
              + Create New Board
            </button>
          </div>
        </div>

        <div className={styles.bottomSection}>
          <ThemeToggle />
          <button className={styles.hideButton} onClick={onToggle}>
            <svg width="18" height="16" viewBox="0 0 18 16" fill="currentColor">
              <path d="M8.52257 0.845849C5.29733 0.845849 2.67883 3.46436 2.67883 6.68959C2.67883 9.91482 5.29733 12.5333 8.52257 12.5333C11.7478 12.5333 14.3663 9.91482 14.3663 6.68959C14.3663 3.46436 11.7478 0.845849 8.52257 0.845849ZM1.97598 6.68959C1.97598 3.07701 4.90998 0.143005 8.52257 0.143005C12.1352 0.143005 15.0692 3.07701 15.0692 6.68959C15.0692 10.3022 12.1352 13.2362 8.52257 13.2362C4.90998 13.2362 1.97598 10.3022 1.97598 6.68959Z" />
            </svg>
            Hide Sidebar
          </button>
        </div>
      </aside>

      {showAddBoardModal && (
        <AddBoardModal
          isOpen={showAddBoardModal}
          onClose={() => setShowAddBoardModal(false)}
        />
      )}
    </>
  );
}
