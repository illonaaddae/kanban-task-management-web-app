import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import styles from './DeleteModal.module.css';

interface DeleteBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number; // Deprecated
  boardId?: string;    // New
  boardName: string;
}

export function DeleteBoardModal({ 
  isOpen, 
  onClose, 
  boardIndex,
  boardId,
  boardName 
}: DeleteBoardModalProps) {
  const navigate = useNavigate();
  const deleteBoard = useStore((state) => state.deleteBoard);
  const boards = useStore((state) => state.boards);
  
  // Resolve ID
  const resolvedBoardId = boardId || (typeof boardIndex === 'number' && boards[boardIndex] ? boards[boardIndex].id : null);

  const handleDelete = async () => {
    if (!resolvedBoardId) return;

    try {
        await deleteBoard(resolvedBoardId);
        onClose();
        
        // Navigation logic after delete
        // Provide a small delay for state to update or just navigate
        const remainingBoards = boards.filter(b => b.id !== resolvedBoardId);
        if (remainingBoards.length > 0) {
          navigate(`/board/${remainingBoards[0].id}`);
        } else {
          navigate('/');
        }
    } catch (error) {
        console.error("Failed to delete board", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Delete this board?</h2>
      <p className={styles.message}>
        Are you sure you want to delete the '{boardName}' board? This action will remove all columns and tasks and cannot be reversed.
      </p>
      <div className={styles.actions}>
        <Button variant="destructive" onClick={handleDelete} size="large">
          Delete
        </Button>
        <Button variant="secondary" onClick={onClose} size="large">
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
