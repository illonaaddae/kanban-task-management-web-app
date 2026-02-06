import { useBoard } from '../context/BoardContext';
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
  const { boards, activeBoard, reorderTasksInColumn, moveTaskBetweenColumns, reorderColumns } = useBoard();
  const [activeId, setActiveId] = useState<string | null>(null);
  const editModal = useModal();
  
  const board = activeBoard !== null ? boards[activeBoard] : null;

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
    
    if (!over || !board || activeBoard === null) {
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
        reorderColumns(activeBoard, oldIndex, newIndex);
      }
    }
    // Handle task dragging
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('task-')) {
      const [, , activeColIdx, activeTaskIdx] = activeIdStr.split('-').map(Number);
      const [, , overColIdx, overTaskIdx] = overIdStr.split('-').map(Number);

      if (activeColIdx === overColIdx) {
        // Reorder within same column
        if (activeTaskIdx !== overTaskIdx) {
          reorderTasksInColumn(activeBoard, activeColIdx, activeTaskIdx, overTaskIdx);
        }
      } else {
        // Move between columns
        moveTaskBetweenColumns(activeBoard, activeColIdx, overColIdx, activeTaskIdx, overTaskIdx);
      }
    }
    // Handle task dropped on column (add to end)
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('column-')) {
      const [, , activeColIdx, activeTaskIdx] = activeIdStr.split('-').map(Number);
      const newColIdx = parseInt(overIdStr.split('-')[1]);
      
      if (activeColIdx !== newColIdx) {
        const newIndex = board.columns[newColIdx].tasks.length;
        moveTaskBetweenColumns(activeBoard, activeColIdx, newColIdx, activeTaskIdx, newIndex);
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
                boardIndex={activeBoard!}
                columnIndex={index}
              />
            ))}
            
            <button className={styles.newColumn} onClick={editModal.open}>
              + New Column
            </button>
          </div>
        </SortableContext>
      </div>
      
      <DragOverlay>
        {activeId ? <div className={styles.dragOverlay}>Dragging...</div> : null}
      </DragOverlay>
      
      {activeBoard !== null && (
        <EditBoardModal
          isOpen={editModal.isOpen}
          onClose={editModal.close}
          boardIndex={activeBoard}
        />
      )}
    </DndContext>
  );
}
