import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTasks, createTask, updateTask, deleteTask, moveTask } from '../taskApi';
import { ACCESS_TOKEN_KEY } from '../api';

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

const success = (data: unknown) => ({ status: 'success', data });
const failure = (message: string, details?: unknown) => ({
  status: 'error',
  message,
  ...(details ? { details } : {}),
});

const FULL_BOARD = {
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
          description: '',
          status: 'Todo',
          position: 0,
          assignedTo: null,
          dueDate: null,
          subtasks: [],
        },
        {
          id: 'task-2',
          title: 'Second',
          description: '',
          status: 'Todo',
          position: 1,
          assignedTo: null,
          dueDate: null,
          subtasks: [],
        },
      ],
    },
    {
      id: 'col-doing',
      name: 'Doing',
      position: 1,
      tasks: [
        {
          id: 'task-3',
          title: 'Third',
          description: '',
          status: 'Doing',
          position: 0,
          assignedTo: null,
          dueDate: null,
          subtasks: [],
        },
      ],
    },
  ],
};

function taskDocument(overrides: Partial<any> = {}) {
  return {
    id: 'task-1',
    title: 'First',
    description: '',
    status: 'Todo',
    position: 0,
    assignedTo: null,
    dueDate: null,
    subtasks: [],
    boardId: 'board-1',
    columnId: 'col-todo',
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
        return new Response(
          JSON.stringify(failure(`No handler for ${request.method} ${path}`)),
          { status: 500 },
        );
      }

      const { status = 200, body: responseBody } = handler.respond(call);
      return new Response(JSON.stringify(responseBody), { status });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const paths = () => calls.map((c) => `${c.method} ${c.path}`);

describe('taskApi', () => {
  // ── getTasks ───────────────────────────────────────────────────────
  describe('getTasks', () => {
    it('flattens the nested board in column-then-position order', async () => {
      on('GET', /full$/, () => ({ body: success(FULL_BOARD) }));

      const tasks = await getTasks('board-1');

      expect(tasks.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3']);
    });

    it('stamps each task with its columnId', async () => {
      on('GET', /full$/, () => ({ body: success(FULL_BOARD) }));

      const tasks = await getTasks('board-1');

      expect(tasks.map((t) => t.columnId)).toEqual(['col-todo', 'col-todo', 'col-doing']);
    });

    it('throws instead of returning an empty array on failure', async () => {
      // The old implementation swallowed the error and returned [], which read
      // as "this board has no tasks".
      on('GET', /full$/, () => ({ status: 500, body: failure('Something went wrong') }));

      await expect(getTasks('board-1')).rejects.toThrow('Something went wrong');
    });
  });

  // ── createTask ─────────────────────────────────────────────────────
  describe('createTask', () => {
    it('resolves the column from status, then posts', async () => {
      on('GET', /full$/, () => ({ body: success(FULL_BOARD) }));
      on('POST', /^\/tasks$/, () => ({ status: 201, body: success({ task: taskDocument() }) }));

      const task = await createTask('board-1', 'user-1', {
        title: 'First',
        description: '',
        status: 'Todo',
        subtasks: [],
      });

      expect(paths()).toEqual(['GET /boards/board-1/full', 'POST /tasks']);
      expect(calls[1].body).toMatchObject({
        boardId: 'board-1',
        columnId: 'col-todo',
        title: 'First',
      });
      expect(task.columnId).toBe('col-todo');
    });

    it('skips the lookup when the caller already knows the columnId', async () => {
      on('POST', /^\/tasks$/, () => ({
        status: 201,
        body: success({ task: taskDocument({ columnId: 'col-doing', status: 'Doing' }) }),
      }));

      await createTask('board-1', 'user-1', {
        title: 'Third',
        description: '',
        status: 'Doing',
        subtasks: [],
        columnId: 'col-doing',
      });

      expect(paths()).toEqual(['POST /tasks']);
      expect(calls[0].body.columnId).toBe('col-doing');
    });

    it('forwards dueDate and assignedTo only when set', async () => {
      on('POST', /^\/tasks$/, () => ({ status: 201, body: success({ task: taskDocument() }) }));

      await createTask('board-1', 'user-1', {
        title: 'With extras',
        description: 'd',
        status: 'Todo',
        subtasks: [{ title: 's', isCompleted: true }],
        columnId: 'col-todo',
        dueDate: '2026-12-31',
        assignedTo: 'user-9',
      });

      expect(calls[0].body).toMatchObject({
        dueDate: '2026-12-31',
        assignedTo: 'user-9',
        subtasks: [{ title: 's', isCompleted: true }],
      });
    });

    it('omits dueDate and assignedTo when absent', async () => {
      on('POST', /^\/tasks$/, () => ({ status: 201, body: success({ task: taskDocument() }) }));

      await createTask('board-1', 'user-1', {
        title: 'Bare',
        description: '',
        status: 'Todo',
        subtasks: [],
        columnId: 'col-todo',
      });

      expect(calls[0].body).not.toHaveProperty('dueDate');
      expect(calls[0].body).not.toHaveProperty('assignedTo');
    });

    it('explains a status that matches no column', async () => {
      on('GET', /full$/, () => ({ body: success(FULL_BOARD) }));

      await expect(
        createTask('board-1', 'user-1', {
          title: 'Orphan',
          description: '',
          status: 'Nowhere',
          subtasks: [],
        }),
      ).rejects.toThrow('This board has no column called "Nowhere"');
    });

    it('surfaces a 403 for a viewer', async () => {
      on('POST', /^\/tasks$/, () => ({
        status: 403,
        body: failure('This action requires editor access to the board'),
      }));

      await expect(
        createTask('board-1', 'user-1', {
          title: 'Nope',
          description: '',
          status: 'Todo',
          subtasks: [],
          columnId: 'col-todo',
        }),
      ).rejects.toThrow('This action requires editor access to the board');
    });
  });

  // ── updateTask ─────────────────────────────────────────────────────
  describe('updateTask', () => {
    it('PATCHes only the fields provided', async () => {
      on('PATCH', /^\/tasks\/task-1$/, () => ({ body: success({ task: taskDocument() }) }));

      await updateTask('task-1', { title: 'Renamed' });

      expect(paths()).toEqual(['PATCH /tasks/task-1']);
      expect(calls[0].body).toEqual({ title: 'Renamed' });
    });

    it('sends subtasks for a toggle', async () => {
      on('PATCH', /^\/tasks\/task-1$/, () => ({ body: success({ task: taskDocument() }) }));

      await updateTask('task-1', { subtasks: [{ title: 's', isCompleted: true }] });

      expect(calls[0].body).toEqual({ subtasks: [{ title: 's', isCompleted: true }] });
    });

    it('sends an explicit null to clear dueDate and assignedTo', async () => {
      on('PATCH', /^\/tasks\/task-1$/, () => ({ body: success({ task: taskDocument() }) }));

      await updateTask('task-1', { dueDate: null, assignedTo: null });

      expect(calls[0].body).toEqual({ dueDate: null, assignedTo: null });
    });

    it('strips status, columnId and position — those belong to the move route', async () => {
      // Sending them would earn a 400 that names the move endpoint.
      on('GET', /^\/tasks\/task-1$/, () => ({ body: success({ task: taskDocument() }) }));

      await updateTask('task-1', {
        status: 'Doing',
        columnId: 'col-doing',
        position: 3,
      } as any);

      expect(paths()).toEqual(['GET /tasks/task-1']);
      expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    });

    it('throws the server message on failure', async () => {
      on('PATCH', /^\/tasks\/task-1$/, () => ({ status: 404, body: failure('Task not found') }));

      await expect(updateTask('task-1', { title: 'X' })).rejects.toThrow('Task not found');
    });
  });

  // ── moveTask ───────────────────────────────────────────────────────
  describe('moveTask', () => {
    it('PATCHes the move endpoint with columnId and position', async () => {
      on('PATCH', /^\/tasks\/task-1\/move$/, () => ({
        body: success({
          task: taskDocument({ columnId: 'col-doing', status: 'Doing', position: 0 }),
        }),
      }));

      const moved = await moveTask('task-1', 'col-doing', 0);

      expect(paths()).toEqual(['PATCH /tasks/task-1/move']);
      expect(calls[0].body).toEqual({ columnId: 'col-doing', position: 0 });
      expect(moved).toMatchObject({
        columnId: 'col-doing',
        status: 'Doing',
        position: 0,
      });
    });

    it('uses the same endpoint for a same-column reorder', async () => {
      on('PATCH', /^\/tasks\/task-1\/move$/, () => ({
        body: success({ task: taskDocument({ position: 1 }) }),
      }));

      const moved = await moveTask('task-1', 'col-todo', 1);

      expect(calls[0].body).toEqual({ columnId: 'col-todo', position: 1 });
      expect(moved.position).toBe(1);
      expect(moved.columnId).toBe('col-todo');
    });

    it('returns the status the server rewrote', async () => {
      on('PATCH', /move$/, () => ({
        body: success({ task: taskDocument({ columnId: 'col-doing', status: 'Doing' }) }),
      }));

      const moved = await moveTask('task-1', 'col-doing', 0);

      expect(moved.status).toBe('Doing');
    });

    it('surfaces a viewer 403 so the drag can be rolled back', async () => {
      on('PATCH', /move$/, () => ({
        status: 403,
        body: failure('This action requires editor access to the board'),
      }));

      await expect(moveTask('task-1', 'col-doing', 0)).rejects.toThrow(
        'This action requires editor access to the board',
      );
    });

    it('surfaces a cross-board column rejection', async () => {
      on('PATCH', /move$/, () => ({
        status: 404,
        body: failure('Column not found on this board'),
      }));

      await expect(moveTask('task-1', 'someone-elses-column', 0)).rejects.toThrow(
        'Column not found on this board',
      );
    });
  });

  // ── deleteTask ─────────────────────────────────────────────────────
  describe('deleteTask', () => {
    it('DELETEs the task', async () => {
      on('DELETE', /^\/tasks\/task-1$/, () => ({ body: success({ id: 'task-1' }) }));

      await deleteTask('task-1');

      expect(paths()).toEqual(['DELETE /tasks/task-1']);
    });

    it('throws the server message on failure', async () => {
      on('DELETE', /^\/tasks\/task-1$/, () => ({ status: 404, body: failure('Task not found') }));

      await expect(deleteTask('task-1')).rejects.toThrow('Task not found');
    });
  });
});
