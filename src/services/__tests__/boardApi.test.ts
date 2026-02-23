import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBoards, createBoard, updateBoard, deleteBoard } from '../boardApi';

// Mock the entire appwrite lib so no real HTTP calls are made
vi.mock('../../lib/appwrite', () => ({
  databases: {
    listDocuments: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
  DATABASE_ID: 'test-db',
  BOARDS_COLLECTION_ID: 'boards',
}));

import { databases } from '../../lib/appwrite';

const mockDoc = {
  $id: 'board-abc',
  name: 'My Board',
  columns: JSON.stringify([{ name: 'Todo', tasks: [] }]),
};

describe('boardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ── getBoards ──────────────────────────────────────────────────────
  describe('getBoards', () => {
    it('returns formatted boards from Appwrite', async () => {
      vi.mocked(databases.listDocuments).mockResolvedValue({
        documents: [mockDoc],
        total: 1,
      } as any);

      const boards = await getBoards('user-1');
      expect(boards).toHaveLength(1);
      expect(boards[0]).toEqual({
        id: 'board-abc',
        name: 'My Board',
        columns: [{ name: 'Todo', tasks: [] }],
      });
    });

    it('falls back to localStorage on API error', async () => {
      vi.mocked(databases.listDocuments).mockRejectedValue(new Error('Network error'));
      const fallback = [{ id: 'local-1', name: 'Local Board', columns: [] }];
      localStorage.setItem('kanban_boards', JSON.stringify(fallback));

      const boards = await getBoards('user-1');
      expect(boards).toEqual(fallback);
    });

    it('returns empty array when API fails and no localStorage', async () => {
      vi.mocked(databases.listDocuments).mockRejectedValue(new Error('fail'));
      const boards = await getBoards('user-1');
      expect(boards).toEqual([]);
    });
  });

  // ── createBoard ────────────────────────────────────────────────────
  describe('createBoard', () => {
    it('creates a board and returns formatted result', async () => {
      vi.mocked(databases.createDocument).mockResolvedValue(mockDoc as any);

      const result = await createBoard('user-1', {
        name: 'My Board',
        columns: [{ name: 'Todo', tasks: [] }],
      });

      expect(result.id).toBe('board-abc');
      expect(result.name).toBe('My Board');
      expect(databases.createDocument).toHaveBeenCalledOnce();
    });

    it('throws a readable error when API fails', async () => {
      vi.mocked(databases.createDocument).mockRejectedValue(new Error('API down'));
      await expect(createBoard('user-1', { name: 'Fail Board', columns: [] }))
        .rejects.toThrow('Failed to create board');
    });
  });

  // ── updateBoard ────────────────────────────────────────────────────
  describe('updateBoard', () => {
    it('updates a board and returns formatted result', async () => {
      vi.mocked(databases.updateDocument).mockResolvedValue(mockDoc as any);
      const result = await updateBoard('board-abc', { name: 'Updated' });
      expect(result.id).toBe('board-abc');
      expect(databases.updateDocument).toHaveBeenCalledOnce();
    });

    it('throws a readable error when API fails', async () => {
      vi.mocked(databases.updateDocument).mockRejectedValue(new Error('fail'));
      await expect(updateBoard('board-abc', { name: 'X' }))
        .rejects.toThrow('Failed to update board');
    });
  });

  // ── deleteBoard ────────────────────────────────────────────────────
  describe('deleteBoard', () => {
    it('calls deleteDocument with the correct boardId', async () => {
      vi.mocked(databases.deleteDocument).mockResolvedValue(undefined as any);
      await deleteBoard('board-abc');
      expect(databases.deleteDocument).toHaveBeenCalledWith('test-db', 'boards', 'board-abc');
    });

    it('throws a readable error when API fails', async () => {
      vi.mocked(databases.deleteDocument).mockRejectedValue(new Error('fail'));
      await expect(deleteBoard('board-abc')).rejects.toThrow('Failed to delete board');
    });
  });
});
