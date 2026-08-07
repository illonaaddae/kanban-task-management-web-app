import { useState, type FormEvent } from 'react';
import { useCreateColumn } from '../../queries/mutations';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';
import styles from './AddBoardModal.module.css';

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  /** Existing column names, to catch a duplicate before the request. */
  existingNames: string[];
}

/**
 * Names a new column before creating it.
 *
 * "+ New Column" previously created a column literally called "New Column" and
 * left the user to rename it through the Edit Board flow - which meant nobody
 * ever got the name they wanted on the first try.
 */
export function AddColumnModal({ isOpen, onClose, boardId, existingNames }: AddColumnModalProps) {
  const createColumn = useCreateColumn();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Column name cannot be empty');
      return;
    }
    // Two columns sharing a name is legal server-side but confusing here, since
    // a task's status is the column's name.
    if (existingNames.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setError('This board already has a column with that name');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await createColumn.mutateAsync({ boardId, name: trimmed });
      toast.success(`Column '${trimmed}' added`);
      setName('');
      onClose();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not add the column');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Add New Column</h2>
      <form onSubmit={handleSubmit} className={styles.content}>
        <Input
          label="Column Name"
          placeholder="e.g. In Review"
          value={name}
          maxLength={80}
          error={error}
          autoFocus
          onChange={(event) => {
            setName(event.target.value);
            if (event.target.value.trim()) setError('');
          }}
        />
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? 'Adding column…' : 'Add Column'}
        </Button>
      </form>
    </Modal>
  );
}
