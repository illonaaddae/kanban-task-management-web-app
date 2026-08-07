import { useState } from 'react';
import { useDeleteBoard } from '../../queries/mutations';
import { useBoards } from '../../queries/boards';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import styles from './DeleteModal.module.css';
import { PATHS } from '../../routes';

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
  const deleteBoard = useDeleteBoard();
  const { data: boards = [] } = useBoards();

  const resolvedBoardId = boardId || (typeof boardIndex === 'number' && boards[boardIndex] ? boards[boardIndex].id : null);

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!resolvedBoardId || deleting) return;
    setDeleting(true);

    // Close the modal and navigate BEFORE store update to prevent hooks unmount crash
    onClose();

    // Calculate next destination before deleting
    const remainingBoards = boards.filter(b => b.id !== resolvedBoardId);
    const nextPath = remainingBoards.length > 0 ? PATHS.board(remainingBoards[0].id!) : PATHS.dashboard;
    navigate(nextPath, { replace: true });

    try {
      await deleteBoard.mutateAsync(resolvedBoardId);
      toast(`Board '${boardName}' deleted successfully`, {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ),
        style: {
          background: 'var(--red)',
          color: '#fff',
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete board');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Delete this board?</h2>
      <p className={styles.message}>
        Are you sure you want to delete the '{boardName}' board? This action will remove all columns and tasks and cannot be reversed.
      </p>
      <div className={styles.actions}>
        <Button variant="destructive" onClick={handleDelete} size="large" disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
        <Button variant="secondary" onClick={onClose} size="large">Cancel</Button>
      </div>
    </Modal>
  );
}
