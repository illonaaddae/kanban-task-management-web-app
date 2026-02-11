import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useKanbanStore } from '../store/kanbanStore';
import type { BoardContextType, Task } from '../types';

/**
 * Compatibility provider so existing tree structure remains unchanged.
 * All real state lives in the Zustand store.
 */
export function BoardProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useBoard(): BoardContextType {
  const {
    boards,
    activeBoard,
    setActiveBoard,
    addBoard,
    updateBoard,
    deleteBoard,
    addTask,
    updateTask,
    deleteTask,
    toggleSubtask,
    moveTask,
    reorderTasksInColumn,
    moveTaskBetweenColumns,
    reorderColumns,
  } = useKanbanStore((state) => ({
    boards: state.boards,
    activeBoard: state.activeBoard,
    setActiveBoard: state.setActiveBoard,
    addBoard: state.addBoard,
    updateBoard: state.updateBoard,
    deleteBoard: state.deleteBoard,
    addTask: state.addTask,
    updateTask: state.updateTask,
    deleteTask: state.deleteTask,
    toggleSubtask: state.toggleSubtask,
    moveTask: state.moveTask,
    reorderTasksInColumn: state.reorderTasksInColumn,
    moveTaskBetweenColumns: state.moveTaskBetweenColumns,
    reorderColumns: state.reorderColumns,
  }));

  // Wrap selected actions with toast side-effects to preserve UX
  const wrappedAddBoard: BoardContextType['addBoard'] = (board) => {
    addBoard(board);
    toast.success(`Board "${board.name}" created successfully!`);
  };

  const wrappedUpdateBoard: BoardContextType['updateBoard'] = (index, board) => {
    updateBoard(index, board);
    toast.success(`Board "${board.name}" updated successfully!`);
  };

  const wrappedDeleteBoard: BoardContextType['deleteBoard'] = (index) => {
    const boardName = boards[index]?.name || 'Board';
    deleteBoard(index);
    toast.error(`Board "${boardName}" deleted!`);
  };

  const wrappedAddTask: BoardContextType['addTask'] = (boardIndex, columnIndex, task: Task) => {
    addTask(boardIndex, columnIndex, task);
    toast.success(`Task "${task.title}" created successfully!`);
  };

  const wrappedUpdateTask: BoardContextType['updateTask'] = (boardIndex, columnIndex, taskIndex, task) => {
    updateTask(boardIndex, columnIndex, taskIndex, task);
    toast.success(`Task "${task.title}" updated successfully!`);
  };

  const wrappedDeleteTask: BoardContextType['deleteTask'] = (boardIndex, columnIndex, taskIndex) => {
    const taskName =
      boards[boardIndex]?.columns[columnIndex]?.tasks[taskIndex]?.title || 'Task';
    deleteTask(boardIndex, columnIndex, taskIndex);
    toast.error(`Task "${taskName}" deleted!`);
  };

  return {
    boards,
    activeBoard,
    setActiveBoard,
    addBoard: wrappedAddBoard,
    updateBoard: wrappedUpdateBoard,
    deleteBoard: wrappedDeleteBoard,
    addTask: wrappedAddTask,
    updateTask: wrappedUpdateTask,
    deleteTask: wrappedDeleteTask,
    toggleSubtask,
    moveTask,
    reorderTasksInColumn,
    moveTaskBetweenColumns,
    reorderColumns,
  };
}

