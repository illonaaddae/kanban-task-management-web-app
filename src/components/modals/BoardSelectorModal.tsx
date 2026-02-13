import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AddBoardModal } from '../modals/AddBoardModal';
import { Modal } from './Modal';
import styles from './BoardSelectorModal.module.css';

interface BoardSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBoardIndex?: number | null; // Deprecated
  activeBoardId?: string;           // New
}

export function BoardSelectorModal({ isOpen, onClose, activeBoardIndex, activeBoardId }: BoardSelectorModalProps) {
  const boards = useStore((state) => state.boards);
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  
  if (!isOpen) return null;

  // Resolve active state
  // If activeBoardId provided, use it. Else fallback to index if valid.
  const isBoardActive = (board: any, index: number) => {
    if (activeBoardId) return board.id === activeBoardId;
    if (typeof activeBoardIndex === 'number') return index === activeBoardIndex;
    return false;
  };

  const handleBoardClick = () => {
    onClose(); // Close modal when a board is selected
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className={styles.container}>
          <h2 className={styles.heading}>ALL BOARDS ({boards.length})</h2>
          
          <div className={styles.boardList}>
            {boards.map((board, index) => (
              <Link
                key={board.id}
                to={`/board/${board.id}`}
                className={`${styles.boardItem} ${isBoardActive(board, index) ? styles.active : ''}`}
                onClick={handleBoardClick}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M0.846133 0.846133C0.304363 1.3879 0 2.12271 0 2.88889V13.1111C0 13.8773 0.304363 14.6121 0.846133 15.1538C1.3879 15.6955 2.12271 16 2.88889 16H13.1111C13.8773 16 14.6121 15.6955 15.1538 15.1538C15.6956 14.6121 16 13.8773 16 13.1111V2.88889C16 2.12271 15.6956 1.3879 15.1538 0.846133C14.6121 0.304363 13.8773 0 13.1111 0H2.88889C2.12271 0 1.3879 0.304363 0.846133 0.846133Z"/>
                </svg>
                {board.name}
              </Link>
            ))}
            
            <button 
              className={styles.createBoard}
              onClick={() => setShowAddBoardModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0.846133 0.846133C0.304363 1.3879 0 2.12271 0 2.88889V13.1111C0 13.8773 0.304363 14.6121 0.846133 15.1538C1.3879 15.6955 2.12271 16 2.88889 16H13.1111C13.8773 16 14.6121 15.6955 15.1538 15.1538C15.6956 14.6121 16 13.8773 16 13.1111V2.88889C16 2.12271 15.6956 1.3879 15.1538 0.846133C14.6121 0.304363 13.8773 0 13.1111 0H2.88889C2.12271 0 1.3879 0.304363 0.846133 0.846133Z"/>
              </svg>
              + Create New Board
            </button>
          </div>
          
          <div className={styles.themeSection}>
            <ThemeToggle />
          </div>
        </div>
      </Modal>
      
      {showAddBoardModal && (
        <AddBoardModal 
          isOpen={showAddBoardModal} 
          onClose={() => {
            setShowAddBoardModal(false);
            onClose(); // Also close board selector
          }} 
        />
      )}
    </>
  );
}
