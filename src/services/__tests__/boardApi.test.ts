import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getBoards,
  getFullBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  reorderColumns,
} from '../boardApi';
import { ACCESS_TOKEN_KEY } from '../api';

/**
 * These exercise the API client, so `fetch` is mocked rather than Appwrite.
 * Requests are recorded so the tests can assert *what* was sent - for the
 * column diff, the sequence of calls is the behaviour under test.
 */

interface RecordedCall {
  method: string;
  path: string;
  body: any;
}

let calls: RecordedCall[] = [];
let handlers: Array<{
  method: string;
  match: RegExp;
  respond: (call: RecordedCall) => { status?: number; body: unknown };
}> = [];

function on(
  method: string,
  match: RegExp,
  respond: (call: RecordedCall) => { status?: number; body: unknown },
) {
  handlers.push({ method, match, respond });
}

/** Envelope helpers mirroring the server's contract. */
const success = (data: unknown) => ({ status: 'success', data });
const failure = (message: string, details?: unknown) => ({
  status: 'error',
  message,
  ...(details ? { details } : {}),
});

function fullBoard(overrides: Partial<any> = {}) {
  return {
    id: 'board-1',
    name: 'My Board',
    myRole: 'owner',
    collaborators: [],
    columns: [
      {
        id: 'col-todo',
        name: 'Todo',
        position: 0,
        tasks: [
          {
            id: 'task-1',
            title: 'First',
            description: 'desc',
            status: 'Todo',
            position: 0,
            assignedTo: null,
            dueDate: null,
            subtasks: [{ title: 'sub', isCompleted: false }],
          },
        ],
      },
      { id: 'col-doing', name: 'Doing', position: 1, tasks: [] },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  calls = [];
  handlers = [];
  localStorage.clear();
  localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');

  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      let body: any;
      try {
        body = request.body ? await request.clone().json() : undefined;
      } catch {
        body = undefined;
      }

      const call: RecordedCall = { method: request.method, path, body };
      calls.push(call);

      const handler = handlers.find(
        (h) => h.method === request.method && h.match.test(path),
      );

      if (!handler) {
        return new Response(JSON.stringify(failure(`No handler for ${request.method} ${path}`)), {
          status: 500,
        });
      }

      const { status = 200, body: responseBody } = handler.respond(call);
      return new Response(JSON.stringify(responseBody), { status });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const paths = () => calls.map((c) => `${c.method} ${c.path}`);

describe('boardApi', () => {
  // ── getFullBoard ───────────────────────────────────────────────────
  describe('getFullBoard', () => {
    it('maps the nested shape, carrying columnId and position onto tasks', async () => {
      on('GET', /^\/boards\/board-1\/full$/, () => ({ body: success(fullBoard()) }));

      const board = await getFullBoard('board-1');

      expect(board).toEqual({
        id: 'board-1',
        name: 'My Board',
        // Carried through so the UI can gate affordances on it.
        myRole: 'owner',
        // null for a personal board; a team id makes it reachable by that team.
        organizationId: null,
        columns: [
          {
            id: 'col-todo',
            name: 'Todo',
            position: 0,
            tasks: [
              {
                id: 'task-1',
                title: 'First',
                description: 'desc',
                status: 'Todo',
                subtasks: [{ title: 'sub', isCompleted: false }],
                columnId: 'col-todo',
                position: 0,
                assignedTo: null,
                dueDate: null,
              },
            ],
          },
          { id: 'col-doing', name: 'Doing', position: 1, tasks: [] },
        ],
      });
    });

    it('preserves the server order rather than re-sorting', async () => {
      on('GET', /full$/, () => ({
        body: success(
          fullBoard({
            columns: [
              { id: 'c2', name: 'Second', position: 1, tasks: [] },
              { id: 'c1', name: 'First', position: 0, tasks: [] },
            ],
          }),
        ),
      }));

      const board = await getFullBoard('board-1');
      expect(board.columns.map((c) => c.id)).toEqual(['c2', 'c1']);
    });
  });

  // ── getBoards ──────────────────────────────────────────────────────
  describe('getBoards', () => {
    it('lists boards then hydrates each one', async () => {
      on('GET', /^\/boards$/, () => ({
        body: success({
          boards: [
            { id: 'board-1', name: 'One', myRole: 'owner' },
            { id: 'board-2', name: 'Two', myRole: 'viewer' },
          ],
          count: 2,
        }),
      }));
      on('GET', /^\/boards\/(board-1|board-2)\/full$/, (call) => ({
        body: success(fullBoard({ id: call.path.split('/')[2] })),
      }));

      const boards = await getBoards('user-1');

      expect(boards.map((b) => b.id)).toEqual(['board-1', 'board-2']);
      expect(boards[0].columns).toHaveLength(2);
      expect(paths()).toEqual([
        'GET /boards',
        'GET /boards/board-1/full',
        'GET /boards/board-2/full',
      ]);
    });

    it('sends the Bearer token', async () => {
      on('GET', /^\/boards$/, () => ({ body: success({ boards: [], count: 0 }) }));

      await getBoards('user-1');

      const request = vi.mocked(fetch).mock.calls[0][0] as Request;
      expect(request.headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('throws the server message instead of falling back to localStorage', async () => {
      // The old implementation swallowed failures and served stale local data,
      // which made a broken backend look like a working app.
      localStorage.setItem(
        'kanban_boards',
        JSON.stringify([{ id: 'local-1', name: 'Local Board', columns: [] }]),
      );
      on('GET', /^\/boards$/, () => ({ status: 500, body: failure('Something went wrong') }));

      await expect(getBoards('user-1')).rejects.toThrow('Something went wrong');
    });

    it('propagates a 403 with the API wording', async () => {
      on('GET', /^\/boards$/, () => ({
        status: 403,
        body: failure('You do not have access to this board'),
      }));

      await expect(getBoards('user-1')).rejects.toThrow(
        'You do not have access to this board',
      );
    });
  });

  // ── createBoard ────────────────────────────────────────────────────
  describe('createBoard', () => {
    it('creates the board then its columns in order', async () => {
      on('POST', /^\/boards$/, () => ({
        status: 201,
        body: success({ board: { id: 'board-1', name: 'My Board', myRole: 'owner' } }),
      }));
      on('POST', /^\/boards\/board-1\/columns$/, (call) => ({
        status: 201,
        body: success({ column: { id: `col-${call.body.name}`, name: call.body.name } }),
      }));
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));

      const board = await createBoard('user-1', {
        name: 'My Board',
        columns: [
          { name: 'Todo', tasks: [] },
          { name: 'Doing', tasks: [] },
        ],
      });

      expect(board.id).toBe('board-1');
      expect(paths()).toEqual([
        'POST /boards',
        'POST /boards/board-1/columns',
        'POST /boards/board-1/columns',
        'GET /boards/board-1/full',
      ]);
      // Sequential, so each column's position = maxPosition + 1 is not raced.
      expect(calls[1].body).toEqual({ name: 'Todo' });
      expect(calls[2].body).toEqual({ name: 'Doing' });
    });

    it('handles a board with no columns', async () => {
      on('POST', /^\/boards$/, () => ({
        status: 201,
        body: success({ board: { id: 'board-1', name: 'Empty', myRole: 'owner' } }),
      }));
      on('GET', /full$/, () => ({ body: success(fullBoard({ columns: [] })) }));

      const board = await createBoard('user-1', { name: 'Empty', columns: [] });

      expect(board.columns).toEqual([]);
      expect(paths()).toEqual(['POST /boards', 'GET /boards/board-1/full']);
    });

    it('surfaces a validation error with the server message', async () => {
      on('POST', /^\/boards$/, () => ({
        status: 400,
        body: failure('Validation failed', [
          { field: 'title', message: 'Board title is required' },
        ]),
      }));

      await expect(createBoard('user-1', { name: '', columns: [] })).rejects.toThrow(
        'Validation failed',
      );
    });
  });

  // ── updateBoard ────────────────────────────────────────────────────
  describe('updateBoard', () => {
    it('renames the board when only the name changed', async () => {
      on('PUT', /^\/boards\/board-1$/, () => ({
        body: success({ board: { id: 'board-1', name: 'Renamed', myRole: 'owner' } }),
      }));
      on('GET', /full$/, () => ({ body: success(fullBoard({ name: 'Renamed' })) }));

      const board = await updateBoard('board-1', { name: 'Renamed' });

      expect(board.name).toBe('Renamed');
      expect(paths()).toEqual(['PUT /boards/board-1', 'GET /boards/board-1/full']);
      expect(calls[0].body).toEqual({ name: 'Renamed' });
    });

    it('renames a column whose name changed, and leaves the rest alone', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));
      on('PUT', /^\/columns\/col-todo$/, () => ({ body: success({ column: {}, tasksUpdated: 1 }) }));

      await updateBoard('board-1', {
        columns: [
          { id: 'col-todo', name: 'Backlog', tasks: [] },
          { id: 'col-doing', name: 'Doing', tasks: [] },
        ],
      });

      expect(paths()).toEqual([
        'GET /boards/board-1/full',
        'PUT /columns/col-todo',
        'GET /boards/board-1/full',
      ]);
      expect(calls[1].body).toEqual({ name: 'Backlog' });
    });

    it('deletes a column the client dropped', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));
      on('DELETE', /^\/columns\/col-doing$/, () => ({ body: success({ id: 'col-doing' }) }));

      await updateBoard('board-1', {
        columns: [{ id: 'col-todo', name: 'Todo', tasks: [] }],
      });

      expect(paths()).toContain('DELETE /columns/col-doing');
      expect(paths()).not.toContain('DELETE /columns/col-todo');
    });

    it('creates a column the client invented locally (no id)', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));
      on('POST', /^\/boards\/board-1\/columns$/, () => ({
        status: 201,
        body: success({ column: { id: 'col-done', name: 'Done' } }),
      }));
      on('PATCH', /reorder$/, () => ({ body: success({ columns: [] }) }));

      await updateBoard('board-1', {
        columns: [
          { id: 'col-todo', name: 'Todo', tasks: [] },
          { id: 'col-doing', name: 'Doing', tasks: [] },
          { name: 'Done', tasks: [] },
        ],
      });

      expect(paths()).toContain('POST /boards/board-1/columns');
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Done' });
    });

    it('does not delete and recreate untouched columns - tasks would be orphaned', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));

      await updateBoard('board-1', {
        columns: [
          { id: 'col-todo', name: 'Todo', tasks: [] },
          { id: 'col-doing', name: 'Doing', tasks: [] },
        ],
      });

      expect(paths()).toEqual(['GET /boards/board-1/full', 'GET /boards/board-1/full']);
    });

    it('reorders when the order changed, listing exactly the board columns', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));
      on('PATCH', /^\/boards\/board-1\/columns\/reorder$/, () => ({
        body: success({ columns: [] }),
      }));

      await updateBoard('board-1', {
        columns: [
          { id: 'col-doing', name: 'Doing', tasks: [] },
          { id: 'col-todo', name: 'Todo', tasks: [] },
        ],
      });

      const reorder = calls.find((c) => c.path.endsWith('/reorder'));
      expect(reorder?.body).toEqual({ orderedColumnIds: ['col-doing', 'col-todo'] });
    });

    it('skips the reorder when the order is unchanged', async () => {
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));

      await updateBoard('board-1', {
        columns: [
          { id: 'col-todo', name: 'Todo', tasks: [] },
          { id: 'col-doing', name: 'Doing', tasks: [] },
        ],
      });

      expect(paths().some((p) => p.includes('reorder'))).toBe(false);
    });

    it('throws the server message on failure', async () => {
      on('PUT', /^\/boards\/board-1$/, () => ({
        status: 403,
        body: failure('This action requires owner access to the board'),
      }));

      await expect(updateBoard('board-1', { name: 'X' })).rejects.toThrow(
        'This action requires owner access to the board',
      );
    });
  });

  // ── reorderColumns ─────────────────────────────────────────────────
  describe('reorderColumns', () => {
    it('sends the ordered ids and returns the refreshed board', async () => {
      on('PATCH', /reorder$/, () => ({ body: success({ columns: [] }) }));
      on('GET', /full$/, () => ({ body: success(fullBoard()) }));

      const board = await reorderColumns('board-1', ['col-doing', 'col-todo']);

      expect(calls[0].body).toEqual({ orderedColumnIds: ['col-doing', 'col-todo'] });
      expect(board.id).toBe('board-1');
    });

    it('surfaces the exact-set rejection', async () => {
      on('PATCH', /reorder$/, () => ({
        status: 400,
        body: failure("orderedColumnIds must list exactly the board's columns"),
      }));

      await expect(reorderColumns('board-1', ['col-todo'])).rejects.toThrow(
        "orderedColumnIds must list exactly the board's columns",
      );
    });
  });

  // ── deleteBoard ────────────────────────────────────────────────────
  describe('deleteBoard', () => {
    it('DELETEs the board', async () => {
      on('DELETE', /^\/boards\/board-1$/, () => ({
        body: success({ id: 'board-1', deleted: { columns: 2, tasks: 3, activity: 1 } }),
      }));

      await deleteBoard('board-1');

      expect(paths()).toEqual(['DELETE /boards/board-1']);
    });

    it('throws the server message on failure', async () => {
      on('DELETE', /^\/boards\/board-1$/, () => ({
        status: 404,
        body: failure('Board not found'),
      }));

      await expect(deleteBoard('board-1')).rejects.toThrow('Board not found');
    });
  });
});
