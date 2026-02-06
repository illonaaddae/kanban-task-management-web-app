import { useState, useEffect } from 'react';
import { useBoard } from '../../context/BoardContext';
import { Modal } from './Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import styles from './AddBoardModal.module.css'; // Reuse same styles

interface EditBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardIndex: number;
}

export function EditBoardModal({ isOpen, onClose, boardIndex }: EditBoardModalProps) {
  const { boards, updateBoard } = useBoard();
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);

  const board = boards[boardIndex];

  // Pre-fill with existing board data
  useEffect(() => {
    if (board) {
      setName(board.name);
      setColumns(board.columns.map(col => col.name));
    }
  }, [board]);

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

  const handleSubmit = () => {
    if (!name.trim()) return;

    const filteredColumns = columns.filter(col => col.trim());
    if (filteredColumns.length === 0) return;

    const updatedBoard = {
      name: name.trim(),
      columns: filteredColumns.map(colName => {
        // Preserve existing tasks if column name unchanged
        const existingCol = board.columns.find(col => col.name === colName);
        return existingCol || { name: colName.trim(), tasks: [] };
      })
    };

    updateBoard(boardIndex, updatedBoard);
    onClose();
  };

  if (!board) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className={styles.title}>Edit Board</h2>

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
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
