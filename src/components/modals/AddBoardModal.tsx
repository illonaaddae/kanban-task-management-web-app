import { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    const filtered = columns.filter(c => c.trim());
    if (!filtered.length) return;

    try {
      await createBoard(user.id, {
        name: name.trim(),
        columns: filtered.map(c => ({ name: c.trim(), tasks: [] }))
      });
      toast.success(`Board '${name.trim()}' created!`);
      setName(''); setColumns(['Todo', 'Doing']); onClose();
    } catch (error) {
      console.error('Failed to create board', error);
      toast.error('Failed to create board');
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
        <Button type="submit" variant="primary" size="large">Create New Board</Button>
      </form>
    </Modal>
  );
}
