import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../ui/Button';
import { BoardSelectorModal } from '../modals/BoardSelectorModal';
import { AddTaskModal } from '../modals/AddTaskModal';
import { EditBoardModal } from '../modals/EditBoardModal';
import { DeleteBoardModal } from '../modals/DeleteBoardModal';
import { BoardActionsMenu } from './BoardActionsMenu';
import { ProfileButton } from './ProfileButton';
import styles from './Header.module.css';

export function Header() {
  const location = useLocation();

  const { boards } = useStore(useShallow((state) => ({ boards: state.boards })));
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditBoard, setShowEditBoard] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);

  const boardId = useMemo(
    () => location.pathname.match(/^\/board\/([^/]+)$/)?.[1] ?? null,
    [location.pathname]
  );
  const currentBoard = useMemo(
    () => (boardId ? boards.find(b => b.id === boardId) ?? null : null),
    [boardId, boards]
  );
  const isOnBoardView = !!currentBoard;

  const pageTitle = useMemo(() => {
    if (location.pathname === '/' || location.pathname === '') return 'Dashboard';
    if (location.pathname === '/admin') return 'Admin Panel';
    return currentBoard?.name || 'Kanban Board';
  }, [location.pathname, currentBoard]);

  return (
    <>
      <header className={styles.header}>
       
        <button className={styles.titleButton} onClick={() => setShowBoardSelector(true)} aria-label="Select board">
          <h1 className={styles.title}>{pageTitle}</h1>
          <svg className={styles.chevron} width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        <div className={styles.actions}>
          {isOnBoardView && (
            <>
              <Button onClick={() => setShowAddTask(true)}>+ Add New Task</Button>
              <BoardActionsMenu onEditBoard={() => setShowEditBoard(true)} onDeleteBoard={() => setShowDeleteBoard(true)} />
            </>
          )}
          <ProfileButton />
        </div>
      </header>
      <BoardSelectorModal isOpen={showBoardSelector} onClose={() => setShowBoardSelector(false)} activeBoardId={boardId || undefined} />
      {isOnBoardView && showAddTask && <AddTaskModal isOpen={showAddTask} boardId={boardId!} onClose={() => setShowAddTask(false)} />}
      {isOnBoardView && showEditBoard && <EditBoardModal isOpen={showEditBoard} boardId={boardId!} onClose={() => setShowEditBoard(false)} />}
      {isOnBoardView && showDeleteBoard && (
        <DeleteBoardModal isOpen={showDeleteBoard} boardId={boardId!} onClose={() => setShowDeleteBoard(false)} boardName={currentBoard.name} />
      )}
    </>
  );
}
