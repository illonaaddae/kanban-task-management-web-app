import { Types } from "mongoose";
import { ActivityLog } from "../../models/ActivityLog";
import { Column } from "../../models/Column";
import { Task } from "../../models/Task";
import { User } from "../../models/User";
import { activityRepository } from "../../repositories/activityRepository";
import { boardRepository } from "../../repositories/boardRepository";
import { columnRepository } from "../../repositories/columnRepository";
import { taskRepository } from "../../repositories/taskRepository";
import { userRepository } from "../../repositories/userRepository";

beforeAll(async () => {
  await User.init();
});

/** Positions of a column's tasks in stored order, for contiguity assertions. */
async function positionsIn(columnId: Types.ObjectId): Promise<number[]> {
  const tasks = await taskRepository.findByColumnId(columnId);
  return tasks.map((t) => t.position);
}

describe("userRepository", () => {
  const input = { name: "Illona", email: "Illona@Example.com", password: "supersecret123" };

  it("finds by email case-insensitively and omits the password by default", async () => {
    await userRepository.create(input);

    const found = await userRepository.findByEmail("ILLONA@example.COM");
    expect(found).not.toBeNull();
    expect(found!.password).toBeUndefined();
  });

  it("returns the hash only via findByEmailWithPassword", async () => {
    await userRepository.create(input);

    const withPassword = await userRepository.findByEmailWithPassword(input.email);
    expect(withPassword!.password).toMatch(/^\$2[aby]\$12\$/);
    await expect(withPassword!.comparePassword("supersecret123")).resolves.toBe(true);
  });

  it("reports existence by email", async () => {
    await userRepository.create(input);

    await expect(userRepository.existsByEmail("illona@example.com")).resolves.toBe(true);
    await expect(userRepository.existsByEmail("nobody@example.com")).resolves.toBe(false);
  });

  it("setPassword re-hashes through the save hook", async () => {
    const user = await userRepository.create(input);
    const before = (await userRepository.findByIdWithPassword(user._id))!.password;

    await userRepository.setPassword(user._id, "a-brand-new-password");

    const after = (await userRepository.findByIdWithPassword(user._id))!.password;
    expect(after).not.toBe(before);
    expect(after).toMatch(/^\$2[aby]\$12\$/);

    const reloaded = (await userRepository.findByIdWithPassword(user._id))!;
    await expect(reloaded.comparePassword("a-brand-new-password")).resolves.toBe(true);
  });

  it("incrementTokenVersion bumps the counter", async () => {
    const user = await userRepository.create(input);

    const updated = await userRepository.incrementTokenVersion(user._id);
    expect(updated!.tokenVersion).toBe(1);
  });

  it("links a Google identity to an existing account", async () => {
    const user = await userRepository.create(input);

    const linked = await userRepository.linkGoogleId(user._id, "google-sub-1");
    expect(linked!.googleId).toBe("google-sub-1");

    const byGoogle = await userRepository.findByGoogleId("google-sub-1");
    expect(byGoogle!._id.toString()).toBe(user._id.toString());
  });
});

describe("boardRepository", () => {
  async function seedUsers() {
    const [owner, collaborator, outsider] = await Promise.all([
      userRepository.create({ name: "Owner", email: "owner@example.com", password: "supersecret123" }),
      userRepository.create({ name: "Collab", email: "collab@example.com", password: "supersecret123" }),
      userRepository.create({ name: "Outsider", email: "out@example.com", password: "supersecret123" }),
    ]);
    return { owner, collaborator, outsider };
  }

  describe("findForUser", () => {
    it("returns boards the user owns and boards they collaborate on", async () => {
      const { owner, collaborator } = await seedUsers();

      const owned = await boardRepository.create({ title: "Owned", owner: owner._id });
      const shared = await boardRepository.create({ title: "Shared", owner: owner._id });
      await boardRepository.addCollaborator(shared._id, collaborator._id, "editor");

      const forCollaborator = await boardRepository.findForUser(collaborator._id);
      expect(forCollaborator.map((b) => b.title)).toEqual(["Shared"]);

      const forOwner = await boardRepository.findForUser(owner._id);
      expect(forOwner.map((b) => b.title).sort()).toEqual(["Owned", "Shared"]);
      expect(forOwner.map((b) => b.id)).toContain(owned.id);
    });

    it("excludes boards the user has no relationship with", async () => {
      const { owner, outsider } = await seedUsers();
      await boardRepository.create({ title: "Private", owner: owner._id });

      await expect(boardRepository.findForUser(outsider._id)).resolves.toEqual([]);
    });
  });

  describe("collaborators", () => {
    it("adds a collaborator with the given role", async () => {
      const { owner, collaborator } = await seedUsers();
      const board = await boardRepository.create({ title: "B", owner: owner._id });

      const updated = await boardRepository.addCollaborator(board._id, collaborator._id, "viewer");

      expect(updated!.collaborators).toHaveLength(1);
      expect(updated!.collaborators[0]!.role).toBe("viewer");
    });

    it("returns null when the user is already a collaborator, so the service can answer 409", async () => {
      const { owner, collaborator } = await seedUsers();
      const board = await boardRepository.create({ title: "B", owner: owner._id });
      await boardRepository.addCollaborator(board._id, collaborator._id, "editor");

      const second = await boardRepository.addCollaborator(board._id, collaborator._id, "viewer");
      expect(second).toBeNull();
    });

    it("updates and removes a collaborator", async () => {
      const { owner, collaborator } = await seedUsers();
      const board = await boardRepository.create({ title: "B", owner: owner._id });
      await boardRepository.addCollaborator(board._id, collaborator._id, "viewer");

      const promoted = await boardRepository.updateCollaboratorRole(board._id, collaborator._id, "editor");
      expect(promoted!.collaborators[0]!.role).toBe("editor");

      const removed = await boardRepository.removeCollaborator(board._id, collaborator._id);
      expect(removed!.collaborators).toEqual([]);
      await expect(boardRepository.hasCollaborator(board._id, collaborator._id)).resolves.toBe(false);
    });
  });
});

