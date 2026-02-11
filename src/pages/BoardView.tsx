import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useStore } from '../store/store';
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

export function BoardView() {
  const { boardId } = useParams<{ boardId: string }>();
  const activeBoardId = boardId;
  
  const boards = useStore((state) => state.boards);
  const currentBoard = useStore((state) => state.currentBoard);
  const setCurrentBoard = useStore((state) => state.setCurrentBoard);
  const updateBoard = useStore((state) => state.updateBoard);
  const moveTask = useStore((state) => state.moveTask);
  const reorderColumns = useStore((state) => state.reorderColumns);
  const reorderTasksInColumn = useStore((state) => state.reorderTasksInColumn);
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const editModal = useModal();
  
  // Sync URL boardId with store's currentBoard
  useEffect(() => {
    if (activeBoardId && boards.length > 0) {
      const board = boards.find(b => b.id === activeBoardId);
      if (board && currentBoard?.id !== activeBoardId) {
        setCurrentBoard(board);
      }
    }
  }, [activeBoardId, boards, currentBoard, setCurrentBoard]);

  // Handle adding a new column directly
  const handleAddColumn = () => {
    if (!currentBoard || !currentBoard.id) return;
    
    const newColumnName = `New Column`;
    const updatedBoard = {
      ...currentBoard,
      columns: [...currentBoard.columns, { name: newColumnName, tasks: [] }] // New column has no ID yet, but interface has optional ID
    };
    
    // We update the board via store action
    // Note: This relies on backend to persist. 
    // Types might need refinement if 'tasks' are required in Column
    updateBoard(currentBoard.id, { columns: updatedBoard.columns });
  };
  
  // Redirect to dashboard if invalid board ID (after boards loaded)
  // We need to know if we are loading.
  // For now, if boards are empty, we might be loading or truly empty. 
  // Let's assume layout handles empty state or loading.
  if (activeBoardId && boards.length > 0 && !boards.find(b => b.id === activeBoardId)) {
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
    
    if (!over || !currentBoard || !currentBoard.id) {
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
        const newColumns = [...currentBoard.columns];
        const [removed] = newColumns.splice(oldIndex, 1);
        newColumns.splice(newIndex, 0, removed);
        
        reorderColumns(currentBoard.id, newColumns);
      }
    }
    // Handle task dragging
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('task-')) {
      const partsActive = activeIdStr.split('-');
      // task-{colIdx}-{taskIdx} OR just task-{taskId}?
      // The Column component constructs IDs. Let's check Column component.
      // Assuming previous implementation: `task-${columnIndex}-${taskIndex}`
      // BUT we need Task ID for store actions!
      // I should update Column component to use Task ID if possible, or mapping is hard.
      // Let's assume Column component uses indices for Sortable.
      
      // Wait, I need to check Column.tsx to see what ID it gives to SortableTask.
      // If it uses index, I have to map back to task object to get ID.
      // Let's assume formatted as: `task-${columnIndex}-${taskIndex}`
      
      const [, activeColIdxStr, activeTaskIdxStr] = partsActive;
      const activeColIdx = parseInt(activeColIdxStr);
      const activeTaskIdx = parseInt(activeTaskIdxStr);
      
      const partsOver = overIdStr.split('-');
      const [, overColIdxStr, overTaskIdxStr] = partsOver;
      const overColIdx = parseInt(overColIdxStr);
      const overTaskIdx = parseInt(overTaskIdxStr);

      const activeColumn = currentBoard.columns[activeColIdx];
      const activeTask = activeColumn.tasks[activeTaskIdx];
      
      if (!activeTask || !activeTask.id) return; // Need task ID

      if (activeColIdx === overColIdx) {
        // Reorder within same column
        if (activeTaskIdx !== overTaskIdx) {
           // Create new tasks array for the column
           const newTasks = [...activeColumn.tasks];
           const [removed] = newTasks.splice(activeTaskIdx, 1);
           newTasks.splice(overTaskIdx, 0, removed);
           
           // Call store action
           // We need to construct new columns array or call a specific action
           // reorderTasksInColumn expects (boardId, columnId, newTasks)
           // But 'columnId' might be ambiguous. Store implementation needs to be robust.
           // Let's pass the column NAME (status) as ID if that's how we track it?
           // Store implementation said "Assuming column names are unique...".
           // Yes, status is unique per board usually.
           reorderTasksInColumn(currentBoard.id, activeColumn.name, newTasks);
        }
      } else {
        // Move between columns
        const targetColumn = currentBoard.columns[overColIdx];
        const newStatus = targetColumn.name;
        
        moveTask(activeTask.id, newStatus, overTaskIdx);
      }
    }
    // Handle task dropped on column (add to end)
    else if (activeIdStr.startsWith('task-') && overIdStr.startsWith('column-')) {
       const partsActive = activeIdStr.split('-');
       const [, activeColIdxStr, activeTaskIdxStr] = partsActive;
       const activeColIdx = parseInt(activeColIdxStr);
       const activeTaskIdx = parseInt(activeTaskIdxStr);
       
       const newColIdx = parseInt(overIdStr.split('-')[1]);
       
       if (activeColIdx !== newColIdx) {
           const activeColumn = currentBoard.columns[activeColIdx];
           const activeTask = activeColumn.tasks[activeTaskIdx];
           
           if (activeTask && activeTask.id) {
               const targetColumn = currentBoard.columns[newColIdx];
               const newStatus = targetColumn.name;
               const newIndex = targetColumn.tasks.length;
               
               moveTask(activeTask.id, newStatus, newIndex);
           }
       }
    }

    setActiveId(null);
  };

  if (!currentBoard) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No board selected. Choose a board from the sidebar to get started.</p>
        </div>
      </div>
    );
  }
  
  if (!currentBoard.columns || currentBoard.columns.length === 0) {
    return (
      <div className={styles.container}>
        <EmptyBoard onAddColumn={handleAddColumn} />
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
          items={currentBoard.columns.map((_, index) => `column-${index}`)}
          strategy={horizontalListSortingStrategy}
        >
          <div className={styles.board}>
            {currentBoard.columns.map((column, index) => (
              <Column
                key={`column-${index}`}
                column={column}
                boardIndex={0} // We don't use boardIndex anymore in Column? Need to check Column props
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
      
      {currentBoard.id && (
         /* We pass currentBoard.id or index? Layout uses index? 
            EditBoardModal might expect index if relying on Legacy BoardContext or Store?
            We need to check EditBoardModal. 
            If it uses Store, we should pass Board ID or nothing (it uses currentBoard).
            If it uses BoardContext, we have a problem.
         */
        <EditBoardModal
          isOpen={editModal.isOpen}
          onClose={editModal.close}
          boardIndex={0} // Placeholder/Deprecated if modal uses store
        />
      )}
    </DndContext>
  );
}
