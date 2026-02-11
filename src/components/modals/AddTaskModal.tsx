import { useState } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number; // Deprecated
  boardId?: string;    // New
}

export function AddTaskModal({ isOpen, onClose, boardIndex, boardId }: AddTaskModalProps) {
  const createTask = useStore((state) => state.createTask);
  const boards = useStore((state) => state.boards);
  const user = useStore((state) => state.user);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>(['', '']);
  const [status, setStatus] = useState('');
  const [subtaskErrors, setSubtaskErrors] = useState<boolean[]>([false, false]);

  // Resolve board
  const board = boardId 
    ? boards.find(b => b.id === boardId) 
    : (typeof boardIndex === 'number' ? boards[boardIndex] : null);

  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];

  // Set default status to first column
  if (!status && statusOptions.length > 0) {
    setStatus(statusOptions[0].value);
  }

  const handleAddSubtask = () => {
    setSubtasks([...subtasks, '']);
    setSubtaskErrors([...subtaskErrors, false]);
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
    setSubtaskErrors(subtaskErrors.filter((_, i) => i !== index));
  };

  const handleSubtaskChange = (index: number, value: string) => {
    const updated = [...subtasks];
    updated[index] = value;
    setSubtasks(updated);
    
    // Clear error if user starts typing
    if (value.trim()) {
      const updatedErrors = [...subtaskErrors];
      updatedErrors[index] = false;
      setSubtaskErrors(updatedErrors);
    }
  };

  const handleSubmit = async () => {
    if (!board || !board.id || !user) return;

    // Validate subtasks FIRST - check for empty subtasks
    const errors = subtasks.map(st => st.trim() === '');
    const hasEmptySubtasks = errors.some(error => error);
    
    // Always set errors if they exist
    if (hasEmptySubtasks) {
      setSubtaskErrors(errors);
    }
    
    // Check title after showing subtask errors
    if (!title.trim() || hasEmptySubtasks) {
      return; // Don't submit if title is empty or there are empty subtasks
    }

    const newTask = {
      title: title.trim(),
      description: description.trim(),
      status, // status is the column name
      subtasks: subtasks
        .filter(st => st.trim())
        .map(st => ({ title: st.trim(), isCompleted: false }))
    };

    try {
        await createTask(board.id, user.$id, newTask);
        
        // Reset form
        setTitle('');
        setDescription('');
        setSubtasks(['', '']);
        setSubtaskErrors([false, false]);
        setStatus(statusOptions[0]?.value || '');
        onClose();
    } catch (error) {
        console.error("Failed to create task", error);
    }
  };

  if (!board) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Add New Task</h2>

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
                  value={subtask}
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
          Create Task
        </Button>
      </div>
    </Modal>
  );
}
