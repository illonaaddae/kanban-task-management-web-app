import { useState, type FormEvent } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ColumnInputs } from '../board/ColumnInputs';
import toast from 'react-hot-toast';
import styles from './AddBoardModal.module.css';

interface AddBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBoardModal({ isOpen, onClose }: AddBoardModalProps) {
  const createBoard = useStore((state) => state.createBoard);
  const user = useStore((state) => state.user);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>(['Todo', 'Doing']);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !user || saving) return;
    const filtered = columns.filter(c => c.trim());
    if (!filtered.length) return;

    // Creating a board is one request per column plus the board itself, so it
    // takes a couple of seconds. Show that here rather than letting the page
    // behind the modal blank out, and block a second submit.
    setSaving(true);
    try {
      await createBoard(user.id, {
        name: name.trim(),
        columns: filtered.map(c => ({ name: c.trim(), tasks: [] }))
      });
      toast.success(`Board '${name.trim()}' created!`);
      setName(''); setColumns(['Todo', 'Doing']); onClose();
    } catch (error) {
      // Show the API's own message — "requires owner access", a validation
      // detail, or the request timeout — rather than a generic failure.
      toast.error(error instanceof Error ? error.message : 'Failed to create board');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Add New Board</h2>
      <form onSubmit={handleSubmit} className={styles.content}>
        <Input label="Board Name" placeholder="e.g. Web Design" value={name}
          onChange={(e) => setName(e.target.value)} />
        <ColumnInputs columns={columns}
          onAdd={() => setColumns([...columns, ''])}
          onRemove={(i) => setColumns(columns.filter((_, j) => j !== i))}
          onChange={(i, v) => { const u = [...columns]; u[i] = v; setColumns(u); }} />
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? 'Creating board…' : 'Create New Board'}
        </Button>
      </form>
    </Modal>
  );
}
