import type { Types } from "mongoose";
import type { BoardDocument, CollaboratorRole } from "../models/Board";
import type { ISubtask, TaskDocument } from "../models/Task";
import type { UserDocument } from "../models/User";
import type { EffectiveRole } from "../middlewares/boardAccess";
import { activityRepository } from "../repositories/activityRepository";
import { boardRepository } from "../repositories/boardRepository";
import { organizationRepository } from "../repositories/organizationRepository";
import { columnRepository } from "../repositories/columnRepository";
import { taskRepository } from "../repositories/taskRepository";
import { userRepository } from "../repositories/userRepository";
import { AppError } from "../utils/AppError";
import { activityService } from "./activityService";

/** A board serialised for the client, with the caller's role folded in. */
export type BoardWithRole = Record<string, unknown> & { myRole: EffectiveRole };

export interface CascadeCounts {
  columns: number;
  tasks: number;
  activity: number;
}

// ── Full board shape (the frontend-compat contract) ────────────────────────

export interface FullBoardCollaborator {
  user: { id: string; name: string; email: string } | null;
  role: CollaboratorRole;
}

export interface FullBoardTask {
  id: string;
  title: string;
  description: string;
  status: string;
  position: number;
  assignedTo: string | null;
  dueDate: string | null;
  subtasks: ISubtask[];
}

export interface FullBoardColumn {
  id: string;
  name: string;
  position: number;
  tasks: FullBoardTask[];
}

export interface FullBoard {
  id: string;
  name: string;
  myRole: EffectiveRole;
  /** The team this board belongs to, or null when it is personal. */
  organizationId: string | null;
  collaborators: FullBoardCollaborator[];
  columns: FullBoardColumn[];
}

/** A `collaborators.user` entry after populate - or a bare id if not populated. */
type MaybePopulatedUser =
  | Types.ObjectId
  | { _id: Types.ObjectId; name?: string; email?: string };

function toFullCollaboratorUser(
  user: MaybePopulatedUser,
): FullBoardCollaborator["user"] {
  // A populated ref is null when the referenced user was deleted.
  if (!user) return null;

  const populated = user as { _id: Types.ObjectId; name?: string; email?: string };
  if (typeof populated.name !== "string") return null;

  return {
    id: populated._id.toString(),
    name: populated.name,
    email: populated.email ?? "",
  };
}

function toFullTask(task: TaskDocument): FullBoardTask {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    status: task.status,
    position: task.position,
    assignedTo: task.assignedTo ? task.assignedTo.toString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    subtasks: task.subtasks.map((s) => ({
      title: s.title,
      isCompleted: s.isCompleted,
    })),
  };
}

export function withMyRole(board: BoardDocument, myRole: EffectiveRole): BoardWithRole {
  return { ...(board.toJSON() as Record<string, unknown>), myRole };
}

function roleOnBoard(
  board: BoardDocument,
  user: UserDocument,
  teamBoardIds?: Set<string>,
): EffectiveRole {
  if (board.owner.toString() === user._id.toString()) return "owner";

  const entry = board.collaborators.find(
    (c) => c.user.toString() === user._id.toString(),
  );
  if (entry) return entry.role;

  // Team boards: membership grants editor, mirroring boardAccess. `teamBoardIds`
  // is the set the caller reached *through* a team, computed once per list rather
  // than re-read per board.
  if (board.organization && teamBoardIds?.has(board._id.toString())) return "editor";

  return user.role === "admin" ? "admin" : "viewer";
}

