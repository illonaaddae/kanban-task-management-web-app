import { useBoard } from '../../context/BoardContext';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import styles from './DeleteModal.module.css';

interface DeleteBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex: number;
  boardName: string;
}

export function DeleteBoardModal({ 
  isOpen, 
  onClose, 
  boardIndex,
  boardName 
}: DeleteBoardModalProps) {
  const { deleteBoard, boards, setActiveBoard } = useBoard();

  const handleDelete = () => {
    deleteBoard(boardIndex);
    
    // If we deleted the active board or it was the only board, switch to first remaining board
    if (boards.length > 1) {
      setActiveBoard(boardIndex > 0 ? boardIndex - 1 : 0);
    }
    
    onClose();
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
