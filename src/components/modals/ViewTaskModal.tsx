import { useState } from 'react';
import { type Task } from '../../types';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Checkbox } from '../ui/Checkbox';
import { Dropdown } from '../ui/Dropdown';
import { EditTaskModal } from './EditTaskModal';
import { DeleteTaskModal } from './DeleteTaskModal';
import styles from './ViewTaskModal.module.css';

interface ViewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  boardIndex?: number; // Deprecated
  columnIndex?: number; // Deprecated
  taskIndex?: number; // Deprecated
  boardId: string;
}

export function ViewTaskModal({ 
  isOpen, 
  onClose, 
  task, 
  boardId
}: ViewTaskModalProps) {
  const boards = useStore((state) => state.boards);
  const updateTask = useStore((state) => state.updateTask);
  const moveTask = useStore((state) => state.moveTask);
  
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const board = boards.find(b => b.id === boardId);
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];
  
  const handleToggleSubtask = async (subtaskIndex: number) => {
    if (!task.subtasks || !task.id) return;
    
    const updatedSubtasks = [...task.subtasks];
    updatedSubtasks[subtaskIndex] = {
      ...updatedSubtasks[subtaskIndex],
      isCompleted: !updatedSubtasks[subtaskIndex].isCompleted
    };
    
    try {
      await updateTask(task.id, { subtasks: updatedSubtasks }, boardId);
    } catch (error) {
      console.error("Failed to toggle subtask", error);
    }
  };
  
  const handleStatusChange = async (newStatus: string) => {
    if (!task.id) return;
    
    if (newStatus === task.status) return;

    try {
       // Move task to new column
       const targetCol = board?.columns.find(c => c.name === newStatus);
       const newIndex = targetCol ? targetCol.tasks.length : 0;
       
       await moveTask(task.id, newStatus, newIndex);
    } catch (error) {
       console.error("Failed to update status", error);
    }
  };

  const handleEditClick = () => {
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteModal(true);
  };

  if (!task) return null; // Should check this

  const completedCount = task.subtasks?.filter(st => st.isCompleted).length || 0;

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.header}>
        <h2 className={styles.title}>{task.title}</h2>
        <div className={styles.menuWrapper}>
          <button 
            className={styles.menuButton}
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Task options"
          >
            <svg width="5" height="20" viewBox="0 0 5 20" fill="currentColor">
              <circle cx="2.5" cy="2.5" r="2.5"/>
              <circle cx="2.5" cy="10" r="2.5"/>
              <circle cx="2.5" cy="17.5" r="2.5"/>
            </svg>
          </button>
          
          {showMenu && (
            <div className={styles.menu}>
              <button className={styles.menuItem} onClick={handleEditClick}>Edit Task</button>
              <button className={`${styles.menuItem} ${styles.delete}`} onClick={handleDeleteClick}>
                Delete Task
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.content}>
        {task.description && (
          <p className={styles.description}>{task.description}</p>
        )}

        {task.subtasks && task.subtasks.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionTitle}>
              Subtasks ({completedCount} of {task.subtasks.length})
            </p>
            <div className={styles.subtasks}>
              {task.subtasks.map((subtask, index) => (
                <Checkbox
                  key={index}
                  label={subtask.title}
                  checked={subtask.isCompleted}
                  onChange={() => handleToggleSubtask(index)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <Dropdown
            label="Current Status"
            value={task.status}
            onChange={handleStatusChange}
            options={statusOptions}
          />
        </div>
      </div>
    </Modal>
    
    {task.id && (
        <EditTaskModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          boardId={boardId}
          task={task}
        />
    )}
    
    {task.id && (
        <DeleteTaskModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            onClose(); // Also close the view modal after deletion
          }}
          boardId={boardId}
          taskId={task.id}
          taskTitle={task.title}
        />
    )}
    </>
  );
}
