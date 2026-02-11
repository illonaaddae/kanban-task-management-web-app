import { useState } from 'react';
import { useStore } from '../../store/store';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
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

  const handleAddColumn = () => {
    setColumns([...columns, '']);
  };

  const handleRemoveColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  const handleColumnChange = (index: number, value: string) => {
    const updated = [...columns];
    updated[index] = value;
    setColumns(updated);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (!user) return; // Should not happen if modal is open (protected route)

    const filteredColumns = columns.filter(col => col.trim());
    if (filteredColumns.length === 0) return;

    // Create board object - backend will assign IDs
    const newBoard = {
      name: name.trim(),
      columns: filteredColumns.map(col => ({ name: col.trim(), tasks: [] }))
    };

    try {
        await createBoard(user.$id, newBoard);
        // createBoard action updates store and sets current board
        
        // Reset form
        setName('');
        setColumns(['Todo', 'Doing']);
        onClose();
    } catch (error) {
        // Error handling is managed by store/toast usually, or we can add local error state
        console.error("Failed to create board", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Add New Board</h2>

      <div className={styles.content}>
        <Input
          label="Board Name"
          placeholder="e.g. Web Design"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className={styles.field}>
          <label className={styles.label}>Board Columns</label>
          <div className={styles.columnsList}>
            {columns.map((column, index) => (
              <div key={index} className={styles.columnItem}>
                <input
                  className={styles.columnInput}
                  placeholder="e.g. Todo"
                  value={column}
                  onChange={(e) => handleColumnChange(index, e.target.value)}
                />
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveColumn(index)}
                  aria-label="Remove column"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={handleAddColumn} size="small">
            + Add New Column
          </Button>
        </div>

        <Button variant="primary" onClick={handleSubmit} size="large">
          Create New Board
        </Button>
      </div>
    </Modal>
  );
}
