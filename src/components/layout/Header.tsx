import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useBoard } from '../../context/BoardContext';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { BoardSelectorModal } from '../modals/BoardSelectorModal';
import { AddTaskModal } from '../modals/AddTaskModal';
import { EditBoardModal } from '../modals/EditBoardModal';
import { DeleteBoardModal } from '../modals/DeleteBoardModal';
import styles from './Header.module.css';

export function Header() {
  const location = useLocation();
  const { boards } = useBoard();
  const [showMenu, setShowMenu] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditBoardModal, setShowEditBoardModal] = useState(false);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(false);
  
  // Extract boardId from pathname instead of useParams (Header is outside route context)
  const getBoardIdFromPath = (): string | null => {
    const match = location.pathname.match(/^\/board\/(\d+)$/);
    return match ? match[1] : null;
  };
  
  const boardId = getBoardIdFromPath();
  const boardIndex = boardId ? parseInt(boardId, 10) : null;
  
  // Simplify board view check - just check if we have a boardId from path
  const isOnBoardView = boardId !== null && boardIndex !== null && boardIndex >= 0;
  
  // Determine page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '') {
      return 'Dashboard';
    }
    if (location.pathname === '/admin') {
      return 'Admin Panel';
    }
    // Use optional chaining to safely get board name
    if (boardIndex !== null && boardIndex >= 0 && boardIndex < boards.length) {
      const boardName = boards[boardIndex]?.name;
      if (boardName) {
        return boardName;
      }
    }
    return 'Kanban Board';
  };
  
  const handleAddTask = () => {
    setShowAddTaskModal(true);
  };

  const handleEditBoard = () => {
    setShowMenu(false);
    setShowEditBoardModal(true);
  };

  const handleDeleteBoard = () => {
    setShowMenu(false);
    setShowDeleteBoardModal(true);
  };

  return (
    <>
      <header className={styles.header}>
        {/* Logo button - opens board selector on mobile */}
        <button 
          className={styles.logoButton}
          onClick={() => setShowBoardSelector(true)}
          aria-label="Open board selector"
        >
          <Logo />
        </button>
        
        {/* Board title with dropdown indicator */}
        <button
          className={styles.titleButton}
          onClick={() => setShowBoardSelector(true)}
          aria-label="Select board"
        >
          <h1 className={styles.title}>{getPageTitle()}</h1>
          <svg className={styles.chevron} width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </button>
        
        {isOnBoardView && (
          <div className={styles.actions}>
            <Button onClick={handleAddTask}>+ Add New Task</Button>
            
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
                  <button onClick={handleEditBoard}>Edit Board</button>
                  <button onClick={handleDeleteBoard} className={styles.delete}>
                    Delete Board
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      
      {/* Board Selector Modal for mobile */}
      <BoardSelectorModal
        isOpen={showBoardSelector}
        onClose={() => setShowBoardSelector(false)}
        activeBoardIndex={boardIndex}
      />
      
      {isOnBoardView && showAddTaskModal && (
        <AddTaskModal
          isOpen={showAddTaskModal}
          boardIndex={boardIndex!}
          onClose={() => setShowAddTaskModal(false)}
        />
      )}
      
      {isOnBoardView && showEditBoardModal && (
        <EditBoardModal
          isOpen={showEditBoardModal}
          boardIndex={boardIndex!}
          onClose={() => setShowEditBoardModal(false)}
        />
      )}
      
      {isOnBoardView && showDeleteBoardModal && (
        <DeleteBoardModal
          isOpen={showDeleteBoardModal}
          boardIndex={boardIndex!}
          onClose={() => setShowDeleteBoardModal(false)}
          boardName={boards[boardIndex!]?.name || 'Board'}
        />
      )}
    </>
  );
}
