import { useState, type FormEvent } from 'react';
import { useCreateBoard } from '../../queries/mutations';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ColumnInputs } from '../board/ColumnInputs';
import { Dropdown } from '../ui/Dropdown';
import { useOrganizations } from '../../queries/orgs';
import toast from 'react-hot-toast';
import styles from './AddBoardModal.module.css';

interface AddBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBoardModal({ isOpen, onClose }: AddBoardModalProps) {
  const createBoard = useCreateBoard();
  // Teams the caller is in. A board put in a team is reachable by every member,
  // which is how a teammate gets to work without a per-board invitation.
  const { data: organizations = [] } = useOrganizations();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>(['Todo', 'Doing']);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    const filtered = columns.filter(c => c.trim());
    if (!filtered.length) return;

    // Creating a board is one request per column plus the board itself, so it
    // takes a couple of seconds. Show that here rather than letting the page
    // behind the modal blank out, and block a second submit.
    setSaving(true);
    try {
      await createBoard.mutateAsync({
        name: name.trim(),
        columns: filtered.map(c => ({ name: c.trim(), tasks: [] })),
        // '' means personal, which the API expresses by omitting the key.
        ...(organizationId ? { organizationId } : {}),
      });
      toast.success(`Board '${name.trim()}' created!`);
      setName(''); setColumns(['Todo', 'Doing']); setOrganizationId(''); onClose();
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
        {organizations.length > 0 && (
          <Dropdown
            label="Team (optional)"
            value={organizationId}
            onChange={setOrganizationId}
            options={[
              { value: '', label: 'Just me' },
              ...organizations.map((org) => ({ value: org.id, label: org.name })),
            ]}
          />
        )}
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
