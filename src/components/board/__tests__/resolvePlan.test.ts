import { describe, it, expect, vi } from 'vitest';
import { resolvePlan, type PlanDeps } from '../resolvePlan';
import type { CommandPlan } from '../../../services/aiApi';
import type { Board } from '../../../types';

/**
 * The resolver is the safety layer for both AI surfaces.
 *
 * The model can name any task, column or person it likes. What stops a plausible
 * sentence becoming a wrong write is this: an exact match against the real board, or
 * a refusal. Those refusals are the cases worth testing, because the happy path is
 * visible on screen and a bad match is not.
 */

const board: Board = {
  id: 'b1',
  name: 'Platform Launch',
  columns: [
    {
      id: 'c-todo',
      name: 'Todo',
      tasks: [
        { id: 't-login', title: 'Fix the login redirect', description: '', status: 'Todo', subtasks: [] },
      ],
    },
    {
      id: 'c-done',
      name: 'Done',
      tasks: [
        { id: 't-changelog', title: 'Write the changelog', description: '', status: 'Done', subtasks: [] },
      ],
    },
  ],
  members: [
    { id: 'u-ama', name: 'Ama Mensah', email: 'ama@example.com', role: 'editor', via: 'collaborator' },
  ],
} as unknown as Board;

function deps() {
  const bag = {
    moveTask: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    updateTask: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    createTask: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    boardId: 'b1',
  };
  return bag as unknown as PlanDeps & typeof bag;
}

const plan = (overrides: Partial<CommandPlan>): CommandPlan => ({
  action: 'move_task',
  taskTitle: '',
  columnName: '',
  assigneeName: '',
  dueDate: '',
  newTaskTitle: '',
  summary: 'A summary',
  ...overrides,
});

describe('resolvePlan move_task', () => {
  it('moves a task to the end of the target column', async () => {
    const bag = deps();
    const resolved = resolvePlan(
      plan({ taskTitle: 'Fix the login redirect', columnName: 'Done' }),
      board,
      bag,
    );

    expect(resolved.ok).toBe(true);
    // The summary names both ends, so the confirmation is checkable at a glance.
    expect(resolved.summary).toContain('Todo');
    expect(resolved.summary).toContain('Done');

    await resolved.apply!();
    expect(bag.moveTask.mutateAsync).toHaveBeenCalledWith({
      taskId: 't-login',
      columnId: 'c-done',
      // Appended, matching where a dropped card lands.
      position: 1,
      boardId: 'b1',
    });
  });

  it('matches titles case-insensitively but not loosely', () => {
    const exact = resolvePlan(
      plan({ taskTitle: 'fix the LOGIN redirect', columnName: 'done' }),
      board,
      deps(),
    );
    expect(exact.ok).toBe(true);

    // A near miss is refused rather than guessed at: acting on the closest match is
    // how the wrong card moves.
    const near = resolvePlan(plan({ taskTitle: 'login redirect', columnName: 'Done' }), board, deps());
    expect(near.ok).toBe(false);
    expect(near.problem).toContain('No task called');
  });

  it('refuses an unknown column', () => {
    const resolved = resolvePlan(
      plan({ taskTitle: 'Fix the login redirect', columnName: 'Shipped' }),
      board,
      deps(),
    );
    expect(resolved.ok).toBe(false);
    expect(resolved.problem).toContain('Shipped');
  });

  it('refuses a move that would change nothing', () => {
    const resolved = resolvePlan(
      plan({ taskTitle: 'Write the changelog', columnName: 'Done' }),
      board,
      deps(),
    );
    expect(resolved.ok).toBe(false);
    expect(resolved.problem).toContain('already');
  });
});

describe('resolvePlan assign_task', () => {
  it('assigns to a member of the board', async () => {
    const bag = deps();
    const resolved = resolvePlan(
      plan({ action: 'assign_task', taskTitle: 'Write the changelog', assigneeName: 'Ama Mensah' }),
      board,
      bag,
    );

    expect(resolved.ok).toBe(true);
    await resolved.apply!();
    expect(bag.updateTask.mutateAsync).toHaveBeenCalledWith({
      taskId: 't-changelog',
      boardId: 'b1',
      updates: { assignedTo: 'u-ama' },
    });
  });

  it('refuses somebody without access and says how to fix it', () => {
    const resolved = resolvePlan(
      plan({ action: 'assign_task', taskTitle: 'Write the changelog', assigneeName: 'Kofi' }),
      board,
      deps(),
    );

    expect(resolved.ok).toBe(false);
    // Assigning work to somebody who cannot open the board is not a thing to do
    // silently, and the API refuses it anyway.
    expect(resolved.problem).toMatch(/share it with them/i);
  });
});

describe('resolvePlan set_due_date', () => {
  it('sets a date the server accepted', async () => {
    const bag = deps();
    const resolved = resolvePlan(
      plan({ action: 'set_due_date', taskTitle: 'Fix the login redirect', dueDate: '2026-09-12' }),
      board,
      bag,
    );

    expect(resolved.ok).toBe(true);
    await resolved.apply!();
    expect(bag.updateTask.mutateAsync).toHaveBeenCalledWith({
      taskId: 't-login',
      boardId: 'b1',
      updates: { dueDate: '2026-09-12' },
    });
  });

  it('asks for an explicit date when the server stripped a vague one', () => {
    const resolved = resolvePlan(
      plan({ action: 'set_due_date', taskTitle: 'Fix the login redirect', dueDate: '' }),
      board,
      deps(),
    );

    expect(resolved.ok).toBe(false);
    expect(resolved.problem).toMatch(/explicit/i);
  });
});

describe('resolvePlan create_task', () => {
  it('creates in the named column with both status and columnId set', async () => {
    const bag = deps();
    const resolved = resolvePlan(
      plan({ action: 'create_task', newTaskTitle: 'Update the docs', columnName: 'Done' }),
      board,
      bag,
    );

    expect(resolved.ok).toBe(true);
    await resolved.apply!();
    expect(bag.createTask.mutateAsync).toHaveBeenCalledWith({
      boardId: 'b1',
      task: expect.objectContaining({
        title: 'Update the docs',
        status: 'Done',
        columnId: 'c-done',
      }),
    });
  });

  it('falls back to the first column when none is named', async () => {
    const bag = deps();
    const resolved = resolvePlan(
      plan({ action: 'create_task', newTaskTitle: 'Update the docs' }),
      board,
      bag,
    );

    await resolved.apply!();
    expect(bag.createTask.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ task: expect.objectContaining({ columnId: 'c-todo' }) }),
    );
  });

  it('refuses a task with no title', () => {
    const resolved = resolvePlan(plan({ action: 'create_task' }), board, deps());
    expect(resolved.ok).toBe(false);
  });
});

describe('resolvePlan unknown', () => {
  it('explains what to say instead, and offers nothing', () => {
    const resolved = resolvePlan(plan({ action: 'unknown', summary: '' }), board, deps());

    expect(resolved.ok).toBe(false);
    expect(resolved.apply).toBeUndefined();
    expect(resolved.problem).toContain('move the login fix to Done');
  });
});
