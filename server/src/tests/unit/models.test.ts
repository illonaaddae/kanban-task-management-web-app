import { Types } from "mongoose";
import { ActivityLog } from "../../models/ActivityLog";
import { Board } from "../../models/Board";
import { Column } from "../../models/Column";
import { Task } from "../../models/Task";
import { User } from "../../models/User";

beforeAll(async () => {
  // Build the unique/sparse indexes before asserting on them — autoIndex is
  // asynchronous and the DB is dropped between test files.
  await Promise.all([User.init(), Board.init(), Column.init(), Task.init(), ActivityLog.init()]);
});

const validUser = {
  name: "Illona",
  email: "Illona@Example.COM",
  password: "supersecret123",
};

describe("User model", () => {
  describe("password hashing", () => {
    it("hashes the password on create with cost 12", async () => {
      const created = await User.create(validUser);
      const user = await User.findById(created._id).select("+password");

      expect(user!.password).toBeDefined();
      expect(user!.password).not.toBe(validUser.password);
      expect(user!.password).toMatch(/^\$2[aby]\$12\$/);
    });

    it("does not re-hash when an unrelated field changes", async () => {
      const created = await User.create(validUser);
      const before = (await User.findById(created._id).select("+password"))!.password;

      const user = (await User.findById(created._id).select("+password"))!;
      user.name = "Renamed";
      await user.save();

      const after = (await User.findById(created._id).select("+password"))!.password;
      expect(after).toBe(before);
    });

    it("re-hashes when the password actually changes", async () => {
      const created = await User.create(validUser);
      const before = (await User.findById(created._id).select("+password"))!.password;

      const user = (await User.findById(created._id).select("+password"))!;
      user.password = "a-different-password";
      await user.save();

      const after = (await User.findById(created._id).select("+password"))!.password;
      expect(after).not.toBe(before);
      expect(after).toMatch(/^\$2[aby]\$12\$/);
    });
  });

  describe("comparePassword", () => {
    it("accepts the correct password and rejects a wrong one", async () => {
      const created = await User.create(validUser);
      const user = (await User.findById(created._id).select("+password"))!;

      await expect(user.comparePassword("supersecret123")).resolves.toBe(true);
      await expect(user.comparePassword("wrong-password")).resolves.toBe(false);
    });

    it("fails closed when the document was loaded without the password", async () => {
      const created = await User.create(validUser);
      const user = (await User.findById(created._id))!; // no .select("+password")

      await expect(user.comparePassword("supersecret123")).resolves.toBe(false);
    });
  });

  describe("serialisation", () => {
    it("exposes id, hides _id, __v, password and tokenVersion", async () => {
      const user = await User.create(validUser);
      const json = user.toJSON() as Record<string, unknown>;

      expect(json.id).toBe(user._id.toString());
      expect(json).not.toHaveProperty("_id");
      expect(json).not.toHaveProperty("__v");
      expect(json).not.toHaveProperty("password");
      expect(json).not.toHaveProperty("tokenVersion");
      expect(json.email).toBe("illona@example.com");
    });

    it("keeps tokenVersion readable on the document itself", async () => {
      const user = await User.create(validUser);
      expect(user.tokenVersion).toBe(0);
    });
  });

  describe("validation and defaults", () => {
    it("applies role, themePreference and tokenVersion defaults", async () => {
      const user = await User.create(validUser);

      expect(user.role).toBe("editor");
      expect(user.themePreference).toBe("light");
      expect(user.tokenVersion).toBe(0);
    });

    it("lowercases the email", async () => {
      const user = await User.create(validUser);
      expect(user.email).toBe("illona@example.com");
    });

    it("requires a password when there is no googleId", async () => {
      await expect(
        User.create({ name: "No Password", email: "np@example.com" }),
      ).rejects.toThrow(/Password is required/);
    });

    it("allows a Google account with no password", async () => {
      const user = await User.create({
        name: "Google User",
        email: "google@example.com",
        googleId: "google-oauth-sub-123",
      });

      expect(user.password).toBeUndefined();
      expect(user.googleId).toBe("google-oauth-sub-123");
    });

    it("rejects a password shorter than 8 characters", async () => {
      await expect(
        User.create({ ...validUser, email: "short@example.com", password: "short" }),
      ).rejects.toThrow(/at least 8 characters/);
    });

    it("rejects an invalid role", async () => {
      await expect(
        User.create({ ...validUser, email: "role@example.com", role: "superuser" as never }),
      ).rejects.toThrow(/Role must be one of/);
    });

    it("rejects a duplicate email", async () => {
      await User.create(validUser);
      await expect(
        User.create({ ...validUser, email: "illona@example.com" }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("allows many users without a googleId (sparse index)", async () => {
      await User.create(validUser);
      await User.create({ ...validUser, email: "second@example.com" });
      await User.create({ ...validUser, email: "third@example.com" });

      await expect(User.countDocuments()).resolves.toBe(3);
    });

    it("still rejects a duplicate googleId", async () => {
      await User.create({ ...validUser, googleId: "dup-google-id" });
      await expect(
        User.create({ ...validUser, email: "other@example.com", googleId: "dup-google-id" }),
      ).rejects.toMatchObject({ code: 11000 });
    });
  });
});

describe("Board model", () => {
  const ownerId = new Types.ObjectId();

  it("mirrors title as name in JSON so the frontend shape is unchanged", async () => {
    const board = await Board.create({ title: "Platform Launch", owner: ownerId });
    const json = board.toJSON() as Record<string, unknown>;

    expect(board.name).toBe("Platform Launch");
    expect(json.name).toBe("Platform Launch");
    expect(json.title).toBe("Platform Launch");
    expect(json.id).toBe(board._id.toString());
    expect(json).not.toHaveProperty("_id");
  });

  it("defaults collaborators to an empty array", async () => {
    const board = await Board.create({ title: "Solo", owner: ownerId });
    expect(board.collaborators).toEqual([]);
  });

  it("stores collaborators without a subdocument _id", async () => {
    const collaboratorId = new Types.ObjectId();
    const board = await Board.create({
      title: "Shared",
      owner: ownerId,
      collaborators: [{ user: collaboratorId, role: "viewer" }],
    });

    const json = board.toJSON() as { collaborators: Record<string, unknown>[] };
    expect(json.collaborators[0]).not.toHaveProperty("_id");
    expect(json.collaborators[0].role).toBe("viewer");
  });

  it("rejects a collaborator role outside the enum", async () => {
    await expect(
      Board.create({
        title: "Bad Role",
        owner: ownerId,
        collaborators: [{ user: new Types.ObjectId(), role: "owner" as never }],
      }),
    ).rejects.toThrow(/editor or viewer/);
  });

  it("requires a title", async () => {
    await expect(Board.create({ owner: ownerId })).rejects.toThrow(
      /Board title is required/,
    );
  });
});

describe("Column model", () => {
  const boardId = new Types.ObjectId();

  it("mirrors title as name and defaults position to 0", async () => {
    const column = await Column.create({ title: "Todo", boardId });

    expect(column.name).toBe("Todo");
    expect(column.position).toBe(0);
    expect((column.toJSON() as Record<string, unknown>).name).toBe("Todo");
  });

  it("rejects a negative position", async () => {
    await expect(
      Column.create({ title: "Bad", boardId, position: -1 }),
    ).rejects.toThrow(/Position cannot be negative/);
  });
});

describe("Task model", () => {
  const base = {
    title: "Build UI for onboarding flow",
    boardId: new Types.ObjectId(),
    columnId: new Types.ObjectId(),
    status: "Todo",
  };

  it("defaults description, subtasks, position, assignedTo and dueDate", async () => {
    const task = await Task.create(base);

    expect(task.description).toBe("");
    expect(task.subtasks).toEqual([]);
    expect(task.position).toBe(0);
    expect(task.assignedTo).toBeNull();
    expect(task.dueDate).toBeNull();
  });

  it("stores subtasks without their own _id and defaults isCompleted", async () => {
    const task = await Task.create({
      ...base,
      subtasks: [{ title: "Sign up page", isCompleted: true }, { title: "Sign in page" }],
    });

    const json = task.toJSON() as { subtasks: Record<string, unknown>[] };
    expect(json.subtasks).toEqual([
      { title: "Sign up page", isCompleted: true },
      { title: "Sign in page", isCompleted: false },
    ]);
  });

  it("accepts an assignee and a due date", async () => {
    const assignee = new Types.ObjectId();
    const due = new Date("2026-08-15T00:00:00.000Z");
    const task = await Task.create({ ...base, assignedTo: assignee, dueDate: due });

    expect(task.assignedTo?.toString()).toBe(assignee.toString());
    expect(task.dueDate).toEqual(due);
  });

  it("requires a status", async () => {
    await expect(
      Task.create({ title: "x", boardId: base.boardId, columnId: base.columnId }),
    ).rejects.toThrow(/status/i);
  });
});

describe("ActivityLog model", () => {
  it("stores the action, human message and arbitrary meta", async () => {
    const entry = await ActivityLog.create({
      boardId: new Types.ObjectId(),
      user: new Types.ObjectId(),
      action: "task.moved",
      message: "Task moved to Done by Illona",
      meta: { from: "Doing", to: "Done", position: 2 },
    });

    expect(entry.action).toBe("task.moved");
    expect(entry.message).toBe("Task moved to Done by Illona");
    expect(entry.meta).toEqual({ from: "Doing", to: "Done", position: 2 });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });
});
