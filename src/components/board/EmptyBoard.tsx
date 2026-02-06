import { Button } from '../ui/Button';
import styles from './EmptyBoard.module.css';

interface EmptyBoardProps {
  onAddColumn: () => void;
}

export function EmptyBoard({ onAddColumn }: EmptyBoardProps) {
  return (
    <div className={styles.container}>
      <p className={styles.text}>
        This board is empty. Create a new column to get started.
      </p>
      <Button onClick={onAddColumn}>+ Add New Column</Button>
    </div>
  );
}
