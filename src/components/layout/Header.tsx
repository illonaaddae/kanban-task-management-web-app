import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Logo } from '../ui/Logo';
import { Button } from '../ui/Button';
import { BoardSelectorModal } from '../modals/BoardSelectorModal';
import { AddTaskModal } from '../modals/AddTaskModal';
import { EditBoardModal } from '../modals/EditBoardModal';
import { DeleteBoardModal } from '../modals/DeleteBoardModal';
import styles from './Header.module.css';

import { ProfileButton } from './ProfileButton';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const boards = useStore((state) => state.boards);
  const [showMenu, setShowMenu] = useState(false);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditBoardModal, setShowEditBoardModal] = useState(false);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(false);
  
  // Extract boardId from pathname
  const getBoardIdFromPath = (): string | null => {
    // Match /board/:id
    const match = location.pathname.match(/^\/board\/([^/]+)$/);
    return match ? match[1] : null;
  };
  
  const boardId = getBoardIdFromPath();
  const currentBoard = boardId ? boards.find(b => b.id === boardId) : null;
  
  const isOnBoardView = !!currentBoard;
  
  // Determine page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/' || location.pathname === '') {
      return 'Dashboard';
    }
    if (location.pathname === '/admin') {
      // Check if Admin exists or is just a placeholder
      return 'Admin Panel';
    }
    
    if (currentBoard) {
      return currentBoard.name;
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
          onClick={() => navigate('/')}
          aria-label="Go to dashboard"
          title="Go to dashboard"
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
        
        {/* Standalone title for desktop */}
        <h1 className={styles.title}>{getPageTitle()}</h1>
        
        <div className={styles.actions}>
          {isOnBoardView && (
            <>
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
            </>
          )}
          
          <ProfileButton />
        </div>
      </header>
      
      {/* Board Selector Modal for mobile */}
      <BoardSelectorModal
        isOpen={showBoardSelector}
        onClose={() => setShowBoardSelector(false)}
        activeBoardId={boardId || undefined}
      />
      
      {isOnBoardView && showAddTaskModal && (
        <AddTaskModal
          isOpen={showAddTaskModal}
          boardId={boardId!}
          onClose={() => setShowAddTaskModal(false)}
        />
      )}
      
      {isOnBoardView && showEditBoardModal && (
        <EditBoardModal
          isOpen={showEditBoardModal}
          boardId={boardId!}
          onClose={() => setShowEditBoardModal(false)}
        />
      )}
      
      {isOnBoardView && showDeleteBoardModal && (
        <DeleteBoardModal
          isOpen={showDeleteBoardModal}
          boardId={boardId!}
          onClose={() => setShowDeleteBoardModal(false)}
          boardName={currentBoard.name}
        />
      )}
    </>
  );
}
