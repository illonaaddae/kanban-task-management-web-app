import { useState, useEffect, type FormEvent } from 'react';
import { useUpdateBoard } from '../../queries/mutations';
import { useBoards } from '../../queries/boards';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ColumnInputs } from '../board/ColumnInputs';
import toast from 'react-hot-toast';
import styles from './AddBoardModal.module.css';

interface EditBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex?: number;
  boardId?: string;
}

export function EditBoardModal({ isOpen, onClose, boardIndex, boardId }: EditBoardModalProps) {
  const { data: boards = [] } = useBoards();
  const updateBoard = useUpdateBoard();
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const board = boardId ? boards.find(b => b.id === boardId)
    : (typeof boardIndex === 'number' ? boards[boardIndex] : null);

  useEffect(() => {
    if (board) { setName(board.name); setColumns(board.columns.map(c => c.name)); }
  }, [board]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !board?.id || saving) return;
    const filtered = columns.filter(c => c.trim());
    if (!filtered.length) return;

    const updatedData = {
      name: name.trim(),
      columns: filtered.map(colName => {
        const existing = board.columns.find(c => c.name === colName);
        return existing || { name: colName.trim(), tasks: [] };
      })
    };

    setSaving(true);
    try {
      await updateBoard.mutateAsync({ boardId: board.id, updates: updatedData });
      toast.success('Board updated successfully!');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update board');
    } finally {
      setSaving(false);
    }
  };

  if (!board) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Edit Board</h2>
      <form onSubmit={handleSubmit} className={styles.content}>
        <Input label="Board Name" placeholder="e.g. Web Design" value={name}
          onChange={(e) => setName(e.target.value)} />
        <ColumnInputs columns={columns}
          onAdd={() => setColumns([...columns, ''])}
          onRemove={(i) => setColumns(columns.filter((_, j) => j !== i))}
          onChange={(i, v) => { const u = [...columns]; u[i] = v; setColumns(u); }} />
        <Button type="submit" variant="primary" size="large" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </form>
    </Modal>
  );
}
