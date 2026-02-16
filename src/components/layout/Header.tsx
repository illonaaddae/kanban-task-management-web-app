import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Logo } from '../ui/Logo';
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
  const navigate = useNavigate();
  const boards = useStore((state) => state.boards);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showEditBoard, setShowEditBoard] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);

  const boardId = location.pathname.match(/^\/board\/([^/]+)$/)?.[1] || null;
  const currentBoard = boardId ? boards.find(b => b.id === boardId) : null;
  const isOnBoardView = !!currentBoard;

  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '') return 'Dashboard';
    if (location.pathname === '/admin') return 'Admin Panel';
    return currentBoard?.name || 'Kanban Board';
  };

  return (
    <>
      <header className={styles.header}>
        <button className={styles.logoButton} onClick={() => navigate('/')}
          aria-label="Go to dashboard" title="Go to dashboard">
          <Logo />
        </button>
        <button className={styles.titleButton} onClick={() => setShowBoardSelector(true)} aria-label="Select board">
          <h1 className={styles.title}>{getPageTitle()}</h1>
          <svg className={styles.chevron} width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        <h1 className={styles.title}>{getPageTitle()}</h1>
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
