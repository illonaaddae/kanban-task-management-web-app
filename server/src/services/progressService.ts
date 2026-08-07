import type { Types } from "mongoose";
import type { TaskDocument } from "../models/Task";
import type { UserDocument } from "../models/User";
import { boardRepository } from "../repositories/boardRepository";
import { columnRepository } from "../repositories/columnRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { taskRepository } from "../repositories/taskRepository";

/** Somebody the caller shares at least one team with. */
export interface TeammateView {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Which teams they are in with the caller — shown as context in the picker. */
  teams: string[];
}

export interface MemberProgress {
  /** Null for the unassigned bucket. */
  userId: string | null;
  name: string;
  email: string;
  avatar?: string;
  assigned: number;
  /** Tasks sitting in the board's last column, which is "done" by convention. */
  completed: number;
  /** Tasks whose due date has passed and that are not in the last column. */
  overdue: number;
  subtasks: { total: number; completed: number };
  /** 0–100, by task count. Rounded for display; 0 when nothing is assigned. */
  completionRate: number;
}

export interface BoardProgress {
  boardId: string;
  /** The column treated as "done" — the last one, by position. */
  doneColumn: string | null;
  totals: {
    tasks: number;
    completed: number;
    overdue: number;
    unassigned: number;
    completionRate: number;
  };
  members: MemberProgress[];
}

type PopulatedUser = {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
  avatar?: string;
};

/** A member entry's `user` after populate, or a bare id when it was not. */
function asPopulated(user: unknown): PopulatedUser | null {
  if (!user) return null;
  const candidate = user as PopulatedUser;
  return typeof candidate.name === "string" ? candidate : null;
}

