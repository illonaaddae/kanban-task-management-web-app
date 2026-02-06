import { useBoard } from '../../context/BoardContext';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import styles from './DeleteModal.module.css';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex: number;
  columnIndex: number;
  taskIndex: number;
  taskTitle: string;
}

export function DeleteTaskModal({ 
  isOpen, 
  onClose, 
  boardIndex, 
  columnIndex, 
  taskIndex,
  taskTitle 
}: DeleteTaskModalProps) {
  const { deleteTask } = useBoard();

  const handleDelete = () => {
    deleteTask(boardIndex, columnIndex, taskIndex);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Delete this task?</h2>
      <p className={styles.message}>
        Are you sure you want to delete the '{taskTitle}' task and its subtasks? This action cannot be reversed.
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
