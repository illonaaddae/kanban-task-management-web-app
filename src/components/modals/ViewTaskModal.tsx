import { useState } from 'react';
import { type Task } from '../../types';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Checkbox } from '../ui/Checkbox';
import { Dropdown } from '../ui/Dropdown';
import { EditTaskModal } from './EditTaskModal';
import { DeleteTaskModal } from './DeleteTaskModal';
import { TaskActionsMenu } from '../task/TaskActionsMenu';
import styles from './ViewTaskModal.module.css';

interface ViewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  boardIndex?: number;
  columnIndex?: number;
  taskIndex?: number;
  boardId: string;
}

export function ViewTaskModal({ isOpen, onClose, task, boardId }: ViewTaskModalProps) {
  const boards = useStore((state) => state.boards);
  const updateTask = useStore((state) => state.updateTask);
  const moveTask = useStore((state) => state.moveTask);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const board = boards.find(b => b.id === boardId);
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];
  const completedCount = task.subtasks?.filter(st => st.isCompleted).length || 0;

  const handleToggleSubtask = async (subtaskIndex: number) => {
    if (!task.subtasks || !task.id) return;
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex] = { ...updatedSubtasks[subtaskIndex], isCompleted: !updatedSubtasks[subtaskIndex].isCompleted };
    try { await updateTask(task.id, { subtasks: updatedSubtasks }, boardId); }
    catch (error) { console.error('Failed to toggle subtask', error); }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task.id || newStatus === task.status) return;
    try {
      const targetCol = board?.columns.find(c => c.name === newStatus);
      await moveTask(task.id, newStatus, targetCol ? targetCol.tasks.length : 0);
    } catch (error) { console.error('Failed to update status', error); }
  };

  if (!task) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className={styles.header}>
          <h2 className={styles.title}>{task.title}</h2>
          <TaskActionsMenu onEdit={() => setShowEditModal(true)} onDelete={() => setShowDeleteModal(true)} />
        </div>
        <div className={styles.content}>
          <div className={styles.section}>
            <Dropdown label="Current Status" value={task.status} onChange={handleStatusChange} options={statusOptions} />
          </div>
          {task.description && <p className={styles.description}>{task.description}</p>}
          {task.subtasks && task.subtasks.length > 0 && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Subtasks ({completedCount} of {task.subtasks.length})</p>
              <div className={styles.subtasks}>
                {task.subtasks.map((subtask, index) => (
                  <Checkbox key={index} label={subtask.title} checked={subtask.isCompleted}
                    onChange={() => handleToggleSubtask(index)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
      {task.id && <EditTaskModal isOpen={showEditModal} onClose={() => setShowEditModal(false)} boardId={boardId} task={task} />}
      {task.id && (
        <DeleteTaskModal isOpen={showDeleteModal}
          onClose={() => { setShowDeleteModal(false); onClose(); }}
          boardId={boardId} taskId={task.id} taskTitle={task.title} />
      )}
    </>
  );
}
