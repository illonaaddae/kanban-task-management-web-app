import { databases, DATABASE_ID, BOARDS_COLLECTION_ID, TASKS_COLLECTION_ID } from '../lib/appwrite';
import { ID, Query, Permission, Role } from 'appwrite';
import type { Board, Task, Column } from '../types';

export class BoardService {
  /**
   * Get all boards for a specific user
   */
  async getBoards(userId: string): Promise<Board[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BOARDS_COLLECTION_ID,
        [Query.equal('userId', userId)]
      );

      return response.documents.map(doc => ({
        id: doc.$id,
        name: doc.name,
        columns: JSON.parse(doc.columns) as Column[],
      }));
    } catch (error) {
      console.error('Error fetching boards:', error);
      // Fallback to localStorage
      const saved = localStorage.getItem('kanban_boards');
      return saved ? JSON.parse(saved) : [];
    }
  }

  /**
   * Create a new board
   */
  async createBoard(userId: string, board: Omit<Board, 'id'>): Promise<Board> {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        BOARDS_COLLECTION_ID,
        ID.unique(),
        {
          name: board.name,
          userId,
          columns: JSON.stringify(board.columns),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]
      );

      return {
        id: response.$id,
        name: response.name,
        columns: JSON.parse(response.columns) as Column[],
      };
    } catch (error) {
      console.error('Error creating board:', error);
      throw new Error('Failed to create board');
    }
  }

  /**
   * Update an existing board
   */
  async updateBoard(boardId: string, updates: Partial<Board>): Promise<Board> {
    try {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name) {
        updateData.name = updates.name;
      }

      if (updates.columns) {
        updateData.columns = JSON.stringify(updates.columns);
      }

      const response = await databases.updateDocument(
        DATABASE_ID,
        BOARDS_COLLECTION_ID,
        boardId,
        updateData
      );

      return {
        id: response.$id,
        name: response.name,
        columns: JSON.parse(response.columns) as Column[],
      };
    } catch (error) {
      console.error('Error updating board:', error);
      throw new Error('Failed to update board');
    }
  }

  /**
   * Delete a board
   */
  async deleteBoard(boardId: string): Promise<void> {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        BOARDS_COLLECTION_ID,
        boardId
      );
    } catch (error) {
      console.error('Error deleting board:', error);
      throw new Error('Failed to delete board');
    }
  }

  /**
   * Get all tasks for a specific board
   */
  async getTasks(boardId: string): Promise<Task[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        TASKS_COLLECTION_ID,
        [Query.equal('boardId', boardId)]
      );

      return response.documents.map(doc => ({
        id: doc.$id,
        title: doc.title,
        description: doc.description || '',
        status: doc.status,
        subtasks: doc.subtasks ? JSON.parse(doc.subtasks) : [],
      }));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  /**
   * Create a new task
   */
  async createTask(boardId: string, userId: string, task: Omit<Task, 'id'>): Promise<Task> {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        TASKS_COLLECTION_ID,
        ID.unique(),
        {
          title: task.title,
          description: task.description || '',
          status: task.status,
          boardId,
          userId,
          subtasks: JSON.stringify(task.subtasks || []),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        [
          Permission.read(Role.user(userId)),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]
      );

      return {
        id: response.$id,
        title: response.title,
        description: response.description || '',
        status: response.status,
        subtasks: response.subtasks ? JSON.parse(response.subtasks) : [],
      };
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status) updateData.status = updates.status;
      if (updates.subtasks) updateData.subtasks = JSON.stringify(updates.subtasks);

      const response = await databases.updateDocument(
        DATABASE_ID,
        TASKS_COLLECTION_ID,
        taskId,
        updateData
      );

      return {
        id: response.$id,
        title: response.title,
        description: response.description || '',
        status: response.status,
        subtasks: response.subtasks ? JSON.parse(response.subtasks) : [],
      };
    } catch (error) {
      console.error('Error updating task:', error);
      throw new Error('Failed to update task');
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        TASKS_COLLECTION_ID,
        taskId
      );
    } catch (error) {
      console.error('Error deleting task:', error);
      throw new Error('Failed to delete task');
    }
  }
}

export const boardService = new BoardService();
