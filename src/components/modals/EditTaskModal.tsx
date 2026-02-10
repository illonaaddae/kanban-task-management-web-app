import { useState, useEffect } from 'react';
import { useBoard } from '../../context/BoardContext';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import styles from './AddTaskModal.module.css'; // Reuse same styles

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex: number;
  columnIndex: number;
  taskIndex: number;
}

export function EditTaskModal({ isOpen, onClose, boardIndex, columnIndex, taskIndex }: EditTaskModalProps) {
  const { boards, updateTask, deleteTask, addTask } = useBoard();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<{ title: string; isCompleted: boolean }[]>([]);
  const [status, setStatus] = useState('');
  const [subtaskErrors, setSubtaskErrors] = useState<boolean[]>([]);

  const board = boards[boardIndex];
  const task = board?.columns[columnIndex]?.tasks[taskIndex];
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];

  // Pre-fill form with existing task data
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setSubtasks(task.subtasks || []);
      setSubtaskErrors(new Array(task.subtasks?.length || 0).fill(false));
      setStatus(task.status);
    }
  }, [task]);

  const handleAddSubtask = () => {
    setSubtasks([...subtasks, { title: '', isCompleted: false }]);
    setSubtaskErrors([...subtaskErrors, false]);
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
    setSubtaskErrors(subtaskErrors.filter((_, i) => i !== index));
  };

  const handleSubtaskChange = (index: number, value: string) => {
    const updated = [...subtasks];
    updated[index] = { ...updated[index], title: value };
    setSubtasks(updated);
    
    // Clear error if user starts typing
    if (value.trim()) {
      const updatedErrors = [...subtaskErrors];
      updatedErrors[index] = false;
      setSubtaskErrors(updatedErrors);
    }
  };

  const handleSubmit = () => {
    // Validate subtasks FIRST - check for empty subtasks
    const errors = subtasks.map(st => st.title.trim() === '');
    const hasEmptySubtasks = errors.some(error => error);
    
    // Always set errors if they exist
    if (hasEmptySubtasks) {
      setSubtaskErrors(errors);
    }
    
    // Check title after showing subtask errors
    if (!title.trim() || hasEmptySubtasks) {
      return; // Don't submit if title is empty or there are empty subtasks
    }

    const updatedTask = {
      ...task!,
      title: title.trim(),
      description: description.trim(),
      status,
      subtasks: subtasks.filter(st => st.title.trim())
    };

    // Check if status changed (need to move to different column)
    if (status !== task!.status) {
      const newColumnIndex = board.columns.findIndex(col => col.name === status);
      if (newColumnIndex !== -1) {
        // Delete from old column and add to new column
        deleteTask(boardIndex, columnIndex, taskIndex);
        addTask(boardIndex, newColumnIndex, updatedTask);
      }
    } else {
      // Just update in place
      updateTask(boardIndex, columnIndex, taskIndex, updatedTask);
    }

    onClose();
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Edit Task</h2>

      <div className={styles.content}>
        <Input
          label="Title"
          placeholder="e.g. Take coffee break"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            placeholder="e.g. It's always good to take a break. This 15 minute break will recharge the batteries a little."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Subtasks</label>
          <div className={styles.subtasksList}>
            {subtasks.map((subtask, index) => (
              <div key={index} className={styles.subtaskItem}>
                <input
                  className={`${styles.subtaskInput} ${subtaskErrors[index] ? styles.error : ''}`}
                  placeholder="e.g. Make coffee"
                  value={subtask.title}
                  onChange={(e) => handleSubtaskChange(index, e.target.value)}
                />
                {subtaskErrors[index] && (
                  <span className={styles.errorText}>Can't be empty</span>
                )}
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveSubtask(index)}
                  aria-label="Remove subtask"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={handleAddSubtask} size="small">
            + Add New Subtask
          </Button>
        </div>

        <Dropdown
          label="Status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />

        <Button variant="primary" onClick={handleSubmit} size="large">
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
