import { useState } from 'react';
import { useStore } from '../store/store';
import type { Board } from '../types';
import {
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';

export function useBoardDnd(currentBoard: Board | null) {
  const moveTask = useStore((state) => state.moveTask);
  const reorderColumns = useStore((state) => state.reorderColumns);
  const reorderTasksInColumn = useStore((state) => state.reorderTasksInColumn);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !currentBoard?.id) { setActiveId(null); return; }

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (activeStr.startsWith('column-') && overStr.startsWith('column-')) {
      handleColumnReorder(activeStr, overStr, currentBoard);
    } else if (activeStr.startsWith('task-') && overStr.startsWith('task-')) {
      handleTaskReorder(activeStr, overStr, currentBoard);
    } else if (activeStr.startsWith('task-') && overStr.startsWith('column-')) {
      handleTaskToColumn(activeStr, overStr, currentBoard);
    }
    setActiveId(null);
  };

  const handleColumnReorder = (activeStr: string, overStr: string, board: Board) => {
    const oldIdx = parseInt(activeStr.split('-')[1]);
    const newIdx = parseInt(overStr.split('-')[1]);
    if (oldIdx !== newIdx) {
      const cols = [...board.columns];
      const [removed] = cols.splice(oldIdx, 1);
      cols.splice(newIdx, 0, removed);
      reorderColumns(board.id!, cols);
    }
  };

  const handleTaskReorder = (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const [, oCol, oTask] = overStr.split('-').map(Number);
    const activeCol = board.columns[aCol];
    const task = activeCol?.tasks[aTask];
    if (!task?.id) return;

    if (aCol === oCol) {
      if (aTask !== oTask) {
        const newTasks = [...activeCol.tasks];
        const [removed] = newTasks.splice(aTask, 1);
        newTasks.splice(oTask, 0, removed);
        reorderTasksInColumn(board.id!, activeCol.name, newTasks);
      }
    } else {
      moveTask(task.id, board.columns[oCol].name, oTask);
    }
  };

  const handleTaskToColumn = (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const newColIdx = parseInt(overStr.split('-')[1]);
    if (aCol === newColIdx) return;

    const task = board.columns[aCol]?.tasks[aTask];
    if (task?.id) {
      const target = board.columns[newColIdx];
      moveTask(task.id, target.name, target.tasks.length);
    }
  };

  return { activeId, setActiveId, sensors, handleDragEnd };
}
