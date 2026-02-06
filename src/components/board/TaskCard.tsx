import { type Task } from '../../types';
import { useModal } from '../../hooks/useModal';
import { ViewTaskModal } from '../modals/ViewTaskModal';
import styles from './TaskCard.module.css';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
  boardIndex: number;
  columnIndex: number;
  taskIndex: number;
}

export function TaskCard({ task, boardIndex, columnIndex, taskIndex }: TaskCardProps) {
  const viewModal = useModal();
  
  const completedSubtasks = task.subtasks.filter(st => st.isCompleted).length;
  const totalSubtasks = task.subtasks.length;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${boardIndex}-${columnIndex}-${taskIndex}`,
    data: {
      type: 'task',
      task,
      boardIndex,
      columnIndex,
      taskIndex,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    // Only open modal if not currently dragging
    if (!isDragging) {
      viewModal.open();
    }
  };

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        className={styles.card}
        onClick={handleClick}
        {...attributes}
        {...listeners}
      >
        <h4 className={styles.title}>{task.title}</h4>
        <p className={styles.subtaskCount}>
          {completedSubtasks} of {totalSubtasks} subtasks
        </p>
      </div>

      <ViewTaskModal
        isOpen={viewModal.isOpen}
        onClose={viewModal.close}
        task={task}
        boardIndex={boardIndex}
        columnIndex={columnIndex}
        taskIndex={taskIndex}
      />
    </>
  );
}
