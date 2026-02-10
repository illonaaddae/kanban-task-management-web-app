import { useParams, Navigate } from 'react-router-dom';
import { useBoard } from '../context/BoardContext';
import toast from 'react-hot-toast';
import { Column } from '../components/board/Column';
import { EmptyBoard } from '../components/board/EmptyBoard';
import { EditBoardModal } from '../components/modals/EditBoardModal';
import { useModal } from '../hooks/useModal';
import styles from './BoardView.module.css';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';

export function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, reorderTasksInColumn, moveTaskBetweenColumns, reorderColumns, updateBoard } = useBoard();
  const [activeId, setActiveId] = useState<string | null>(null);
  const editModal = useModal();
  
  // Convert boardId from URL to number
  const boardIndex = boardId ? parseInt(boardId, 10) : null;
  const board = boardIndex !== null && boardIndex >= 0 && boardIndex < boards.length 
    ? boards[boardIndex] 
    : null;

  // Handle adding a new column directly
  const handleAddColumn = () => {
    if (!board || boardIndex === null) return;
    
    const newColumnName = `New Column`;
    const updatedBoard = {
      ...board,
      columns: [...board.columns, { name: newColumnName, tasks: [] }]
    };
    
    updateBoard(boardIndex, updatedBoard);
    toast.success(`Column "${newColumnName}" added!`);
  };
  
  // Redirect to dashboard if invalid board ID
  if (boardId && !board) {
    return <Navigate to="/" replace />;
  }

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !board || boardIndex === null) {
      setActiveId(null);
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Handle column reordering
    if (activeIdStr.startsWith('column-') && overIdStr.startsWith('column-')) {
      const oldIndex = parseInt(activeIdStr.split('-')[1]);
      const newIndex = parseInt(overIdStr.split('-')[1]);
      
      if (oldIndex !== newIndex) {
        reorderColumns(boardIndex, oldIndex, newIndex);
      }
    }
    // Handle task dragging
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('task-')) {
      const [, , activeColIdx, activeTaskIdx] = activeIdStr.split('-').map(Number);
      const [, , overColIdx, overTaskIdx] = overIdStr.split('-').map(Number);

      if (activeColIdx === overColIdx) {
        // Reorder within same column
        if (activeTaskIdx !== overTaskIdx) {
          reorderTasksInColumn(boardIndex, activeColIdx, activeTaskIdx, overTaskIdx);
        }
      } else {
        // Move between columns
        moveTaskBetweenColumns(boardIndex, activeColIdx, overColIdx, activeTaskIdx, overTaskIdx);
      }
    }
    // Handle task dropped on column (add to end)
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('column-')) {
      const [, , activeColIdx, activeTaskIdx] = activeIdStr.split('-').map(Number);
      const newColIdx = parseInt(overIdStr.split('-')[1]);
      
      if (activeColIdx !== newColIdx) {
        const newIndex = board.columns[newColIdx].tasks.length;
        moveTaskBetweenColumns(boardIndex, activeColIdx, newColIdx, activeTaskIdx, newIndex);
      }
    }

    setActiveId(null);
  };

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={styles.container}>
        <SortableContext
          items={board.columns.map((_, index) => `column-${index}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className={styles.board}>
            {board.columns.map((column, index) => (
              <Column
                key={`column-${index}`}
                column={column}
                boardIndex={boardIndex!}
                columnIndex={index}
              />
            ))}
            
            <button className={styles.newColumn} onClick={handleAddColumn}>
              + New Column
            </button>
          </div>
        </SortableContext>
      </div>
      
      <DragOverlay>
        {activeId ? <div className={styles.dragOverlay}>Dragging...</div> : null}
      </DragOverlay>
      
      {boardIndex !== null && (
        <EditBoardModal
          isOpen={editModal.isOpen}
          onClose={editModal.close}
          boardIndex={boardIndex}
        />
      )}
    </DndContext>
  );
}
