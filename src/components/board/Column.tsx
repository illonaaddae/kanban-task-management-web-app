import { type Column as ColumnType } from '../../types';
import { TaskCard } from './TaskCard';
import styles from './Column.module.css';

interface ColumnProps {
  column: ColumnType;
  boardIndex: number;
  columnIndex: number;
}

const COLUMN_COLORS = [
  '#49C4E5',  // Cyan
  '#8471F2',  // Purple
  '#67E2AE',  // Green
];

export function Column({ column, boardIndex, columnIndex }: ColumnProps) {
  const color = COLUMN_COLORS[columnIndex % COLUMN_COLORS.length];

  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <div className={styles.colorDot} style={{ backgroundColor: color }} />
        <h3 className={styles.title}>
          {column.name} ({column.tasks.length})
        </h3>
      </div>
      
      <div className={styles.taskList}>
        {column.tasks.map((task, taskIndex) => (
          <TaskCard
            key={taskIndex}
            task={task}
            boardIndex={boardIndex}
            columnIndex={columnIndex}
            taskIndex={taskIndex}
          />
        ))}
      </div>
    </div>
  );
}
