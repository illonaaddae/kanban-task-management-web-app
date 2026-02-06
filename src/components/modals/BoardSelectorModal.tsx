import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoard } from '../../context/BoardContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AddBoardModal } from '../modals/AddBoardModal';
import { Modal } from './Modal';
import styles from './BoardSelectorModal.module.css';

interface BoardSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBoardIndex: number | null;
}

export function BoardSelectorModal({ isOpen, onClose, activeBoardIndex }: BoardSelectorModalProps) {
  const { boards } = useBoard();
  const [showAddBoardModal, setShowAddBoardModal] = useState(false);
  
  if (!isOpen) return null;

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
                key={index}
                to={`/board/${index}`}
                className={`${styles.boardItem} ${activeBoardIndex === index ? styles.active : ''}`}
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