function rate(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

/** One of the caller's assigned tasks, with the context needed to open it. */
export interface AssignedTask {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  dueDate: string | null;
  isOverdue: boolean;
  /** True when the task sits in its board's last column. */
  isDone: boolean;
  subtasks: { total: number; completed: number };
  board: { id: string; name: string; organizationId: string | null };
  column: { id: string; name: string };
}

export interface TeamAnalytics {
  organizationId: string;
  boards: number;
  totals: {
    tasks: number;
    completed: number;
    overdue: number
    unassigned: number;
    completionRate: number;
  };
  /** Per-person across every board in the team. */
  members: MemberProgress[];
  /** Per-board headline numbers, busiest first. */
  perBoard: Array<{
    boardId: string;
    name: string;
    tasks: number;
    completed: number;
    overdue: number;
    completionRate: number;
  }>;
}

export const progressService = {
  /**
   * Everyone the caller shares a team with.
   *
   * Exists so board sharing can offer a pick-list instead of demanding a typed
   * email address — which could only ever reach people who already had an
   * account, and produced "user not found" for everyone else.
   *
   * Deliberately *not* an authorisation surface: being a teammate grants nothing
   * on any board. It only decides whose name is suggested.
   */
  async teammatesFor(user: UserDocument): Promise<TeammateView[]> {
    const orgs = await organizationRepository.findForUserPopulated(user._id);
    const selfId = user._id.toString();

    // Keyed by user id, so somebody in three shared teams appears once.
    const byId = new Map<string, TeammateView>();

    const add = (candidate: unknown, teamName: string) => {
      const populated = asPopulated(candidate);
      if (!populated) return;

      const id = populated._id.toString();
      if (id === selfId) return;

      const existing = byId.get(id);
      if (existing) {
        if (!existing.teams.includes(teamName)) existing.teams.push(teamName);
        return;
      }

      byId.set(id, {
        id,
        name: populated.name!,
        email: populated.email ?? "",
        ...(populated.avatar ? { avatar: populated.avatar } : {}),
        teams: [teamName],
      });
    };

    for (const org of orgs) {
      // The owner is not a members entry, so they have to be added separately or
      // a team's creator never appears in anyone else's picker.
      add(org.owner, org.name);
      for (const member of org.members) add(member.user, org.name);
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Per-person progress on one board.
   *
   * "Done" is the last column by position rather than a name match: boards
   * rename that column freely ("Shipped", "Complete"), and position is what the
   * UI already treats as the end of the flow.
   *
   * Scoped to a single board on purpose. An organization-wide roll-up would have
   * to span boards the caller may not be able to see, and there is no board↔team
   * link to bound it by — so it would either leak or lie.
   */
  async forBoard(boardId: string): Promise<BoardProgress> {
    const [board, columns, tasks] = await Promise.all([
      // Populated, and read here rather than passed in: the caller would have had
      // to fetch the board's people some other way, and the only source that
      // includes the *owner* is this one. `getFull().collaborators` omits them,
      // which would have filed an owner's own tasks under "Former member".
      boardRepository.findByIdPopulated(boardId),
      columnRepository.findByBoardId(boardId),
      taskRepository.findByBoardId(boardId),
    ]);

    const people: Array<{ id: string; name: string; email: string; avatar?: string }> = [];
    const addPerson = (candidate: unknown) => {
      const populated = asPopulated(candidate);
      if (!populated) return;
      people.push({
        id: populated._id.toString(),
        name: populated.name!,
        email: populated.email ?? "",
        ...(populated.avatar ? { avatar: populated.avatar } : {}),
      });
    };

    if (board) {
      addPerson(board.owner);
      for (const collaborator of board.collaborators) addPerson(collaborator.user);
    }

    const ordered = [...columns].sort((a, b) => a.position - b.position);
    // A board needs at least two columns for "the last one" to mean anything.
    // With one column every task would count as complete, which is just false.
    const doneColumn = ordered.length >= 2 ? ordered.at(-1) ?? null : null;
    const doneColumnId = doneColumn?._id.toString() ?? null;

    const isDone = (task: TaskDocument) =>
      doneColumnId !== null && task.columnId.toString() === doneColumnId;

    const now = Date.now();
    const isOverdue = (task: TaskDocument) =>
      !isDone(task) && !!task.dueDate && task.dueDate.getTime() < now;

    // Seed a row per person so somebody with nothing assigned still shows up —
    // "no tasks" is a fact about them, not a reason to hide them.
    const rows = new Map<string | null, MemberProgress>();
    const blank = (
      userId: string | null,
      name: string,
      email: string,
      avatar?: string,
    ): MemberProgress => ({
      userId,
      name,
      email,
      ...(avatar ? { avatar } : {}),
      assigned: 0,
      completed: 0,
      overdue: 0,
      subtasks: { total: 0, completed: 0 },
      completionRate: 0,
    });

    for (const person of people) {
      rows.set(person.id, blank(person.id, person.name, person.email, person.avatar));
    }

    let unassigned = 0;

    for (const task of tasks) {
      const assignee = task.assignedTo ? task.assignedTo.toString() : null;
      if (assignee === null) unassigned += 1;

      // An assignee who has since been removed from the board still owns tasks,
      // and dropping them would make the totals disagree with the board.
      const key = assignee;
      const row =
        rows.get(key) ??
        blank(
          key,
          key === null ? "Unassigned" : "Former member",
          "",
        );
      rows.set(key, row);

      row.assigned += 1;
      if (isDone(task)) row.completed += 1;
      if (isOverdue(task)) row.overdue += 1;
      row.subtasks.total += task.subtasks.length;
      row.subtasks.completed += task.subtasks.filter((s) => s.isCompleted).length;
    }

    const members = [...rows.values()]
      .map((row) => ({ ...row, completionRate: rate(row.completed, row.assigned) }))
      // Busiest first; the unassigned bucket sorts last regardless, because it is
      // a queue rather than a person.
      .sort((a, b) => {
        if (a.userId === null) return 1;
        if (b.userId === null) return -1;
        return b.assigned - a.assigned || a.name.localeCompare(b.name);
      });

    const completed = tasks.filter(isDone).length;
    const overdue = tasks.filter(isOverdue).length;

    return {
      boardId,
      doneColumn: doneColumn?.title ?? null,
      totals: {
        tasks: tasks.length,
        completed,
        overdue,
        unassigned,
        completionRate: rate(completed, tasks.length),
      },
      members,
    };
  },

  /**
   * Every task assigned to the caller, across every board they can reach.
   *
   * This is what a team member logs in to do. Boards are resolved through the
   * same union `GET /boards` uses — owned, shared, and belonging to a team they
   * are in — so a task on a team board shows up without anyone having invited
   * them to that board individually.
   */
  async assignedTo(user: UserDocument): Promise<AssignedTask[]> {
    const orgs = await organizationRepository.findForUser(user._id);
    const boards = await boardRepository.findForUser(
      user._id,
      orgs.map((org) => org._id),
    );
    const boardIds = boards.map((board) => board._id);

    const [tasks, columns] = await Promise.all([
      taskRepository.findAssignedInBoards(user._id, boardIds),
      // One query for every board's columns, rather than one per task, so this
      // stays two round trips regardless of how much is assigned.
      Promise.all(boardIds.map((id) => columnRepository.findByBoardId(id))).then((sets) =>
        sets.flat(),
      ),
    ]);

    const boardById = new Map(boards.map((board) => [board._id.toString(), board]));
    const columnById = new Map(columns.map((column) => [column._id.toString(), column]));

    // The last column per board is "done", same rule as the progress table —
    // including the two-column minimum, so a single-column board never reports
    // everything as finished.
    const columnCountByBoard = new Map<string, number>();
    for (const column of columns) {
      const key = column.boardId.toString();
      columnCountByBoard.set(key, (columnCountByBoard.get(key) ?? 0) + 1);
    }

    const lastColumnByBoard = new Map<string, string>();
    for (const column of columns) {
      const key = column.boardId.toString();
      if ((columnCountByBoard.get(key) ?? 0) < 2) continue;

      const current = lastColumnByBoard.get(key);
      const currentPosition = current ? columnById.get(current)?.position ?? -1 : -1;
      if (column.position >= currentPosition) lastColumnByBoard.set(key, column._id.toString());
    }

    const now = Date.now();

    return tasks.flatMap((task) => {
      const board = boardById.get(task.boardId.toString());
      const column = columnById.get(task.columnId.toString());
      // A task whose board or column has gone is not something the user can act
      // on, and rendering a row that cannot be opened is worse than omitting it.
      if (!board || !column) return [];

      const isDone = lastColumnByBoard.get(task.boardId.toString()) === task.columnId.toString();

      return [
        {
          id: task._id.toString(),
          title: task.title,
          description: task.description,
          status: task.status,
          position: task.position,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          isOverdue: !isDone && !!task.dueDate && task.dueDate.getTime() < now,
          isDone,
          subtasks: {
            total: task.subtasks.length,
            completed: task.subtasks.filter((sub) => sub.isCompleted).length,
          },
          board: {
            id: board._id.toString(),
            name: board.title,
            organizationId: board.organization ? board.organization.toString() : null,
          },
          column: { id: column._id.toString(), name: column.title },
        },
      ];
    });
  },

  /**
   * Team-wide roll-up across every board belonging to the team.
   *
   * Safe to aggregate here — unlike a per-user view, the scope is exactly the
   * team's own boards, and the route restricts it to team admins.
   */
  async forOrganization(orgId: string): Promise<TeamAnalytics> {
    const [org, boards] = await Promise.all([
      organizationRepository.findByIdPopulated(orgId),
      boardRepository.findForOrganization(orgId),
    ]);

    const boardIds = boards.map((board) => board._id);
    const [tasks, columnSets] = await Promise.all([
      taskRepository.findByBoardIds(boardIds),
      Promise.all(boardIds.map((id) => columnRepository.findByBoardId(id))),
    ]);

    // Done column per board, by position.
    const doneByBoard = new Map<string, string>();
    for (const columns of columnSets) {
      // Same rule as forBoard: one column is a queue, not a workflow with an end.
      if (columns.length < 2) continue;
      const ordered = [...columns].sort((a, b) => a.position - b.position);
      const last = ordered.at(-1);
      if (last) doneByBoard.set(last.boardId.toString(), last._id.toString());
    }

    const now = Date.now();
    const isDone = (task: TaskDocument) =>
      doneByBoard.get(task.boardId.toString()) === task.columnId.toString();
    const isOverdue = (task: TaskDocument) =>
      !isDone(task) && !!task.dueDate && task.dueDate.getTime() < now;

    const rows = new Map<string | null, MemberProgress>();
    const seed = (userId: string | null, name: string, email: string, avatar?: string) => {
      rows.set(userId, {
        userId,
        name,
        email,
        ...(avatar ? { avatar } : {}),
        assigned: 0,
        completed: 0,
        overdue: 0,
        subtasks: { total: 0, completed: 0 },
        completionRate: 0,
      });
    };

    // Everyone in the team, so a member with nothing assigned still appears.
    if (org) {
      const owner = asPopulated(org.owner);
      if (owner) seed(owner._id.toString(), owner.name!, owner.email ?? "", owner.avatar);
      for (const member of org.members) {
        const populated = asPopulated(member.user);
        if (populated) {
          seed(populated._id.toString(), populated.name!, populated.email ?? "", populated.avatar);
        }
      }
    }

    let unassigned = 0;
    for (const task of tasks) {
      const key = task.assignedTo ? task.assignedTo.toString() : null;
      if (key === null) unassigned += 1;

      if (!rows.has(key)) {
        seed(key, key === null ? "Unassigned" : "Outside the team", "");
      }
      const row = rows.get(key)!;

      row.assigned += 1;
      if (isDone(task)) row.completed += 1;
      if (isOverdue(task)) row.overdue += 1;
      row.subtasks.total += task.subtasks.length;
      row.subtasks.completed += task.subtasks.filter((sub) => sub.isCompleted).length;
    }

    const members = [...rows.values()]
      .map((row) => ({ ...row, completionRate: rate(row.completed, row.assigned) }))
      .sort((a, b) => {
        if (a.userId === null) return 1;
        if (b.userId === null) return -1;
        return b.assigned - a.assigned || a.name.localeCompare(b.name);
      });

    const tasksByBoard = new Map<string, TaskDocument[]>();
    for (const task of tasks) {
      const key = task.boardId.toString();
      const bucket = tasksByBoard.get(key);
      if (bucket) bucket.push(task);
      else tasksByBoard.set(key, [task]);
    }

    const perBoard = boards
      .map((board) => {
        const own = tasksByBoard.get(board._id.toString()) ?? [];
        const completed = own.filter(isDone).length;
        return {
          boardId: board._id.toString(),
          name: board.title,
          tasks: own.length,
          completed,
          overdue: own.filter(isOverdue).length,
          completionRate: rate(completed, own.length),
        };
      })
      .sort((a, b) => b.tasks - a.tasks || a.name.localeCompare(b.name));

    const completed = tasks.filter(isDone).length;

    return {
      organizationId: orgId,
      boards: boards.length,
      totals: {
        tasks: tasks.length,
        completed,
        overdue: tasks.filter(isOverdue).length,
        unassigned,
        completionRate: rate(completed, tasks.length),
      },
      members,
      perBoard,
    };
  },
};

export default progressService;
