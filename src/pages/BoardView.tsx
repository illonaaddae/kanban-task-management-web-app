import { useBoard } from '../context/BoardContext';
import { Column } from '../components/board/Column';
import { EmptyBoard } from '../components/board/EmptyBoard';
import styles from './BoardView.module.css';

export function BoardView() {
  const { boards, activeBoard } = useBoard();
  
  const board = activeBoard !== null ? boards[activeBoard] : null;
  
  if (!board) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No board selected. Choose a board from the sidebar to get started.</p>
        </div>
      </div>
    );
  }
  
  if (!board.columns || board.columns.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyBoard onAddColumn={() => console.log('Add column')} />
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.board}>
        {board.columns.map((column, index) => (
          <Column key={index} column={column} boardIndex={activeBoard!} columnIndex={index} />
        ))}
        
        <button className={styles.newColumn}>
          + New Column
        </button>
      </div>
    </div>
  );
}
