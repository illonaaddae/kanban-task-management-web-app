import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store/store";
import { useShallow } from "zustand/react/shallow";
import { Loader } from "../components/ui/Loader";
import { BoardCardMenu } from "../components/board/BoardCardMenu";
import { EditBoardModal } from "../components/modals/EditBoardModal";
import { DeleteBoardModal } from "../components/modals/DeleteBoardModal";
import { ShareModal } from "../components/modals/ShareModal";
import type { Board } from "../types";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const { boards, boardLoading, boardsLoaded, boardError, fetchBoards, user } = useStore(
    useShallow((state) => ({
      boards: state.boards,
      boardLoading: state.boardLoading,
      boardsLoaded: state.boardsLoaded,
      boardError: state.boardError,
      fetchBoards: state.fetchBoards,
      user: state.user,
    })),
  );

  // One modal instance per action, told which board it is acting on — rather
  // than rendering three modals per card.
  const [editing, setEditing] = useState<Board | null>(null);
  const [sharing, setSharing] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);

  // Only the first load takes over the page. A later mutation — creating a
  // board, say — must not replace the dashboard with a spinner: the modal that
  // triggered it is still open on top, and blanking the page behind it reads as
  // the app having broken.
  if (boardLoading && !boardsLoaded) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>
          <Loader />
          <span>Loading your boards...</span>
        </div>
      </div>
    );
  }

  if (boardError) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.emptyState}>
          <p>Could not load boards</p>
          <span>{boardError}</span>
          {user && <button onClick={() => fetchBoards(user.id)}>Retry</button>}
        </div>
      </div>
    );
  }

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
              0,
            );
            return (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className={styles.boardCard}
              >
                <div className={styles.boardIcon}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                </div>
                <BoardCardMenu
                  myRole={board.myRole}
                  onEdit={() => setEditing(board)}
                  onShare={() => setSharing(board)}
                  onDelete={() => setDeleting(board)}
                />
                <h2>{board.name}</h2>
                <div className={styles.stats}>
                  <span className={styles.stat}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v18" />
                      <path d="M5 12h14" />
                    </svg>
                    {board.columns.length} columns
                  </span>
                  <span className={styles.stat}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
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

      {editing?.id && (
        <EditBoardModal
          isOpen
          boardId={editing.id}
          onClose={() => setEditing(null)}
        />
      )}
      {sharing?.id && (
        <ShareModal
          isOpen
          boardId={sharing.id}
          boardName={sharing.name}
          onClose={() => setSharing(null)}
        />
      )}
      {deleting?.id && (
        <DeleteBoardModal
          isOpen
          boardId={deleting.id}
          boardName={deleting.name}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
