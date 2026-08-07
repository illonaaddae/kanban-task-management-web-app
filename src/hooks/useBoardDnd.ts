import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { useBoardPermissions } from './useBoardPermissions';
import { useMoveTask, useReorderColumns } from '../queries/mutations';
import type { Board } from '../types';

export function useBoardDnd(currentBoard: Board | null) {
  const { canEdit } = useBoardPermissions();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Both mutations write the cache optimistically and restore the exact previous
  // entry on failure, so there is no manual rollback or refetch here any more.
  const moveTask = useMoveTask();
  const reorderColumns = useReorderColumns();

  const allSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch needs a hold before dragging, or scrolling the board picks up cards.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Registering no sensors is what actually disables dragging: dnd-kit never
  // starts a drag, so a viewer gets no drag preview and no snap-back.
  const sensors = canEdit ? allSensors : [];

  /** Reports a rejected drag. The mutation has already undone its own change. */
  const report = (error: unknown, fallback: string) => {
    toast.error(error instanceof Error ? error.message : fallback);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    // Second line of defence: with no sensors this cannot fire, but a sensor
    // added later must not slip past the read-only rule.
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

    const columns = [...board.columns];
    const [removed] = columns.splice(oldIdx, 1);
    columns.splice(newIdx, 0, removed);

    const orderedColumnIds = columns.map((column) => column.id).filter(Boolean) as string[];
    if (orderedColumnIds.length !== columns.length) {
      toast.error('Cannot reorder columns — refresh the board and try again.');
      return;
    }

    try {
      await reorderColumns.mutateAsync({ boardId: board.id!, orderedColumnIds });
    } catch (error) {
      report(error, 'Could not reorder the columns');
    }
  };

  const handleTaskReorder = async (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const [, oCol, oTask] = overStr.split('-').map(Number);
    const activeColumn = board.columns[aCol];
    const task = activeColumn?.tasks[aTask];
    if (!task?.id) return;

    // Both branches use the move endpoint: the API treats a same-column reorder
    // as a move into the task's current column, keeping one set of position
    // semantics instead of two that can disagree.
    const target = aCol === oCol ? activeColumn : board.columns[oCol];
    if (!target?.id) return;
    if (aCol === oCol && aTask === oTask) return;

    try {
      await moveTask.mutateAsync({
        taskId: task.id,
        columnId: target.id,
        position: oTask,
        boardId: board.id!,
      });
    } catch (error) {
      report(error, 'Could not move the task');
    }
  };

  const handleTaskToColumn = async (activeStr: string, overStr: string, board: Board) => {
    const [, aCol, aTask] = activeStr.split('-').map(Number);
    const newColIdx = parseInt(overStr.split('-')[1]);
    if (aCol === newColIdx) return;

    const task = board.columns[aCol]?.tasks[aTask];
    const target = board.columns[newColIdx];
    if (!task?.id || !target?.id) return;

    try {
      await moveTask.mutateAsync({
        taskId: task.id,
        columnId: target.id,
        position: target.tasks.length,
        boardId: board.id!,
      });
    } catch (error) {
      report(error, 'Could not move the task');
    }
  };

  return { activeId, setActiveId, sensors, handleDragEnd };
}
