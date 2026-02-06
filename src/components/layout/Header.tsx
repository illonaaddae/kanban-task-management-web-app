import { useState } from 'react';
import { useBoard } from '../../context/BoardContext';
import { Button } from '../ui/Button';
import { AddTaskModal } from '../modals/AddTaskModal';
import { EditBoardModal } from '../modals/EditBoardModal';
import { DeleteBoardModal } from '../modals/DeleteBoardModal';
import styles from './Header.module.css';

export function Header() {
  const { boards, activeBoard } = useBoard();
  const [showMenu, setShowMenu] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showEditBoardModal, setShowEditBoardModal] = useState(false);
  const [showDeleteBoardModal, setShowDeleteBoardModal] = useState(false);
  
  const currentBoard = activeBoard !== null ? boards[activeBoard] : null;
  
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
        <h1 className={styles.title}>
          {currentBoard?.name || 'No Board Selected'}
        </h1>
        
        <div className={styles.actions}>
          <Button 
            variant="primary" 
            size="large"
            disabled={!currentBoard || !currentBoard.columns?.length}
            onClick={handleAddTask}
          >
            + Add New Task
          </Button>
          
          <div className={styles.menuWrapper}>
            <button 
              className={styles.menuButton}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Board options"
              disabled={!currentBoard}
            >
              <svg width="5" height="20" viewBox="0 0 5 20" fill="currentColor">
                <circle cx="2.5" cy="2.5" r="2.5"/>
                <circle cx="2.5" cy="10" r="2.5"/>
                <circle cx="2.5" cy="17.5" r="2.5"/>
              </svg>
            </button>
            
            {showMenu && currentBoard && (
              <div className={styles.menu}>
                <button className={styles.menuItem} onClick={handleEditBoard}>Edit Board</button>
                <button className={`${styles.menuItem} ${styles.delete}`} onClick={handleDeleteBoard}>Delete Board</button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeBoard !== null && (
        <>
          <AddTaskModal
            isOpen={showAddTaskModal}
            onClose={() => setShowAddTaskModal(false)}
            boardIndex={activeBoard}
          />
          
          <EditBoardModal
            isOpen={showEditBoardModal}
            onClose={() => setShowEditBoardModal(false)}
            boardIndex={activeBoard}
          />
          
          <DeleteBoardModal
            isOpen={showDeleteBoardModal}
            onClose={() => setShowDeleteBoardModal(false)}
            boardIndex={activeBoard}
            boardName={currentBoard?.name || ''}
          />
        </>
      )}
    </>
  );
}
