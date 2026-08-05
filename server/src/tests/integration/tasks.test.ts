import { Types } from "mongoose";
import request from "supertest";
import app from "../../app";
import { ActivityLog } from "../../models/ActivityLog";
import { Task } from "../../models/Task";
import { User } from "../../models/User";
import { registerAndLogin, type AuthedUser } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
});

const MISSING_ID = new Types.ObjectId().toString();

interface Scenario {
  owner: AuthedUser;
  editor: AuthedUser;
  viewer: AuthedUser;
  admin: AuthedUser;
  outsider: AuthedUser;
  boardId: string;
  todo: string;
  doing: string;
  done: string;
}

async function seed(): Promise<Scenario> {
  const owner = await registerAndLogin(app);
  const editor = await registerAndLogin(app);
  const viewer = await registerAndLogin(app);
  const admin = await registerAndLogin(app, { role: "admin" });
  const outsider = await registerAndLogin(app);

  const boardRes = await request(app)
    .post("/boards")
    .set(owner.authHeader)
    .send({ title: "Platform Launch" })
    .expect(201);
  const boardId = boardRes.body.data.board.id as string;

  for (const [who, role] of [
    [editor, "editor"],
    [viewer, "viewer"],
  ] as const) {
    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: who.user.email, role })
      .expect(201);
  }

  const columns: string[] = [];
  for (const title of ["Todo", "Doing", "Done"]) {
    const res = await request(app)
      .post(`/boards/${boardId}/columns`)
      .set(owner.authHeader)
      .send({ title })
      .expect(201);
    columns.push(res.body.data.column.id);
  }

  return {
    owner,
    editor,
    viewer,
    admin,
    outsider,
    boardId,
    todo: columns[0]!,
    doing: columns[1]!,
    done: columns[2]!,
  };
}

async function addTask(
  s: Scenario,
  columnId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post("/tasks")
    .set(s.owner.authHeader)
    .send({ boardId: s.boardId, columnId, title, ...extra })
    .expect(201);

  return res.body.data.task as { id: string; position: number; status: string };
}

/** Titles in stored order for a column, plus their positions. */
async function layout(columnId: string) {
  const tasks = await Task.find({ columnId }).sort({ position: 1 });
  return tasks.map((t) => `${t.title}@${t.position}`);
}

