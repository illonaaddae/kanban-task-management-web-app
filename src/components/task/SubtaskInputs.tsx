import { Button } from '../ui/Button';
import styles from '../modals/AddTaskModal.module.css';

interface SubtaskInputsProps {
  subtasks: string[];
  subtaskErrors: boolean[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
}

export function SubtaskInputs({
  subtasks, subtaskErrors, onAdd, onRemove, onChange
}: SubtaskInputsProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>Subtasks</label>
      <div className={styles.subtasksList}>
        {subtasks.map((subtask, index) => (
          <div key={index} className={styles.subtaskItem}>
            <input
              className={`${styles.subtaskInput} ${subtaskErrors[index] ? styles.error : ''}`}
              placeholder="e.g. Make coffee"
              value={subtask}
              onChange={(e) => onChange(index, e.target.value)}
            />
            {subtaskErrors[index] && (
              <span className={styles.errorText}>Can't be empty</span>
            )}
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(index)}
              aria-label="Remove subtask"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={onAdd} size="small">
        + Add New Subtask
      </Button>
    </div>
  );
}
