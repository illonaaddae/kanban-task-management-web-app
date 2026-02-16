import { databases, DATABASE_ID, TASKS_COLLECTION_ID } from '../lib/appwrite';
import { ID, Query, Permission, Role } from 'appwrite';
import type { Task } from '../types';

export async function getTasks(boardId: string): Promise<Task[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID, TASKS_COLLECTION_ID,
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

export async function createTask(boardId: string, userId: string, task: Omit<Task, 'id'>): Promise<Task> {
  try {
    const response = await databases.createDocument(
      DATABASE_ID, TASKS_COLLECTION_ID, ID.unique(),
      {
        title: task.title,
        description: task.description || '',
        status: task.status, boardId, userId,
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
      id: response.$id, title: response.title,
      description: response.description || '', status: response.status,
      subtasks: response.subtasks ? JSON.parse(response.subtasks) : [],
    };
  } catch (error) {
    console.error('Error creating task:', error);
    throw new Error('Failed to create task');
  }
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.subtasks) updateData.subtasks = JSON.stringify(updates.subtasks);

    const response = await databases.updateDocument(
      DATABASE_ID, TASKS_COLLECTION_ID, taskId, updateData
    );
    return {
      id: response.$id, title: response.title,
      description: response.description || '', status: response.status,
      subtasks: response.subtasks ? JSON.parse(response.subtasks) : [],
    };
  } catch (error) {
    console.error('Error updating task:', error);
    throw new Error('Failed to update task');
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    await databases.deleteDocument(DATABASE_ID, TASKS_COLLECTION_ID, taskId);
  } catch (error) {
    console.error('Error deleting task:', error);
    throw new Error('Failed to delete task');
  }
}