describe("POST /tasks", () => {
  it("appends at the end of the column and mirrors the column title as status", async () => {
    const s = await seed();

    const first = await addTask(s, s.todo, "First");
    const second = await addTask(s, s.todo, "Second");

    expect(first).toMatchObject({ position: 0, status: "Todo" });
    expect(second).toMatchObject({ position: 1, status: "Todo" });
  });

  it("positions are per column", async () => {
    const s = await seed();
    await addTask(s, s.todo, "A");
    const other = await addTask(s, s.doing, "B");

    expect(other.position).toBe(0);
    expect(other.status).toBe("Doing");
  });

  it("stores description, subtasks and dueDate", async () => {
    const s = await seed();

    const res = await request(app)
      .post("/tasks")
      .set(s.owner.authHeader)
      .send({
        boardId: s.boardId,
        columnId: s.todo,
        title: "Onboarding flow",
        description: "Build it",
        dueDate: "2026-08-15",
        subtasks: [{ title: "Sign up page", isCompleted: true }, { title: "Sign in page" }],
      })
      .expect(201);

    expect(res.body.data.task).toMatchObject({
      description: "Build it",
      subtasks: [
        { title: "Sign up page", isCompleted: true },
        { title: "Sign in page", isCompleted: false },
      ],
    });
    expect(res.body.data.task.dueDate).toBe("2026-08-15T00:00:00.000Z");
  });

  it("defaults description, subtasks, assignedTo and dueDate", async () => {
    const s = await seed();
    const res = await request(app)
      .post("/tasks")
      .set(s.owner.authHeader)
      .send({ boardId: s.boardId, columnId: s.todo, title: "Bare" })
      .expect(201);

    expect(res.body.data.task).toMatchObject({
      description: "",
      subtasks: [],
      assignedTo: null,
      dueDate: null,
    });
  });

  describe("assignee must be a board member", () => {
    it("accepts the owner", async () => {
      const s = await seed();
      const task = await addTask(s, s.todo, "T", { assignedTo: s.owner.user.id });
      expect(task).toBeTruthy();
    });

    it("accepts a collaborator", async () => {
      const s = await seed();
      const res = await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({ boardId: s.boardId, columnId: s.todo, title: "T", assignedTo: s.viewer.user.id })
        .expect(201);

      expect(res.body.data.task.assignedTo).toBe(s.viewer.user.id);
    });

    it("rejects a non-member with 400 and a details entry", async () => {
      const s = await seed();

      const res = await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({
          boardId: s.boardId,
          columnId: s.todo,
          title: "T",
          assignedTo: s.outsider.user.id,
        })
        .expect(400);

      expect(res.body.message).toMatch(/must be a member of this board/i);
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: "assignedTo" }),
      ]);
      await expect(Task.countDocuments({ boardId: s.boardId })).resolves.toBe(0);
    });

    it("rejects a user that does not exist", async () => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({ boardId: s.boardId, columnId: s.todo, title: "T", assignedTo: MISSING_ID })
        .expect(400);
    });
  });

  describe("column validation", () => {
    it("404 when the column does not exist", async () => {
      const s = await seed();

      const res = await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({ boardId: s.boardId, columnId: MISSING_ID, title: "T" })
        .expect(404);

      expect(res.body.message).toBe("Column not found on this board");
    });

    it("404 — same message — when the column belongs to another board", async () => {
      const s = await seed();
      const other = await seed();

      const res = await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({ boardId: s.boardId, columnId: other.todo, title: "T" })
        .expect(404);

      expect(res.body.message).toBe("Column not found on this board");
    });
  });

  describe("RBAC", () => {
    it.each(["owner", "editor", "admin"] as const)("%s can create", async (role) => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .set(s[role].authHeader)
        .send({ boardId: s.boardId, columnId: s.todo, title: "T" })
        .expect(201);
    });

    it("viewer gets 403", async () => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .set(s.viewer.authHeader)
        .send({ boardId: s.boardId, columnId: s.todo, title: "T" })
        .expect(403);

      await expect(Task.countDocuments({ boardId: s.boardId })).resolves.toBe(0);
    });

    it("outsider gets 403", async () => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .set(s.outsider.authHeader)
        .send({ boardId: s.boardId, columnId: s.todo, title: "T" })
        .expect(403);
    });

    it("missing board is 404", async () => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .set(s.owner.authHeader)
        .send({ boardId: MISSING_ID, columnId: s.todo, title: "T" })
        .expect(404);
    });

    it("no token is 401", async () => {
      const s = await seed();

      await request(app)
        .post("/tasks")
        .send({ boardId: s.boardId, columnId: s.todo, title: "T" })
        .expect(401);
    });
  });

  it("reports every missing required field", async () => {
    const s = await seed();

    const res = await request(app).post("/tasks").set(s.owner.authHeader).send({}).expect(400);
    expect(res.body.details).toHaveLength(3);
  });

  it("logs task.created", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "Logged");

    const entry = await ActivityLog.findOne({ boardId: s.boardId, action: "task.created" });
    expect(entry).not.toBeNull();
    expect(entry!.message).toContain("Logged");
    expect(entry!.meta).toMatchObject({ taskId: task.id, column: "Todo" });
  });

  it("logs task.assigned alongside task.created", async () => {
    const s = await seed();
    await addTask(s, s.todo, "Assigned", { assignedTo: s.editor.user.id });

    const entry = await ActivityLog.findOne({ boardId: s.boardId, action: "task.assigned" });
    expect(entry).not.toBeNull();
    expect(entry!.message).toMatch(/assigned "Assigned" to/);
  });
});

