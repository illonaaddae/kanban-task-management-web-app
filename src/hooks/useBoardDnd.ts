import { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../store/store';
import { useBoardPermissions } from './useBoardPermissions';
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
  const refreshCurrentBoard = useStore((state) => state.refreshCurrentBoard);
  const { canEdit } = useBoardPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);

  const allSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Registering no sensors is what actually disables dragging: dnd-kit never
  // starts a drag, so a viewer gets no drag preview, no ghost, and no snap-back.
  // Hooks still run unconditionally above — only the result is swapped.
  const sensors = canEdit ? allSensors : [];

  /**
   * Runs an optimistic store action and repairs the board if the write fails.
   *
   * The store has already moved the card by the time we get here, so the only
   * honest rollback is to re-read the board — a locally reconstructed "undo"
   * would be a guess, and would silently diverge from the server on a partial
   * failure. A viewer dragging a card lands here with the API's 403 message.
   */
  const persist = async (action: () => Promise<void>, what: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not ${what}. Please try again.`,
      );
      await refreshCurrentBoard();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    // Second line of defence: with no sensors this cannot fire, but a keyboard
    // drag added later must not slip past the read-only rule.
    if (!canEdit || !over || !currentBoard?.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (activeStr.startsWith('column-') && overStr.startsWith('column-')) {
      await handleColumnReorder(activeStr, overStr, currentBoard);
    } else if (activeStr.startsWith('task-') && overStr.startsWith('task-')) {
      await handleTaskReorder(activeStr, overStr, currentBoard);
    } else if (activeStr.startsWith('task-') && overStr.startsWith('column-')) {
      await handleTaskToColumn(activeStr, overStr, currentBoard);
    }
  };

  const handleColumnReorder = async (activeStr: string, overStr: string, board: Board) => {
    const oldIdx = parseInt(activeStr.split('-')[1]);
    const newIdx = parseInt(overStr.split('-')[1]);
    if (oldIdx === newIdx) return;

    const cols = [...board.columns];
    const [removed] = cols.splice(oldIdx, 1);
    cols.splice(newIdx, 0, removed);

    await persist(() => reorderColumns(board.id!, cols), 'reorder the columns');
  };

  const handleTaskReorder = async (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const [, oCol, oTask] = overStr.split('-').map(Number);
    const activeCol = board.columns[aCol];
    const task = activeCol?.tasks[aTask];
    if (!task?.id) return;

    // Both branches go through moveTask: the API handles a same-column reorder
    // as a move into the task's current column, keeping one set of position
    // semantics instead of two.
    if (aCol === oCol) {
      if (aTask === oTask) return;
      await persist(() => moveTask(task.id!, activeCol.name, oTask), 'reorder the task');
      return;
    }

    const target = board.columns[oCol];
    if (!target) return;
    await persist(() => moveTask(task.id!, target.name, oTask), 'move the task');
  };

  const handleTaskToColumn = async (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const newColIdx = parseInt(overStr.split('-')[1]);
    if (aCol === newColIdx) return;

    const task = board.columns[aCol]?.tasks[aTask];
    const target = board.columns[newColIdx];
    if (!task?.id || !target) return;

    await persist(
      () => moveTask(task.id!, target.name, target.tasks.length),
      'move the task',
    );
  };

  return { activeId, setActiveId, sensors, handleDragEnd };
}
