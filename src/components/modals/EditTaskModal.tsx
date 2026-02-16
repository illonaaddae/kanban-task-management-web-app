import { useState, useEffect } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { SubtaskInputs } from '../task/SubtaskInputs';
import { type Task } from '../../types';
import styles from './AddTaskModal.module.css';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  task: Task;
}

export function EditTaskModal({ isOpen, onClose, boardId, task }: EditTaskModalProps) {
  const boards = useStore((state) => state.boards);
  const updateTask = useStore((state) => state.updateTask);
  const moveTask = useStore((state) => state.moveTask);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<{ title: string; isCompleted: boolean }[]>([]);
  const [status, setStatus] = useState('');
  const [subtaskErrors, setSubtaskErrors] = useState<boolean[]>([]);

  const board = boards.find(b => b.id === boardId);
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setSubtasks(task.subtasks || []);
      setSubtaskErrors(new Array(task.subtasks?.length || 0).fill(false));
      setStatus(task.status);
    }
  }, [task]);

  const handleSubtaskChange = (index: number, value: string) => {
    const updated = [...subtasks];
    updated[index] = { ...updated[index], title: value };
    setSubtasks(updated);
    if (value.trim()) {
      const errs = [...subtaskErrors]; errs[index] = false; setSubtaskErrors(errs);
    }
  };

  const handleSubmit = async () => {
    if (!task?.id || !board) return;
    const errors = subtasks.map(st => st.title.trim() === '');
    if (errors.some(Boolean)) setSubtaskErrors(errors);
    if (!title.trim() || errors.some(Boolean)) return;

    const updatedData: Partial<Task> = {
      title: title.trim(), description: description.trim(),
      status, subtasks: subtasks.filter(st => st.title.trim())
    };

    try {
      if (status !== task.status) {
        await updateTask(task.id, updatedData, boardId);
        const targetCol = board.columns.find(c => c.name === status);
        await moveTask(task.id, status, targetCol ? targetCol.tasks.length : 0);
      } else {
        await updateTask(task.id, updatedData, boardId);
      }
      onClose();
    } catch (error) { console.error('Failed to update task', error); }
  };

  if (!task) return null;
  const subtaskTitles = subtasks.map(s => s.title);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Edit Task</h2>
      <div className={styles.content}>
        <Input label="Title" placeholder="e.g. Take coffee break" value={title}
          onChange={(e) => setTitle(e.target.value)} />
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea className={styles.textarea} value={description}
            placeholder="e.g. It's always good to take a break."
            onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <SubtaskInputs subtasks={subtaskTitles} subtaskErrors={subtaskErrors}
          onAdd={() => { setSubtasks([...subtasks, { title: '', isCompleted: false }]); setSubtaskErrors([...subtaskErrors, false]); }}
          onRemove={(i) => { setSubtasks(subtasks.filter((_, j) => j !== i)); setSubtaskErrors(subtaskErrors.filter((_, j) => j !== i)); }}
          onChange={handleSubtaskChange} />
        <Dropdown label="Status" value={status} onChange={setStatus} options={statusOptions} />
        <Button variant="primary" onClick={handleSubmit} size="large">Save Changes</Button>
      </div>
    </Modal>
  );
}
