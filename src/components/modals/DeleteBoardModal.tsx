import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { deleteBoard, boards } = useBoard();

  const handleDelete = () => {
    deleteBoard(boardIndex);
    onClose();
    
    // Navigate away from deleted board to prevent broken state
    if (boards.length <= 1) {
      // No boards left, go to dashboard
      navigate('/');
    } else {
      // Navigate to first board
      navigate('/board/0');
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
