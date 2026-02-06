import { type Task } from '../../types';
import { useModal } from '../../hooks/useModal';
import { ViewTaskModal } from '../modals/ViewTaskModal';
import styles from './TaskCard.module.css';

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

  return (
    <>
      <div className={styles.card} onClick={viewModal.open}>
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
