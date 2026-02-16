import { Button } from '../ui/Button';
import styles from '../modals/AddBoardModal.module.css';

interface ColumnInputsProps {
  columns: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
}

export function ColumnInputs({ columns, onAdd, onRemove, onChange }: ColumnInputsProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>Board Columns</label>
      <div className={styles.columnsList}>
        {columns.map((column, index) => (
          <div key={index} className={styles.columnItem}>
            <input
              className={styles.columnInput}
              placeholder="e.g. Todo"
              value={column}
              onChange={(e) => onChange(index, e.target.value)}
            />
            <button type="button" className={styles.removeButton}
              onClick={() => onRemove(index)} aria-label="Remove column">
              ×
            </button>
          </div>
        ))}
      </div>
      <Button variant="secondary" onClick={onAdd} size="small">
        + Add New Column
      </Button>
    </div>
  );
}
