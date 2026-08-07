import { useState, type FormEvent } from 'react';
import { useCreateTask } from '../../queries/mutations';
import { useBoards } from '../../queries/boards';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown } from '../ui/Dropdown';
import { SubtaskInputs } from '../task/SubtaskInputs';
import { TaskMetaFields } from '../task/TaskMetaFields';
import { fromDateInputValue } from '../task/taskMeta';
import toast from 'react-hot-toast';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number;
  boardId?: string;
}

export function AddTaskModal({ isOpen, onClose, boardIndex, boardId }: AddTaskModalProps) {
  const createTask = useCreateTask();
  const { data: boards = [] } = useBoards();

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>(['', '']);
  const [status, setStatus] = useState('');
  const [subtaskErrors, setSubtaskErrors] = useState<boolean[]>([false, false]);
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const board = boardId ? boards.find(b => b.id === boardId)
    : (typeof boardIndex === 'number' ? boards[boardIndex] : null);
  const statusOptions = board?.columns.map(col => ({ value: col.name, label: col.name })) || [];

  if (!status && statusOptions.length > 0) setStatus(statusOptions[0].value);

  const handleSubtaskChange = (index: number, value: string) => {
    const updated = [...subtasks]; updated[index] = value; setSubtasks(updated);
    if (value.trim()) {
      const errs = [...subtaskErrors]; errs[index] = false; setSubtaskErrors(errs);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Without this a second click - or Enter while the first request is in
    // flight - creates the task twice.
    if (!board?.id || saving) return;
    let hasError = false;
    if (!title.trim()) { setTitleError('Title cannot be empty'); hasError = true; }
    else { setTitleError(''); }

    const errors = subtasks.map(st => st.trim() === '');
    if (errors.some(Boolean)) { setSubtaskErrors(errors); hasError = true; }

    if (hasError) return;

    setSaving(true);
    try {
      await createTask.mutateAsync({
        boardId: board.id,
        task: {
          title: title.trim(), description: description.trim(), status,
          // Send the column id when we have it - the API needs it, and resolving
          // by name costs an extra request.
          columnId: board.columns.find(col => col.name === status)?.id,
          dueDate: fromDateInputValue(dueDate),
          assignedTo: assignedTo || null,
          subtasks: subtasks.filter(st => st.trim()).map(st => ({ title: st.trim(), isCompleted: false })),
        },
      });
      toast.success(`Task '${title.trim()}' created!`);
      setTitle(''); setTitleError(''); setDescription(''); setSubtasks(['', '']);
      setSubtaskErrors([false, false]); setStatus(statusOptions[0]?.value || '');
      setDueDate(''); setAssignedTo('');
      onClose();
    } catch (error) {
      // Show the API's message - "Assignee must be a member of this board" and
      // "requires editor access" are both more useful than a generic failure.
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  if (!board) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Add New Task</h2>
      <form onSubmit={handleSubmit} className={styles.content}>
        <Input label="Title" placeholder="e.g. Take coffee break" value={title}
          maxLength={100} error={titleError}
          onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError(''); }} />
        <Dropdown label="Status" value={status} onChange={setStatus} options={statusOptions} />
        <div className={styles.field}>
          <div className={styles.labelRow}>
             <label className={styles.label}>Description</label>
             <span className={styles.charCount}>{description.length}/500</span>
          </div>
          <textarea className={styles.textarea} value={description} maxLength={500}
            placeholder="e.g. It's always good to take a break."
            onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <TaskMetaFields
          boardId={board.id!}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
          assignedTo={assignedTo}
          onAssignedToChange={setAssignedTo}
        />
        <SubtaskInputs subtasks={subtasks} subtaskErrors={subtaskErrors}
          onAdd={() => { setSubtasks([...subtasks, '']); setSubtaskErrors([...subtaskErrors, false]); }}
          onRemove={(i) => { setSubtasks(subtasks.filter((_, j) => j !== i)); setSubtaskErrors(subtaskErrors.filter((_, j) => j !== i)); }}
          onChange={handleSubtaskChange} />
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? 'Creating task…' : 'Create Task'}
        </Button>
      </form>
    </Modal>
  );
}
