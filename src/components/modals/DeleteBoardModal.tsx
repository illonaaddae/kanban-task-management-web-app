import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import styles from './DeleteModal.module.css';

interface DeleteBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number;
  boardId?: string;
  boardName: string;
}

export function DeleteBoardModal({
  isOpen, onClose, boardIndex, boardId, boardName
}: DeleteBoardModalProps) {
  const navigate = useNavigate();
  const deleteBoard = useStore((state) => state.deleteBoard);
  const boards = useStore((state) => state.boards);

  const resolvedBoardId = boardId || (typeof boardIndex === 'number' && boards[boardIndex] ? boards[boardIndex].id : null);

  const handleDelete = async () => {
    if (!resolvedBoardId) return;

    // Close the modal and navigate BEFORE store update to prevent hooks unmount crash
    onClose();

    // Calculate next destination before deleting
    const remainingBoards = boards.filter(b => b.id !== resolvedBoardId);
    const nextPath = remainingBoards.length > 0 ? `/board/${remainingBoards[0].id}` : '/';
    navigate(nextPath, { replace: true });

    try {
      await deleteBoard(resolvedBoardId);
      toast.success(`Board '${boardName}' deleted successfully`);
    } catch (error) {
      console.error('Failed to delete board', error);
      toast.error('Failed to delete board');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Delete this board?</h2>
      <p className={styles.message}>
        Are you sure you want to delete the '{boardName}' board? This action will remove all columns and tasks and cannot be reversed.
      </p>
      <div className={styles.actions}>
        <Button variant="destructive" onClick={handleDelete} size="large">Delete</Button>
        <Button variant="secondary" onClick={onClose} size="large">Cancel</Button>
      </div>
    </Modal>
  );
}
