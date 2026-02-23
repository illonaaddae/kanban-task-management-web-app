import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore } from '../store';

// Mock boardService so no real Appwrite calls are made
vi.mock('../../services/boardService', () => ({
  boardService: {
    getBoards: vi.fn(),
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    deleteBoard: vi.fn(),
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

import { boardService } from '../../services/boardService';

const mockBoards = [
  {
    id: 'b1',
    name: 'Marketing',
    columns: [{ name: 'Todo', tasks: [] }],
  },
  {
    id: 'b2',
    name: 'Roadmap',
    columns: [],
  },
];

describe('boardSlice — fetchBoards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      boards: [],
      currentBoard: null,
      boardLoading: false,
      boardError: null,
    } as any);
    vi.mocked(boardService.getTasks).mockResolvedValue([]);
  });

  it('sets boardLoading to true while fetching', async () => {
    vi.mocked(boardService.getBoards).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockBoards), 100))
    );

    const promise = useStore.getState().fetchBoards('user-1');
    expect(useStore.getState().boardLoading).toBe(true);
    await promise;
  });

  it('populates boards and sets boardLoading to false on success', async () => {
    vi.mocked(boardService.getBoards).mockResolvedValue(mockBoards);

    await useStore.getState().fetchBoards('user-1');

    const state = useStore.getState();
    expect(state.boardLoading).toBe(false);
    expect(state.boards).toHaveLength(2);
    expect(state.boards[0].name).toBe('Marketing');
    expect(state.boardError).toBeNull();
  });

  it('sets currentBoard to the first board when none was previously selected', async () => {
    vi.mocked(boardService.getBoards).mockResolvedValue(mockBoards);
    await useStore.getState().fetchBoards('user-1');
    expect(useStore.getState().currentBoard?.id).toBe('b1');
  });

  it('preserves currentBoard if it exists in the freshly fetched list', async () => {
    useStore.setState({ currentBoard: mockBoards[1] } as any);
    vi.mocked(boardService.getBoards).mockResolvedValue(mockBoards);
    await useStore.getState().fetchBoards('user-1');
    expect(useStore.getState().currentBoard?.id).toBe('b2');
  });

  it('sets boardError and clears boardLoading on failure', async () => {
    vi.mocked(boardService.getBoards).mockRejectedValue(new Error('API down'));
    await useStore.getState().fetchBoards('user-1');

    const state = useStore.getState();
    expect(state.boardError).toBe('API down');
    expect(state.boardLoading).toBe(false);
    expect(state.boards).toHaveLength(0);
  });
});

describe('boardSlice — createBoard', () => {
  const newBoard = { id: 'b3', name: 'New Board', columns: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ boards: mockBoards, boardLoading: false, boardError: null } as any);
    vi.mocked(boardService.createBoard).mockResolvedValue(newBoard);
  });

  it('appends the new board and sets it as currentBoard', async () => {
    await useStore.getState().createBoard('user-1', { name: 'New Board', columns: [] });

    const state = useStore.getState();
    expect(state.boards).toHaveLength(3);
    expect(state.currentBoard?.id).toBe('b3');
  });

  it('sets boardError on failure', async () => {
    vi.mocked(boardService.createBoard).mockRejectedValue(new Error('create failed'));
    await expect(
      useStore.getState().createBoard('user-1', { name: 'Fail', columns: [] })
    ).rejects.toThrow();
  });
});

describe('boardSlice — deleteBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      boards: mockBoards,
      currentBoard: mockBoards[0],
      boardLoading: false,
      boardError: null,
    } as any);
    vi.mocked(boardService.deleteBoard).mockResolvedValue(undefined);
  });

  it('removes the deleted board from the list', async () => {
    await useStore.getState().deleteBoard('b1');
    const state = useStore.getState();
    expect(state.boards).toHaveLength(1);
    expect(state.boards.find(b => b.id === 'b1')).toBeUndefined();
  });

  it('sets currentBoard to the next available board after deletion', async () => {
    await useStore.getState().deleteBoard('b1');
    expect(useStore.getState().currentBoard?.id).toBe('b2');
  });
});