describe("columnRepository", () => {
  const boardId = new Types.ObjectId();

  describe("maxPosition", () => {
    it("returns -1 for a board with no columns so callers append at 0", async () => {
      await expect(columnRepository.maxPosition(boardId)).resolves.toBe(-1);
    });

    it("returns the highest position in use", async () => {
      await columnRepository.create({ title: "Todo", boardId, position: 0 });
      await columnRepository.create({ title: "Doing", boardId, position: 1 });
      await columnRepository.create({ title: "Done", boardId, position: 2 });

      await expect(columnRepository.maxPosition(boardId)).resolves.toBe(2);
    });

    it("is scoped to the board", async () => {
      await columnRepository.create({ title: "Other", boardId: new Types.ObjectId(), position: 9 });
      await expect(columnRepository.maxPosition(boardId)).resolves.toBe(-1);
    });
  });

  it("returns columns in position order", async () => {
    await columnRepository.create({ title: "Done", boardId, position: 2 });
    await columnRepository.create({ title: "Todo", boardId, position: 0 });
    await columnRepository.create({ title: "Doing", boardId, position: 1 });

    const columns = await columnRepository.findByBoardId(boardId);
    expect(columns.map((c) => c.title)).toEqual(["Todo", "Doing", "Done"]);
  });

  it("reorder rewrites positions to match the given order", async () => {
    const todo = await columnRepository.create({ title: "Todo", boardId, position: 0 });
    const doing = await columnRepository.create({ title: "Doing", boardId, position: 1 });
    const done = await columnRepository.create({ title: "Done", boardId, position: 2 });

    await columnRepository.reorder(boardId, [done._id, todo._id, doing._id]);

    const columns = await columnRepository.findByBoardId(boardId);
    expect(columns.map((c) => c.title)).toEqual(["Done", "Todo", "Doing"]);
    expect(columns.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it("reorder ignores ids from another board", async () => {
    const mine = await columnRepository.create({ title: "Mine", boardId, position: 0 });
    const theirs = await columnRepository.create({
      title: "Theirs",
      boardId: new Types.ObjectId(),
      position: 0,
    });

    const modified = await columnRepository.reorder(boardId, [theirs._id, mine._id]);

    expect(modified).toBe(1);
    const untouched = await columnRepository.findById(theirs._id);
    expect(untouched!.position).toBe(0);
  });

  it("deleteByBoardId removes only that board's columns", async () => {
    const otherBoard = new Types.ObjectId();
    await columnRepository.create({ title: "A", boardId, position: 0 });
    await columnRepository.create({ title: "B", boardId, position: 1 });
    await columnRepository.create({ title: "Keep", boardId: otherBoard, position: 0 });

    await expect(columnRepository.deleteByBoardId(boardId)).resolves.toBe(2);
    await expect(Column.countDocuments({ boardId })).resolves.toBe(0);
    await expect(Column.countDocuments({ boardId: otherBoard })).resolves.toBe(1);
  });
});

describe("taskRepository", () => {
  const boardId = new Types.ObjectId();
  const columnId = new Types.ObjectId();

  async function seedTasks(count: number, column = columnId, status = "Todo") {
    const created = [];
    for (let i = 0; i < count; i += 1) {
      created.push(
        // eslint-disable-next-line no-await-in-loop
        await taskRepository.create({
          title: `Task ${i}`,
          boardId,
          columnId: column,
          position: i,
          status,
        }),
      );
    }
    return created;
  }

  describe("maxPosition", () => {
    it("returns -1 for an empty column", async () => {
      await expect(taskRepository.maxPosition(columnId)).resolves.toBe(-1);
    });

    it("returns the highest position in the column", async () => {
      await seedTasks(3);
      await expect(taskRepository.maxPosition(columnId)).resolves.toBe(2);
    });
  });

  describe("bulkShiftPositions", () => {
    it("opens a slot by incrementing tasks at or after the given position", async () => {
      await seedTasks(3); // positions 0,1,2

      const modified = await taskRepository.bulkShiftPositions(columnId, 1, 1);

      expect(modified).toBe(2);
      await expect(positionsIn(columnId)).resolves.toEqual([0, 2, 3]);
    });

    it("closes a gap by decrementing tasks after the vacated slot", async () => {
      await seedTasks(4); // positions 0,1,2,3

      // Task at position 1 left the column: shift everything after it down.
      const modified = await taskRepository.bulkShiftPositions(columnId, 2, -1);

      expect(modified).toBe(2);
      await expect(positionsIn(columnId)).resolves.toEqual([0, 1, 1, 2]);
    });

    it("is scoped to the column", async () => {
      const otherColumn = new Types.ObjectId();
      await seedTasks(2);
      await seedTasks(2, otherColumn, "Doing");

      await taskRepository.bulkShiftPositions(columnId, 0, 5);

      await expect(positionsIn(columnId)).resolves.toEqual([5, 6]);
      await expect(positionsIn(otherColumn)).resolves.toEqual([0, 1]);
    });

    it("is a no-op when delta is 0", async () => {
      await seedTasks(3);
      await expect(taskRepository.bulkShiftPositions(columnId, 0, 0)).resolves.toBe(0);
      await expect(positionsIn(columnId)).resolves.toEqual([0, 1, 2]);
    });
  });

  it("updateStatusByColumnId keeps the denormalised status aligned on rename", async () => {
    await seedTasks(3);

    const modified = await taskRepository.updateStatusByColumnId(columnId, "In Progress");

    expect(modified).toBe(3);
    const tasks = await taskRepository.findByColumnId(columnId);
    expect(tasks.every((t) => t.status === "In Progress")).toBe(true);
  });

  it("unassignUserFromBoard clears the assignee across the board", async () => {
    const assignee = new Types.ObjectId();
    await taskRepository.create({
      title: "Assigned",
      boardId,
      columnId,
      position: 0,
      status: "Todo",
      assignedTo: assignee,
    });

    const modified = await taskRepository.unassignUserFromBoard(boardId, assignee);

    expect(modified).toBe(1);
    const [task] = await taskRepository.findByColumnId(columnId);
    expect(task!.assignedTo).toBeNull();
  });

  describe("cascade helpers", () => {
    it("deleteByColumnId removes only that column's tasks", async () => {
      const otherColumn = new Types.ObjectId();
      await seedTasks(2);
      await seedTasks(3, otherColumn, "Doing");

      await expect(taskRepository.deleteByColumnId(columnId)).resolves.toBe(2);
      await expect(Task.countDocuments({ columnId })).resolves.toBe(0);
      await expect(Task.countDocuments({ columnId: otherColumn })).resolves.toBe(3);
    });

    it("deleteByBoardId removes only that board's tasks", async () => {
      const otherBoard = new Types.ObjectId();
      await seedTasks(2);
      await taskRepository.create({
        title: "Elsewhere",
        boardId: otherBoard,
        columnId: new Types.ObjectId(),
        position: 0,
        status: "Todo",
      });

      await expect(taskRepository.deleteByBoardId(boardId)).resolves.toBe(2);
      await expect(Task.countDocuments({ boardId })).resolves.toBe(0);
      await expect(Task.countDocuments({ boardId: otherBoard })).resolves.toBe(1);
    });
  });
});

describe("activityRepository", () => {
  const boardId = new Types.ObjectId();

  async function seedEntries(count: number, board = boardId) {
    for (let i = 0; i < count; i += 1) {
      const user = await userRepository.create({
        name: `User ${i}`,
        email: `activity-${board.toString()}-${i}@example.com`,
        password: "supersecret123",
      });
      await activityRepository.create({
        boardId: board,
        user: user._id,
        action: "task.moved",
        message: `Move ${i}`,
      });
    }
  }

  it("paginates newest-first with metadata", async () => {
    await seedEntries(5);

    const page1 = await activityRepository.findByBoardId(boardId, { page: 1, limit: 2 });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(2);
    expect(page1.totalPages).toBe(3);

    const page3 = await activityRepository.findByBoardId(boardId, { page: 3, limit: 2 });
    expect(page3.items).toHaveLength(1);
  });

  it("populates the acting user", async () => {
    await seedEntries(1);

    const { items } = await activityRepository.findByBoardId(boardId, { page: 1, limit: 10 });
    const populated = items[0]!.user as unknown as { name: string; email: string };

    expect(populated.name).toBe("User 0");
    expect(populated.email).toBe("activity-" + boardId.toString() + "-0@example.com");
  });

  it("reports one page when there is no activity", async () => {
    const empty = await activityRepository.findByBoardId(boardId, { page: 1, limit: 20 });

    expect(empty.items).toEqual([]);
    expect(empty.total).toBe(0);
    expect(empty.totalPages).toBe(1);
  });

  it("deleteByBoardId removes only that board's entries", async () => {
    const otherBoard = new Types.ObjectId();
    await seedEntries(2);
    await seedEntries(1, otherBoard);

    await expect(activityRepository.deleteByBoardId(boardId)).resolves.toBe(2);
    await expect(ActivityLog.countDocuments({ boardId })).resolves.toBe(0);
    await expect(ActivityLog.countDocuments({ boardId: otherBoard })).resolves.toBe(1);
  });
});
