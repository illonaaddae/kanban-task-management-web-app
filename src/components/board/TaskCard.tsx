import { memo } from 'react';
import { type Task } from '../../types';
import { useModal } from '../../hooks/useModal';
import { ViewTaskModal } from '../modals/ViewTaskModal';
import styles from './TaskCard.module.css';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBoardPermissions } from '../../hooks/useBoardPermissions';

interface TaskCardProps {
  task: Task;
  columnIndex: number;
  taskIndex: number;
  boardId: string;
}

export const TaskCard = memo(function TaskCard({ task, columnIndex, taskIndex, boardId }: TaskCardProps) {
  const viewModal = useModal();
  const { canEdit } = useBoardPermissions();
  
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
    id: `task-${columnIndex}-${taskIndex}`,
    disabled: !canEdit,
    data: {
      type: 'task',
      task,
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

  // Viewers can still open a card to read it — they just get no drag listeners.

  return (
    <>
      <div 
        ref={setNodeRef}
        style={style}
        className={styles.card}
        onClick={handleClick}
        {...attributes}
        {...(canEdit ? listeners : {})}
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
        columnIndex={columnIndex}
        taskIndex={taskIndex}
        boardId={boardId}
      />
    </>
  );
});
