/**
 * Board Service — re-exports board and task API functions
 * as a single service object for backward compatibility.
 */
import * as boardApi from './boardApi';
import * as taskApi from './taskApi';

export const boardService = {
  getBoards: boardApi.getBoards,
  getFullBoard: boardApi.getFullBoard,
  createBoard: boardApi.createBoard,
  updateBoard: boardApi.updateBoard,
  deleteBoard: boardApi.deleteBoard,
  reorderColumns: boardApi.reorderColumns,
  createColumn: boardApi.createColumn,
  getTasks: taskApi.getTasks,
  createTask: taskApi.createTask,
  updateTask: taskApi.updateTask,
  deleteTask: taskApi.deleteTask,
  moveTask: taskApi.moveTask,
};
