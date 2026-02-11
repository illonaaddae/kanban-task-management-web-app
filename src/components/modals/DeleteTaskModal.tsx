import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Button } from '../ui/Button';
import styles from './DeleteModal.module.css';

interface DeleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number; // Deprecated
  columnIndex?: number; // Deprecated
  taskIndex?: number; // Deprecated
  boardId: string;
  taskId: string;
  taskTitle: string;
}

export function DeleteTaskModal({ 
  isOpen, 
  onClose, 
  boardId,
  taskId,
  taskTitle 
}: DeleteTaskModalProps) {
  const deleteTask = useStore((state) => state.deleteTask);

  const handleDelete = async () => {
    try {
      await deleteTask(taskId, boardId);
      onClose();
    } catch (error) {
      console.error("Failed to delete task", error);
    }
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
