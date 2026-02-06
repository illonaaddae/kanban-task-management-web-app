import { createContext, useContext, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { type Board, type Task, type BoardContextType } from '../types';
import boardsData from '../../data.json';

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useLocalStorage<Board[]>('kanban-boards', boardsData.boards);
  const [activeBoard, setActiveBoard] = useLocalStorage<number | null>('kanban-active-board', 0);

  const addBoard = (board: Board) => {
    setBoards(prev => [...prev, board]);
  };

  const updateBoard = (index: number, board: Board) => {
    setBoards(prev => prev.map((b, i) => i === index ? board : b));
  };

  const deleteBoard = (index: number) => {
    setBoards(prev => prev.filter((_, i) => i !== index));
    if (activeBoard === index) {
      setActiveBoard(0);
    } else if (activeBoard !== null && activeBoard > index) {
      setActiveBoard(activeBoard - 1);
    }
  };

  const addTask = (boardIndex: number, columnIndex: number, task: Task) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci !== columnIndex) return col;
          return { ...col, tasks: [...col.tasks, task] };
        })
      };
    }));
  };

  const updateTask = (boardIndex: number, columnIndex: number, taskIndex: number, task: Task) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci !== columnIndex) return col;
          return {
            ...col,
            tasks: col.tasks.map((t, ti) => ti === taskIndex ? task : t)
          };
        })
      };
    }));
  };

  const deleteTask = (boardIndex: number, columnIndex: number, taskIndex: number) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci !== columnIndex) return col;
          return {
            ...col,
            tasks: col.tasks.filter((_, ti) => ti !== taskIndex)
          };
        })
      };
    }));
  };

  const toggleSubtask = (boardIndex: number, columnIndex: number, taskIndex: number, subtaskIndex: number) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci !== columnIndex) return col;
          return {
            ...col,
            tasks: col.tasks.map((task, ti) => {
              if (ti !== taskIndex) return task;
              return {
                ...task,
                subtasks: task.subtasks.map((st, si) => 
                  si === subtaskIndex ? { ...st, isCompleted: !st.isCompleted } : st
                )
              };
            })
          };
        })
      };
    }));
  };

  const moveTask = (boardIndex: number, fromColumn: number, toColumn: number, taskIndex: number) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      
      const task = board.columns[fromColumn].tasks[taskIndex];
      const newTask = { ...task, status: board.columns[toColumn].name };
      
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci === fromColumn) {
            return { ...col, tasks: col.tasks.filter((_, ti) => ti !== taskIndex) };
          }
          if (ci === toColumn) {
            return { ...col, tasks: [...col.tasks, newTask] };
          }
          return col;
        })
      };
    }));
  };

  // Drag and drop functions
  const reorderTasksInColumn = (boardIndex: number, columnIndex: number, startIndex: number, endIndex: number) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      
      return {
        ...board,
        columns: board.columns.map((col, ci) => {
          if (ci !== columnIndex) return col;
          
          const tasks = [...col.tasks];
          const [removed] = tasks.splice(startIndex, 1);
          tasks.splice(endIndex, 0, removed);
          
          return { ...col, tasks };
        })
      };
    }));
  };

  const moveTaskBetweenColumns = (
    boardIndex: number, 
    sourceColIndex: number, 
    destColIndex: number, 
    taskIndex: number, 
    newIndex: number
  ) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      
      const task = board.columns[sourceColIndex].tasks[taskIndex];
      const newTask = { ...task, status: board.columns[destColIndex].name };
      
      const newColumns = board.columns.map((col, ci) => {
        if (ci === sourceColIndex) {
          // Remove from source column
          return { ...col, tasks: col.tasks.filter((_, ti) => ti !== taskIndex) };
        }
        return col;
      });
      
      // Insert at specific position in destination column
      newColumns[destColIndex] = {
        ...newColumns[destColIndex],
        tasks: [
          ...newColumns[destColIndex].tasks.slice(0, newIndex),
          newTask,
          ...newColumns[destColIndex].tasks.slice(newIndex)
        ]
      };
      
      return { ...board, columns: newColumns };
    }));
  };

  const reorderColumns = (boardIndex: number, startIndex: number, endIndex: number) => {
    setBoards(prev => prev.map((board, bi) => {
      if (bi !== boardIndex) return board;
      
      const columns = [...board.columns];
      const [removed] = columns.splice(startIndex, 1);
      columns.splice(endIndex, 0, removed);
      
      return { ...board, columns };
    }));
  };

  return (
    <BoardContext.Provider value={{
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
      reorderColumns
    }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoard must be used within BoardProvider');
  }
  return context;
}
