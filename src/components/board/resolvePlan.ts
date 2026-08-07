import type { useMoveTask, useUpdateTask, useCreateTask } from '../../queries/mutations';
import type { CommandPlan } from '../../services/aiApi';
import type { Board } from '../../types';

/**
 * Resolving an AI plan against a real board.
 *
 * Its own module because two surfaces need it: the command bar reads one
 * instruction, the chat panel holds a conversation, and both must turn the same
 * named action into the same change. One resolver means one set of matching rules
 * and one set of refusals, so the two cannot drift into disagreeing about what
 * "move the login fix to Done" does.
 *
 * Nothing here calls the model. The model names an action and some strings; the
 * matching happens against the board already in the cache and the write goes
 * through the same mutations the buttons use.
 */

/** What the plan resolves to on this board, or why it cannot. */
export interface Resolved {
  ok: boolean;
  summary: string;
  problem?: string;
  apply?: () => Promise<void>;
}

/** The mutations a resolved plan applies through, plus the board it applies to. */
export interface PlanDeps {
  moveTask: ReturnType<typeof useMoveTask>;
  updateTask: ReturnType<typeof useUpdateTask>;
  createTask: ReturnType<typeof useCreateTask>;
  boardId: string;
}

/**
 * Turns a named action into something callable, or explains why it cannot.
 *
 * Kept out of the component because it is pure: given a plan and a board it either
 * produces a closure over the existing mutations or a reason. That makes the failure
 * cases the readable part, which is the point of the whole flow.
 */
export function resolvePlan(
  plan: CommandPlan,
  board: Board,
  deps: PlanDeps,
): Resolved {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  const findTask = (title: string) => {
    for (const column of board.columns) {
      const task = column.tasks.find((candidate) => same(candidate.title, title));
      if (task) return { task, column };
    }
    return null;
  };
  const findColumn = (name: string) =>
    board.columns.find((column) => same(column.name, name));
  const findPerson = (name: string) =>
    (board.members ?? []).find((member) => same(member.name, name));

  if (plan.action === 'unknown') {
    return {
      ok: false,
      summary: plan.summary || 'That did not match anything this can do.',
      problem:
        'Try naming a task and what should happen to it, for example "move the login fix to Done".',
    };
  }

  if (plan.action === 'move_task') {
    const found = findTask(plan.taskTitle);
    const target = findColumn(plan.columnName);

    if (!found) return { ok: false, summary: plan.summary, problem: `No task called "${plan.taskTitle}" on this board.` };
    if (!target) return { ok: false, summary: plan.summary, problem: `No column called "${plan.columnName}".` };
    if (found.column.id === target.id) {
      return { ok: false, summary: plan.summary, problem: `It is already in ${target.name}.` };
    }

    return {
      ok: true,
      summary: `Move "${found.task.title}" from ${found.column.name} to ${target.name}.`,
      apply: async () => {
        await deps.moveTask.mutateAsync({
          taskId: found.task.id!,
          columnId: target.id!,
          // Appended, which is where a card dropped on a column lands.
          position: target.tasks.length,
          boardId: deps.boardId,
        });
      },
    };
  }

  if (plan.action === 'assign_task') {
    const found = findTask(plan.taskTitle);
    const person = findPerson(plan.assigneeName);

    if (!found) return { ok: false, summary: plan.summary, problem: `No task called "${plan.taskTitle}".` };
    if (!person) {
      return {
        ok: false,
        summary: plan.summary,
        problem: `Nobody called "${plan.assigneeName}" has access to this board. Share it with them first.`,
      };
    }

    return {
      ok: true,
      summary: `Assign "${found.task.title}" to ${person.name}.`,
      apply: async () => {
        await deps.updateTask.mutateAsync({
          taskId: found.task.id!,
          boardId: deps.boardId,
          updates: { assignedTo: person.id },
        });
      },
    };
  }

  if (plan.action === 'set_due_date') {
    const found = findTask(plan.taskTitle);

    if (!found) return { ok: false, summary: plan.summary, problem: `No task called "${plan.taskTitle}".` };
    if (!plan.dueDate) {
      return {
        ok: false,
        summary: plan.summary,
        problem: 'No clear date in that. Try an explicit one, like "due 12 September".',
      };
    }

    return {
      ok: true,
      summary: `Set "${found.task.title}" due ${plan.dueDate}.`,
      apply: async () => {
        await deps.updateTask.mutateAsync({
          taskId: found.task.id!,
          boardId: deps.boardId,
          updates: { dueDate: plan.dueDate },
        });
      },
    };
  }

  // create_task
  const title = plan.newTaskTitle || plan.taskTitle;
  const target = plan.columnName ? findColumn(plan.columnName) : board.columns[0];

  if (!title) return { ok: false, summary: plan.summary, problem: 'No title for the new task.' };
  if (!target) return { ok: false, summary: plan.summary, problem: 'This board has no columns yet.' };

  return {
    ok: true,
    summary: `Add "${title}" to ${target.name}.`,
    apply: async () => {
      await deps.createTask.mutateAsync({
        boardId: deps.boardId,
        task: {
          title,
          description: '',
          // `status` is the column name and `columnId` the authoritative id. Both
          // are set, so the API does not have to resolve one from the other.
          status: target.name,
          columnId: target.id,
          subtasks: [],
          ...(plan.dueDate ? { dueDate: plan.dueDate } : {}),
        },
      });
    },
  };
}
