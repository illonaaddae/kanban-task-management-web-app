import { useState } from 'react';
import { useBoard } from '../../context/BoardContext';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex: number;
}

export function AddTaskModal({ isOpen, onClose, boardIndex }: AddTaskModalProps) {
  const { boards, addTask } = useBoard();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>(['', '']);
  const [status, setStatus] = useState('');

  const board = boards[boardIndex];
  const statusOptions = board.columns.map(col => ({ value: col.name, label: col.name }));

  // Set default status to first column
  if (!status && statusOptions.length > 0) {
    setStatus(statusOptions[0].value);
  }

  const handleAddSubtask = () => {
    setSubtasks([...subtasks, '']);
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubtaskChange = (index: number, value: string) => {
    const updated = [...subtasks];
    updated[index] = value;
    setSubtasks(updated);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const columnIndex = board.columns.findIndex(col => col.name === status);
    if (columnIndex === -1) return;

    const newTask = {
      title: title.trim(),
      description: description.trim(),
      status,
      subtasks: subtasks
        .filter(st => st.trim())
        .map(st => ({ title: st.trim(), isCompleted: false }))
    };

    addTask(boardIndex, columnIndex, newTask);

    // Reset form
    setTitle('');
    setDescription('');
    setSubtasks(['', '']);
    setStatus(statusOptions[0]?.value || '');
    onClose();
  };

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
            {subtasks.map ((subtask, index) => (
              <div key={index} className={styles.subtaskItem}>
                <input
                  className={styles.subtaskInput}
                  placeholder="e.g. Make coffee"
                  value={subtask}
                  onChange={(e) => handleSubtaskChange(index, e.target.value)}
                />
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
