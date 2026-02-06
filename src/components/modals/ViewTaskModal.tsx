import { useState } from 'react';
import { type Task } from '../../types';
import { useBoard } from '../../context/BoardContext';
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
  boardIndex: number;
  columnIndex: number;
  taskIndex: number;
}

export function ViewTaskModal({ 
  isOpen, 
  onClose, 
  task, 
  boardIndex, 
  columnIndex, 
  taskIndex 
}: ViewTaskModalProps) {
  const { boards, toggleSubtask, updateTask } = useBoard();
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const board = boards[boardIndex];
  const statusOptions = board.columns.map(col => ({ value: col.name, label: col.name }));
  
  const handleToggleSubtask = (subtaskIndex: number) => {
    toggleSubtask(boardIndex, columnIndex, taskIndex, subtaskIndex);
  };
  
  const handleStatusChange = (newStatus: string) => {
    const updatedTask = { ...task, status: newStatus };
    updateTask(boardIndex, columnIndex, taskIndex, updatedTask);
  };

  const handleEditClick = () => {
    setShowMenu(false);
    setShowEditModal(true);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteModal(true);
  };

  const completedCount = task.subtasks.filter(st => st.isCompleted).length;

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

        {task.subtasks.length > 0 && (
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
    
    <EditTaskModal
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
      boardIndex={boardIndex}
      columnIndex={columnIndex}
      taskIndex={taskIndex}
    />
    
    <DeleteTaskModal
      isOpen={showDeleteModal}
      onClose={() => {
        setShowDeleteModal(false);
        onClose(); // Also close the view modal after deletion
      }}
      boardIndex={boardIndex}
      columnIndex={columnIndex}
      taskIndex={taskIndex}
      taskTitle={task.title}
    />
    </>
  );
}
