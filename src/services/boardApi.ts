import { databases, DATABASE_ID, BOARDS_COLLECTION_ID } from '../lib/appwrite';
import { ID, Query, Permission, Role } from 'appwrite';
import type { Board, Column } from '../types';

export async function getBoards(userId: string): Promise<Board[]> {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID, BOARDS_COLLECTION_ID,
      [Query.equal('userId', userId)]
    );
    return response.documents.map(doc => ({
      id: doc.$id,
      name: doc.name,
      columns: JSON.parse(doc.columns) as Column[],
    }));
  } catch (error) {
    console.error('Error fetching boards:', error);
    const saved = localStorage.getItem('kanban_boards');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function createBoard(userId: string, board: Omit<Board, 'id'>): Promise<Board> {
  try {
    const response = await databases.createDocument(
      DATABASE_ID, BOARDS_COLLECTION_ID, ID.unique(),
      {
        name: board.name, userId,
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
    return { id: response.$id, name: response.name, columns: JSON.parse(response.columns) as Column[] };
  } catch (error) {
    console.error('Error creating board:', error);
    throw new Error('Failed to create board');
  }
}

export async function updateBoard(boardId: string, updates: Partial<Board>): Promise<Board> {
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (updates.name) updateData.name = updates.name;
    if (updates.columns) updateData.columns = JSON.stringify(updates.columns);

    const response = await databases.updateDocument(
      DATABASE_ID, BOARDS_COLLECTION_ID, boardId, updateData
    );
    return { id: response.$id, name: response.name, columns: JSON.parse(response.columns) as Column[] };
  } catch (error) {
    console.error('Error updating board:', error);
    throw new Error('Failed to update board');
  }
}

export async function deleteBoard(boardId: string): Promise<void> {
  try {
    await databases.deleteDocument(DATABASE_ID, BOARDS_COLLECTION_ID, boardId);
  } catch (error) {
    console.error('Error deleting board:', error);
    throw new Error('Failed to delete board');
  }
}
