import { useState, useEffect } from 'react';
import { useStore } from '../../store/store';
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
  const boards = useStore((state) => state.boards);
  const updateBoard = useStore((state) => state.updateBoard);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);

  const board = boardId ? boards.find(b => b.id === boardId)
    : (typeof boardIndex === 'number' ? boards[boardIndex] : null);

  useEffect(() => {
    if (board) { setName(board.name); setColumns(board.columns.map(c => c.name)); }
  }, [board]);

  const handleSubmit = async () => {
    if (!name.trim() || !board?.id) return;
    const filtered = columns.filter(c => c.trim());
    if (!filtered.length) return;

    const updatedData = {
      name: name.trim(),
      columns: filtered.map(colName => {
        const existing = board.columns.find(c => c.name === colName);
        return existing || { name: colName.trim(), tasks: [] };
      })
    };

    try {
      await updateBoard(board.id, updatedData);
      toast.success('Board updated successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to update board', error);
      toast.error('Failed to update board');
    }
  };

  if (!board) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Edit Board</h2>
      <div className={styles.content}>
        <Input label="Board Name" placeholder="e.g. Web Design" value={name}
          onChange={(e) => setName(e.target.value)} />
        <ColumnInputs columns={columns}
          onAdd={() => setColumns([...columns, ''])}
          onRemove={(i) => setColumns(columns.filter((_, j) => j !== i))}
          onChange={(i, v) => { const u = [...columns]; u[i] = v; setColumns(u); }} />
        <Button variant="primary" onClick={handleSubmit} size="large">Save Changes</Button>
      </div>
    </Modal>
  );
}