describe("GET /tasks/:id", () => {
  it("returns the task for a viewer", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "Readable");

    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set(s.viewer.authHeader)
      .expect(200);

    expect(res.body.data.task).toMatchObject({ id: task.id, title: "Readable" });
  });

  it("403 for an outsider — a task id is not an existence oracle", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "Private");

    const res = await request(app)
      .get(`/tasks/${task.id}`)
      .set(s.outsider.authHeader)
      .expect(403);

    expect(res.body.message).toMatch(/do not have access/i);
  });

  it("404 for a task that does not exist", async () => {
    const s = await seed();

    const res = await request(app).get(`/tasks/${MISSING_ID}`).set(s.owner.authHeader).expect(404);
    expect(res.body.message).toBe("Task not found");
  });

  it("400 for a malformed id", async () => {
    const s = await seed();
    await request(app).get("/tasks/nope").set(s.owner.authHeader).expect(400);
  });
});

describe("PUT / PATCH /tasks/:id", () => {
  it.each(["put", "patch"] as const)("%s applies a partial update", async (method) => {
    const s = await seed();
    const task = await addTask(s, s.todo, "Original", { description: "keep me" });

    const res = await request(app)
      [method](`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ title: "Renamed" })
      .expect(200);

    expect(res.body.data.task.title).toBe("Renamed");
    // Untouched fields survive.
    expect(res.body.data.task.description).toBe("keep me");
  });

  it("toggles subtasks through the update route", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "With subtasks", {
      subtasks: [{ title: "Sign up page" }, { title: "Sign in page" }],
    });

    const res = await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.editor.authHeader)
      .send({
        subtasks: [
          { title: "Sign up page", isCompleted: true },
          { title: "Sign in page", isCompleted: false },
        ],
      })
      .expect(200);

    expect(res.body.data.task.subtasks).toEqual([
      { title: "Sign up page", isCompleted: true },
      { title: "Sign in page", isCompleted: false },
    ]);
  });

  it("clears the assignee with null and the due date with null", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T", {
      assignedTo: s.editor.user.id,
      dueDate: "2026-08-15",
    });

    const res = await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ assignedTo: null, dueDate: null })
      .expect(200);

    expect(res.body.data.task.assignedTo).toBeNull();
    expect(res.body.data.task.dueDate).toBeNull();
  });

  it("rejects an assignee who is not a board member", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T");

    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ assignedTo: s.outsider.user.id })
      .expect(400);
  });

  describe("fields that belong to the move endpoint", () => {
    it.each(["columnId", "position", "status"] as const)(
      "rejects %s instead of silently ignoring it",
      async (field) => {
        const s = await seed();
        const task = await addTask(s, s.todo, "T");
        const payload: Record<string, unknown> = {
          columnId: s.doing,
          position: 3,
          status: "Doing",
        };

        const res = await request(app)
          .patch(`/tasks/${task.id}`)
          .set(s.owner.authHeader)
          .send({ [field]: payload[field] })
          .expect(400);

        expect(res.body.details[0].message).toMatch(/\/tasks\/:id\/move/);
      },
    );

    it("leaves the task in place after such a rejection", async () => {
      const s = await seed();
      const task = await addTask(s, s.todo, "T");

      await request(app)
        .patch(`/tasks/${task.id}`)
        .set(s.owner.authHeader)
        .send({ columnId: s.doing })
        .expect(400);

      const stored = await Task.findById(task.id);
      expect(stored!.columnId.toString()).toBe(s.todo);
      expect(stored!.status).toBe("Todo");
    });
  });

  it("rejects an empty body", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T");

    const res = await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({})
      .expect(400);

    expect(res.body.details[0].message).toMatch(/at least one field/i);
  });

  it("viewer gets 403, editor succeeds", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T");

    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.viewer.authHeader)
      .send({ title: "Nope" })
      .expect(403);

    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.editor.authHeader)
      .send({ title: "Yes" })
      .expect(200);
  });

  it("logs task.updated, and task.assigned only when the assignee changes", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T");

    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ title: "Retitled" })
      .expect(200);

    await expect(
      ActivityLog.countDocuments({ boardId: s.boardId, action: "task.updated" }),
    ).resolves.toBe(1);
    await expect(
      ActivityLog.countDocuments({ boardId: s.boardId, action: "task.assigned" }),
    ).resolves.toBe(0);

    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ assignedTo: s.editor.user.id })
      .expect(200);

    await expect(
      ActivityLog.countDocuments({ boardId: s.boardId, action: "task.assigned" }),
    ).resolves.toBe(1);

    // Re-sending the same assignee must not log a second assignment.
    await request(app)
      .patch(`/tasks/${task.id}`)
      .set(s.owner.authHeader)
      .send({ assignedTo: s.editor.user.id })
      .expect(200);

    await expect(
      ActivityLog.countDocuments({ boardId: s.boardId, action: "task.assigned" }),
    ).resolves.toBe(1);
  });
});

describe("DELETE /tasks/:id", () => {
  it("deletes the task and re-compacts the column", async () => {
    const s = await seed();
    await addTask(s, s.todo, "A");
    const b = await addTask(s, s.todo, "B");
    await addTask(s, s.todo, "C");
    await addTask(s, s.todo, "D");

    const res = await request(app)
      .delete(`/tasks/${b.id}`)
      .set(s.owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted.tasksShifted).toBe(2);
    await expect(layout(s.todo)).resolves.toEqual(["A@0", "C@1", "D@2"]);
  });

  it("handles deleting the last task", async () => {
    const s = await seed();
    await addTask(s, s.todo, "A");
    const last = await addTask(s, s.todo, "B");

    await request(app).delete(`/tasks/${last.id}`).set(s.owner.authHeader).expect(200);
    await expect(layout(s.todo)).resolves.toEqual(["A@0"]);
  });

  it("does not disturb a sibling column", async () => {
    const s = await seed();
    const a = await addTask(s, s.todo, "A");
    await addTask(s, s.doing, "X");
    await addTask(s, s.doing, "Y");

    await request(app).delete(`/tasks/${a.id}`).set(s.owner.authHeader).expect(200);
    await expect(layout(s.doing)).resolves.toEqual(["X@0", "Y@1"]);
  });

  it("viewer gets 403", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "T");

    await request(app).delete(`/tasks/${task.id}`).set(s.viewer.authHeader).expect(403);
    await expect(Task.countDocuments({ _id: task.id })).resolves.toBe(1);
  });

  it("logs task.deleted", async () => {
    const s = await seed();
    const task = await addTask(s, s.todo, "Doomed");

    await request(app).delete(`/tasks/${task.id}`).set(s.owner.authHeader).expect(200);

    const entry = await ActivityLog.findOne({ boardId: s.boardId, action: "task.deleted" });
    expect(entry!.message).toContain("Doomed");
  });
});

describe("PATCH /tasks/:id/move", () => {
  async function seedFour() {
    const s = await seed();
    const a = await addTask(s, s.todo, "A");
    const b = await addTask(s, s.todo, "B");
    const c = await addTask(s, s.todo, "C");
    const d = await addTask(s, s.todo, "D");
    return { s, a, b, c, d };
  }

  function move(actor: AuthedUser, taskId: string, columnId: string, position: number) {
    return request(app)
      .patch(`/tasks/${taskId}/move`)
      .set(actor.authHeader)
      .send({ columnId, position });
  }

  describe("across columns", () => {
    it("updates columnId, position and status, and compacts both columns", async () => {
      const { s, b } = await seedFour();
      await addTask(s, s.doing, "X");
      await addTask(s, s.doing, "Y");

      const res = await move(s.owner, b.id, s.doing, 1).expect(200);

      expect(res.body.data.task).toMatchObject({ position: 1, status: "Doing" });

      await expect(layout(s.todo)).resolves.toEqual(["A@0", "C@1", "D@2"]);
      await expect(layout(s.doing)).resolves.toEqual(["X@0", "B@1", "Y@2"]);
    });

    it("moves to the head of the target column", async () => {
      const { s, a } = await seedFour();
      await addTask(s, s.doing, "X");

      await move(s.owner, a.id, s.doing, 0).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["B@0", "C@1", "D@2"]);
      await expect(layout(s.doing)).resolves.toEqual(["A@0", "X@1"]);
    });

    it("appends to an empty column", async () => {
      const { s, c } = await seedFour();

      const res = await move(s.owner, c.id, s.done, 0).expect(200);

      expect(res.body.data.task.status).toBe("Done");
      await expect(layout(s.todo)).resolves.toEqual(["A@0", "B@1", "D@2"]);
      await expect(layout(s.done)).resolves.toEqual(["C@0"]);
    });

    it("clamps a position past the end instead of leaving a gap", async () => {
      const { s, a } = await seedFour();
      await addTask(s, s.doing, "X");

      await move(s.owner, a.id, s.doing, 99).expect(200);

      await expect(layout(s.doing)).resolves.toEqual(["X@0", "A@1"]);
    });

    it("survives a round trip back to the source column", async () => {
      const { s, b } = await seedFour();

      await move(s.owner, b.id, s.doing, 0).expect(200);
      await move(s.owner, b.id, s.todo, 1).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["A@0", "B@1", "C@2", "D@3"]);
      await expect(layout(s.doing)).resolves.toEqual([]);
    });
  });

  describe("same-column reorder — the same code path", () => {
    it("moves a task down", async () => {
      const { s, b } = await seedFour();

      await move(s.owner, b.id, s.todo, 2).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["A@0", "C@1", "B@2", "D@3"]);
    });

    it("moves a task up to the head", async () => {
      const { s, c } = await seedFour();

      await move(s.owner, c.id, s.todo, 0).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["C@0", "A@1", "B@2", "D@3"]);
    });

    it("moves the head to the tail", async () => {
      const { s, a } = await seedFour();

      await move(s.owner, a.id, s.todo, 3).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["B@0", "C@1", "D@2", "A@3"]);
    });

    it("moving to its current position is a no-op", async () => {
      const { s, b } = await seedFour();

      await move(s.owner, b.id, s.todo, 1).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["A@0", "B@1", "C@2", "D@3"]);
    });

    it("clamps past the end of its own column", async () => {
      const { s, a } = await seedFour();

      await move(s.owner, a.id, s.todo, 99).expect(200);

      await expect(layout(s.todo)).resolves.toEqual(["B@0", "C@1", "D@2", "A@3"]);
    });

    it("keeps positions contiguous over a long shuffle", async () => {
      const { s, a, b, c, d } = await seedFour();

      await move(s.owner, d.id, s.todo, 0).expect(200);
      await move(s.owner, a.id, s.todo, 3).expect(200);
      await move(s.owner, c.id, s.todo, 1).expect(200);
      await move(s.owner, b.id, s.todo, 2).expect(200);

      const tasks = await Task.find({ columnId: s.todo }).sort({ position: 1 });
      expect(tasks.map((t) => t.position)).toEqual([0, 1, 2, 3]);
    });
  });

  describe("validation and RBAC", () => {
    it("404 when the target column is on another board", async () => {
      const { s, a } = await seedFour();
      const other = await seed();

      const res = await move(s.owner, a.id, other.todo, 0).expect(404);
      expect(res.body.message).toBe("Column not found on this board");
    });

    it("404 when the target column does not exist", async () => {
      const { s, a } = await seedFour();

      await move(s.owner, a.id, MISSING_ID, 0).expect(404);
    });

    it("400 for a negative position", async () => {
      const { s, a } = await seedFour();

      const res = await move(s.owner, a.id, s.todo, -1).expect(400);
      expect(res.body.details).toEqual([
        expect.objectContaining({ field: "position" }),
      ]);
    });

    it("400 for a non-integer position", async () => {
      const { s, a } = await seedFour();

      await request(app)
        .patch(`/tasks/${a.id}/move`)
        .set(s.owner.authHeader)
        .send({ columnId: s.todo, position: 1.5 })
        .expect(400);
    });

    it("400 when columnId is missing", async () => {
      const { s, a } = await seedFour();

      await request(app)
        .patch(`/tasks/${a.id}/move`)
        .set(s.owner.authHeader)
        .send({ position: 0 })
        .expect(400);
    });

    it("viewer gets 403 and nothing moves", async () => {
      const { s, b } = await seedFour();

      await move(s.viewer, b.id, s.doing, 0).expect(403);

      await expect(layout(s.todo)).resolves.toEqual(["A@0", "B@1", "C@2", "D@3"]);
      await expect(layout(s.doing)).resolves.toEqual([]);
    });

    it("editor can move", async () => {
      const { s, b } = await seedFour();

      await move(s.editor, b.id, s.doing, 0).expect(200);
    });

    it("outsider gets 403", async () => {
      const { s, b } = await seedFour();

      await move(s.outsider, b.id, s.doing, 0).expect(403);
    });
  });

  it("logs task.moved with CLAUDE.md's wording", async () => {
    const { s, b } = await seedFour();

    await move(s.owner, b.id, s.doing, 0).expect(200);

    const entry = await ActivityLog.findOne({ boardId: s.boardId, action: "task.moved" });
    expect(entry!.message).toBe(`Task moved to Doing by ${s.owner.user.name}`);
    expect(entry!.meta).toMatchObject({ to: "Doing", columnId: s.doing, position: 0 });
  });

  it("is reflected by GET /boards/:id/full", async () => {
    const { s, b } = await seedFour();

    await move(s.owner, b.id, s.doing, 0).expect(200);

    const res = await request(app)
      .get(`/boards/${s.boardId}/full`)
      .set(s.owner.authHeader)
      .expect(200);

    const [todo, doing] = res.body.data.columns;
    expect(todo.tasks.map((t: { title: string }) => t.title)).toEqual(["A", "C", "D"]);
    expect(doing.tasks.map((t: { title: string }) => t.title)).toEqual(["B"]);
    expect(doing.tasks[0].status).toBe("Doing");
  });
});

describe("GET /boards/:id/activity", () => {
  it("returns newest-first entries with pagination metadata", async () => {
    const s = await seed();
    for (const title of ["A", "B", "C"]) await addTask(s, s.todo, title);

    const res = await request(app)
      .get(`/boards/${s.boardId}/activity`)
      .set(s.owner.authHeader)
      .expect(200);

    // 1 board.created + 2 collaborator.added + 3 task.created
    expect(res.body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 6,
      totalPages: 1,
    });
    expect(res.body.data.activity[0].action).toBe("task.created");
  });

  it("honours page and limit", async () => {
    const s = await seed();
    for (const title of ["A", "B", "C"]) await addTask(s, s.todo, title);

    const page1 = await request(app)
      .get(`/boards/${s.boardId}/activity?page=1&limit=2`)
      .set(s.owner.authHeader)
      .expect(200);

    expect(page1.body.data.activity).toHaveLength(2);
    expect(page1.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 6,
      totalPages: 3,
    });

    const page3 = await request(app)
      .get(`/boards/${s.boardId}/activity?page=3&limit=2`)
      .set(s.owner.authHeader)
      .expect(200);

    expect(page3.body.data.activity).toHaveLength(2);
  });

  it("populates the acting user", async () => {
    const s = await seed();
    await addTask(s, s.todo, "A");

    const res = await request(app)
      .get(`/boards/${s.boardId}/activity`)
      .set(s.owner.authHeader)
      .expect(200);

    expect(res.body.data.activity[0].user).toMatchObject({
      id: s.owner.user.id,
      email: s.owner.user.email,
    });
    expect(res.body.data.activity[0].user).not.toHaveProperty("password");
  });

  it("rejects an out-of-range limit", async () => {
    const s = await seed();

    const res = await request(app)
      .get(`/boards/${s.boardId}/activity?limit=500`)
      .set(s.owner.authHeader)
      .expect(400);

    expect(res.body.details).toEqual([
      expect.objectContaining({ field: "limit" }),
    ]);
  });

  it("viewer can read it, outsider cannot", async () => {
    const s = await seed();

    await request(app)
      .get(`/boards/${s.boardId}/activity`)
      .set(s.viewer.authHeader)
      .expect(200);

    await request(app)
      .get(`/boards/${s.boardId}/activity`)
      .set(s.outsider.authHeader)
      .expect(403);
  });

  it("404 for a board that does not exist", async () => {
    const s = await seed();

    await request(app)
      .get(`/boards/${MISSING_ID}/activity`)
      .set(s.owner.authHeader)
      .expect(404);
  });
});
