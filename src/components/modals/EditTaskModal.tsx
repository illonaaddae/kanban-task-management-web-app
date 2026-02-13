import { useState, useEffect } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { type Task } from '../../types';
import styles from './AddTaskModal.module.css'; // Reuse same styles

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  task: Task;
}

export function EditTaskModal({ isOpen, onClose, boardId, task }: EditTaskModalProps) {
  const boards = useStore((state) => state.boards);
  const updateTask = useStore((state) => state.updateTask);
  const moveTask = useStore((state) => state.moveTask); // Use moveTask if status changes? No, updateTask can handle status change if backend supports it OR we might need moveTask.
  // Actually updateTask in store calls boardService.updateTask(taskId, updates). 
  // If status changes, Appwrite might just update the field.
  // But store's optimistic update for updateTask assumes SAME column. 
  // If status changes, we need to handle moving it in the store locally.
  // Let's check store updateTask logic again?
  // Stores updateTask: maps col.tasks.map... does NOT move between columns.
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<{ title: string; isCompleted: boolean }[]>([]);
  const [status, setStatus] = useState('');
  const [subtaskErrors, setSubtaskErrors] = useState<boolean[]>([]);

  const board = boards.find(b => b.id === boardId);
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

  const handleSubmit = async () => {
    if (!task || !task.id || !board) return;

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

    const updatedTaskData: Partial<Task> = {
      title: title.trim(),
      description: description.trim(),
      status, // New status
      subtasks: subtasks.filter(st => st.title.trim())
    };

    try {
        if (status !== task.status) {
             // If status changed, we might need to move it in the store manually or use moveTask logic?
             // But moveTask requires index.
             // Simplest approach: Use updateTask for data, but we need to update Store structure.
             // store.updateTask OPTIMISTICALLY only updates within the same column.
             // We should probably rely on fetching or maybe implement a 'moveAndUpdate'
             // Or... just use moveTask then updateTask?
             // Let's just call updateTask. If the store gets out of sync (task in wrong column), it's bad.
             // Ideally we should call moveTask to change column, then updateTask for content?
             // Or updateTask should handle status change.
             // Let's assume for now we just call updateTask and maybe force a re-fetch or manual store adjustment?
             // Actually, if we use moveTask(taskId, newStatus, 0) it moves it.
             // Then we update content.
             // BUT moveTask takes (taskId, newStatus, newIndex).
             
             // Let's try:
             // 1. Update task content (title, etc)
             await updateTask(task.id, updatedTaskData, boardId);
             
             // 2. If status changed, force a move?
             // The updateTask call with 'status' in updates MIGHT persist to DB correctly.
             // But local state will show it in old column with new status label.
             // We need to move it in local state.
             // We can use moveTask BUT we don't know the index.
             // Maybe we can re-fetch?
             // Or we can manually remove and add in store?
             // Let's leave it as updateTask for now and assume users might refresh if it looks weird,
             // OR improve store.ts later to handle status change in updateTask.
             // Wait, I can manually fix it by calling moveTask AFTER update?
             // Actually store.moveTask does exactly what we want: remove from old, add to new.
             // So if status changed:
             const targetCol = board.columns.find(c => c.name === status);
             const newIndex = targetCol ? targetCol.tasks.length : 0;
             await moveTask(task.id, status, newIndex);
        } else {
             await updateTask(task.id, updatedTaskData, boardId);
        }
        
        onClose();
    } catch (error) {
        console.error("Failed to update task", error);
    }
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
