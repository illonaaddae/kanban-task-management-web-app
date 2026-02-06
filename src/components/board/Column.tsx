import { type Column as ColumnType } from '../../types';
import { TaskCard } from './TaskCard';
import styles from './Column.module.css';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${columnIndex}`,
    data: {
      type: 'column',
      columnIndex,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Generate task IDs for sortable context
  const taskIds = column.tasks.map((_, taskIndex) => 
    `task-${boardIndex}-${columnIndex}-${taskIndex}`
  );

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={styles.column}
      {...attributes}
    >
      <div className={styles.header} {...listeners}>
        <div className={styles.colorDot} style={{ backgroundColor: color }} />
        <h3 className={styles.title}>
          {column.name} ({column.tasks.length})
        </h3>
      </div>
      
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={styles.taskList}>
          {column.tasks.map((task, taskIndex) => (
            <TaskCard
              key={`task-${boardIndex}-${columnIndex}-${taskIndex}`}
              task={task}
              boardIndex={boardIndex}
              columnIndex={columnIndex}
              taskIndex={taskIndex}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