export const boardService = {
  /** Boards the user owns plus boards shared with them, each tagged with myRole. */
  async listForUser(user: UserDocument): Promise<BoardWithRole[]> {
    const orgs = await organizationRepository.findForUser(user._id);
    const orgIds = orgs.map((org) => org._id);

    const boards = await boardRepository.findForUser(user._id, orgIds);

    // Which boards the caller reached via a team, so `myRole` can say `editor`
    // for them without a lookup per board.
    const orgIdSet = new Set(orgIds.map((id) => id.toString()));
    const teamBoardIds = new Set(
      boards
        .filter((board) => board.organization && orgIdSet.has(board.organization.toString()))
        .map((board) => board._id.toString()),
    );

    return boards.map((board) =>
      withMyRole(board, roleOnBoard(board, user, teamBoardIds)),
    );
  },

  /**
   * Creates a board, optionally inside a team.
   *
   * A team board is reachable by every member of that team, so the caller has to
   * actually be in the team they are naming - otherwise this would be a way to
   * publish a board into somebody else's team.
   */
  async create(
    user: UserDocument,
    title: string,
    organizationId?: string,
  ): Promise<BoardWithRole> {
    if (organizationId) {
      const org = await organizationRepository.findById(organizationId);
      if (!org) throw AppError.notFound("Organization not found");

      const userId = user._id.toString();
      const belongs =
        org.owner.toString() === userId ||
        org.members.some((m) => m.user.toString() === userId);

      if (!belongs && user.role !== "admin") {
        throw AppError.forbidden("You are not a member of that organization");
      }
    }

    const board = await boardRepository.create({
      title,
      owner: user._id,
      ...(organizationId ? { organization: organizationId } : {}),
    });

    await activityService.log({
      boardId: board._id,
      user: user._id,
      action: "board.created",
      message: `${user.name} created the board "${board.title}"`,
      meta: { title: board.title },
    });

    return withMyRole(board, "owner");
  },

  /**
   * Board with collaborator identities resolved, for the share modal.
   *
   * On a team board the response also carries `teamMembers`: people who can reach
   * this board through the team rather than through an invitation. They are a
   * separate field, not extra `collaborators`, because a collaborator entry means
   * an explicit per-board grant - merging them would make the share modal offer
   * to "remove" somebody who was never added, and the removal would silently do
   * nothing.
   *
   * The assignee picker needs them, though: the API accepts a teammate as an
   * assignee on a team board, so a UI built only from `collaborators` could not
   * offer what the server would allow.
   */
  async getDetailed(boardId: string, myRole: EffectiveRole): Promise<BoardWithRole> {
    const board = await boardRepository.findByIdPopulated(boardId);
    if (!board) throw AppError.notFound("Board not found");

    const base = withMyRole(board, myRole);
    if (!board.organization) return base;

    const org = await organizationRepository.findByIdPopulated(board.organization);
    if (!org) return base;

    // Anyone already listed reaches the board another way, and their real role is
    // the one shown there - the owner is not "a team editor".
    const alreadyListed = new Set<string>([
      board.owner._id?.toString() ?? board.owner.toString(),
      ...board.collaborators.map((c) => c.user._id?.toString() ?? c.user.toString()),
    ]);

    const people: Array<Types.ObjectId | Record<string, unknown>> = [
      org.owner,
      ...org.members.map((m) => m.user),
    ];

    const teamMembers = people.flatMap((candidate) => {
      const populated = candidate as {
        _id?: Types.ObjectId;
        name?: string;
        email?: string;
        avatar?: string;
      };
      // Unpopulated, or the account was deleted.
      if (!populated?._id || typeof populated.name !== "string") return [];

      const id = populated._id.toString();
      if (alreadyListed.has(id)) return [];
      alreadyListed.add(id);

      return [
        {
          id,
          name: populated.name,
          email: populated.email ?? "",
          ...(populated.avatar ? { avatar: populated.avatar } : {}),
          // Their effective role, matching what boardAccess grants.
          role: "editor" as const,
        },
      ];
    });

    return {
      ...base,
      organizationId: board.organization.toString(),
      organizationName: org.name,
      teamMembers,
    };
  },

  /**
   * The nested board the frontend renders in one request.
   *
   * Columns and tasks are fetched concurrently, then tasks are grouped by
   * `columnId` - not by `status`. Grouping by status would misfile every task
   * on a board that has two columns sharing a name, and would drop tasks
   * whose status drifted from their column's title.
   */
  async getFull(boardId: string, myRole: EffectiveRole): Promise<FullBoard> {
    const board = await boardRepository.findByIdPopulated(boardId);
    if (!board) throw AppError.notFound("Board not found");

    const [columns, tasks] = await Promise.all([
      columnRepository.findByBoardId(boardId),
      taskRepository.findByBoardId(boardId),
    ]);

    const tasksByColumn = new Map<string, TaskDocument[]>();
    for (const task of tasks) {
      const key = task.columnId.toString();
      const bucket = tasksByColumn.get(key);
      if (bucket) bucket.push(task);
      else tasksByColumn.set(key, [task]);
    }

    return {
      id: board._id.toString(),
      // `name` mirrors `title` so the existing frontend Board type still fits.
      name: board.title,
      myRole,
      organizationId: board.organization ? board.organization.toString() : null,
      collaborators: board.collaborators.map((c) => ({
        user: toFullCollaboratorUser(c.user as unknown as MaybePopulatedUser),
        role: c.role,
      })),
      columns: columns
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((column) => ({
          id: column._id.toString(),
          name: column.title,
          position: column.position,
          tasks: (tasksByColumn.get(column._id.toString()) ?? [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(toFullTask),
        })),
    };
  },

  /**
   * Renames a board, and optionally moves it into or out of a team.
   *
   * `organizationId: null` detaches it; omitting the key leaves the current team
   * alone. Moving a board into a team grants every member of that team access, so
   * the caller has to be in it - same check as creation.
   */
  async rename(
    boardId: string,
    title: string,
    myRole: EffectiveRole,
    user: UserDocument,
    organizationId?: string | null,
  ): Promise<BoardWithRole> {
    const updates: { title: string; organization?: string | null } = { title };

    if (organizationId !== undefined) {
      if (organizationId === null) {
        updates.organization = null;
      } else {
        const org = await organizationRepository.findById(organizationId);
        if (!org) throw AppError.notFound("Organization not found");

        const userId = user._id.toString();
        const belongs =
          org.owner.toString() === userId ||
          org.members.some((m) => m.user.toString() === userId);

        if (!belongs && user.role !== "admin") {
          throw AppError.forbidden("You are not a member of that organization");
        }
        updates.organization = organizationId;
      }
    }

    const previousTitle = (await boardRepository.findById(boardId))?.title;

    const board = await boardRepository.updateById(boardId, updates);
    if (!board) throw AppError.notFound("Board not found");

    // Renaming a board left no trace at all before this. Only logged when the
    // title actually changed, so moving a board between teams does not produce a
    // "renamed" entry claiming otherwise.
    if (previousTitle && previousTitle !== board.title) {
      await activityService.log({
        boardId: board._id,
        user: user._id,
        action: "board.renamed",
        message: `${user.name} renamed the board to "${board.title}"`,
        meta: { from: previousTitle, to: board.title },
      });
    }

    if (updates.organization !== undefined) {
      await activityService.log({
        boardId: board._id,
        user: user._id,
        action: updates.organization === null ? "board.detached" : "board.attached",
        message:
          updates.organization === null
            ? `${user.name} made this a personal board`
            : `${user.name} moved this board into a team`,
        meta: { organization: updates.organization },
      });
    }

    return withMyRole(board, myRole);
  },

  /**
   * Deletes the board and everything hanging off it.
   *
   * Children go first: if the run fails partway the board still exists and the
   * delete can be retried, rather than leaving orphaned columns and tasks that
   * nothing can reach.
   */
  async remove(boardId: string): Promise<CascadeCounts> {
    const [tasks, columns, activity] = await Promise.all([
      taskRepository.deleteByBoardId(boardId),
      columnRepository.deleteByBoardId(boardId),
      activityRepository.deleteByBoardId(boardId),
    ]);

    const deleted = await boardRepository.deleteById(boardId);
    if (!deleted) throw AppError.notFound("Board not found");

    return { columns, tasks, activity };
  },

  async addCollaborator(
    board: BoardDocument,
    actor: UserDocument,
    email: string,
    role: CollaboratorRole,
  ): Promise<BoardWithRole> {
    const invitee = await userRepository.findByEmail(email);

    // Only the board owner reaches this line, so the response is not an open
    // account-existence oracle. The wording stays scoped to the invite and
    // says nothing about the account beyond "cannot be invited".
    if (!invitee) {
      throw AppError.notFound(
        "No account was found for that email address, so they cannot be invited yet",
      );
    }

    if (board.owner.toString() === invitee._id.toString()) {
      throw AppError.conflict("The board owner already has full access");
    }

    // Returns null when the user is already on the board - the filter carries
    // the $ne, so this is one atomic check-and-insert rather than a race.
    const updated = await boardRepository.addCollaborator(
      board._id,
      invitee._id,
      role,
    );
    if (!updated) {
      throw AppError.conflict("That user is already a collaborator on this board");
    }

    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "collaborator.added",
      message: `${actor.name} added ${invitee.name} as ${role}`,
      meta: { collaboratorId: invitee._id.toString(), email: invitee.email, role },
    });

    return this.getDetailed(board._id.toString(), "owner");
  },

  async updateCollaboratorRole(
    board: BoardDocument,
    userId: string,
    role: CollaboratorRole,
    actor: UserDocument,
  ): Promise<BoardWithRole> {
    const previous = board.collaborators.find(
      (c) => c.user.toString() === userId,
    )?.role;

    const updated = await boardRepository.updateCollaboratorRole(
      board._id,
      userId,
      role,
    );
    if (!updated) {
      throw AppError.notFound("That user is not a collaborator on this board");
    }

    // A silent permission change is the one you most want a record of.
    if (previous !== role) {
      const target = await userRepository.findById(userId);
      await activityService.log({
        boardId: board._id,
        user: actor._id,
        action: "collaborator.role_changed",
        message: `${actor.name} changed ${target?.name ?? "a collaborator"} to ${role}`,
        meta: { userId, from: previous ?? null, to: role },
      });
    }

    return this.getDetailed(board._id.toString(), "owner");
  },

  async removeCollaborator(
    board: BoardDocument,
    actor: UserDocument,
    userId: string,
  ): Promise<BoardWithRole> {
    const isCollaborator = board.collaborators.some(
      (c) => c.user.toString() === userId,
    );
    if (!isCollaborator) {
      throw AppError.notFound("That user is not a collaborator on this board");
    }

    await boardRepository.removeCollaborator(board._id, userId);

    // Someone who can no longer see the board must not stay assigned to its
    // tasks - the frontend would render an unresolvable assignee.
    await taskRepository.unassignUserFromBoard(board._id, userId);

    const removed = await userRepository.findById(userId);

    await activityService.log({
      boardId: board._id,
      user: actor._id,
      action: "collaborator.removed",
      message: `${actor.name} removed ${removed?.name ?? "a collaborator"}`,
      meta: { collaboratorId: userId, email: removed?.email },
    });

    return this.getDetailed(board._id.toString(), "owner");
  },
};

export default boardService;
