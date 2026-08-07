import { Types } from "mongoose";
import request from "supertest";
import app from "../../app";
import { Column } from "../../models/Column";
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
}

async function seedBoard(): Promise<Scenario> {
  const owner = await registerAndLogin(app);
  const editor = await registerAndLogin(app);
  const viewer = await registerAndLogin(app);
  const admin = await registerAndLogin(app, { role: "admin" });
  const outsider = await registerAndLogin(app);

  const board = await request(app)
    .post("/boards")
    .set(owner.authHeader)
    .send({ title: "Platform Launch" })
    .expect(201);

  const boardId = board.body.data.board.id as string;

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

  return { owner, editor, viewer, admin, outsider, boardId };
}

async function addColumn(actor: AuthedUser, boardId: string, title: string) {
  const res = await request(app)
    .post(`/boards/${boardId}/columns`)
    .set(actor.authHeader)
    .send({ title })
    .expect(201);

  return res.body.data.column as { id: string; title: string; name: string; position: number };
}

async function positionsOf(boardId: string) {
  const columns = await Column.find({ boardId }).sort({ position: 1 });
  return columns.map((c) => ({ title: c.title, position: c.position }));
}

describe("POST /boards/:id/columns", () => {
  it("appends at maxPosition + 1, starting from 0", async () => {
    const { owner, boardId } = await seedBoard();

    const todo = await addColumn(owner, boardId, "Todo");
    const doing = await addColumn(owner, boardId, "Doing");
    const done = await addColumn(owner, boardId, "Done");

    expect([todo.position, doing.position, done.position]).toEqual([0, 1, 2]);
  });

  it("returns the column with name mirroring title", async () => {
    const { owner, boardId } = await seedBoard();

    const column = await addColumn(owner, boardId, "Todo");

    expect(column).toMatchObject({ title: "Todo", name: "Todo", position: 0 });
    expect(column.id).toEqual(expect.any(String));
  });

  it("accepts `name` as an alias for `title`", async () => {
    const { owner, boardId } = await seedBoard();

    const res = await request(app)
      .post(`/boards/${boardId}/columns`)
      .set(owner.authHeader)
      .send({ name: "From The Frontend" })
      .expect(201);

    expect(res.body.data.column.title).toBe("From The Frontend");
  });

  it("scopes positions to the board", async () => {
    const { owner, boardId } = await seedBoard();
    const second = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Second" })
      .expect(201);

    await addColumn(owner, boardId, "A");
    await addColumn(owner, boardId, "B");
    const fresh = await addColumn(owner, second.body.data.board.id, "First Here");

    expect(fresh.position).toBe(0);
  });

  describe("RBAC - editor and above", () => {
    it.each(["owner", "editor", "admin"] as const)("%s can create", async (role) => {
      const scenario = await seedBoard();

      await request(app)
        .post(`/boards/${scenario.boardId}/columns`)
        .set(scenario[role].authHeader)
        .send({ title: "Todo" })
        .expect(201);
    });

    it("viewer gets 403", async () => {
      const { viewer, boardId } = await seedBoard();

      const res = await request(app)
        .post(`/boards/${boardId}/columns`)
        .set(viewer.authHeader)
        .send({ title: "Todo" })
        .expect(403);

      expect(res.body.message).toMatch(/requires editor access/i);
      await expect(Column.countDocuments({ boardId })).resolves.toBe(0);
    });

    it("outsider gets 403", async () => {
      const { outsider, boardId } = await seedBoard();

      await request(app)
        .post(`/boards/${boardId}/columns`)
        .set(outsider.authHeader)
        .send({ title: "Todo" })
        .expect(403);
    });

    it("missing board is 404", async () => {
      const { owner } = await seedBoard();

      await request(app)
        .post(`/boards/${MISSING_ID}/columns`)
        .set(owner.authHeader)
        .send({ title: "Todo" })
        .expect(404);
    });

    it("no token is 401", async () => {
      const { boardId } = await seedBoard();

      await request(app).post(`/boards/${boardId}/columns`).send({ title: "Todo" }).expect(401);
    });
  });

  it("rejects a missing title", async () => {
    const { owner, boardId } = await seedBoard();

    const res = await request(app)
      .post(`/boards/${boardId}/columns`)
      .set(owner.authHeader)
      .send({})
      .expect(400);

    expect(res.body.details).toEqual([
      { field: "title", message: "Column title is required" },
    ]);
  });
});

describe("PUT /columns/:id", () => {
  it("renames the column", async () => {
    const { owner, boardId } = await seedBoard();
    const column = await addColumn(owner, boardId, "Todo");

    const res = await request(app)
      .put(`/columns/${column.id}`)
      .set(owner.authHeader)
      .send({ title: "In Progress" })
      .expect(200);

    expect(res.body.data.column).toMatchObject({
      title: "In Progress",
      name: "In Progress",
      position: 0,
    });
  });

  it("rewrites status on every task in the column", async () => {
    const { owner, boardId } = await seedBoard();
    const column = await addColumn(owner, boardId, "Todo");

    await Task.create([
      { title: "T1", boardId, columnId: column.id, position: 0, status: "Todo" },
      { title: "T2", boardId, columnId: column.id, position: 1, status: "Todo" },
    ]);

    const res = await request(app)
      .put(`/columns/${column.id}`)
      .set(owner.authHeader)
      .send({ title: "In Progress" })
      .expect(200);

    expect(res.body.data.tasksUpdated).toBe(2);

    const tasks = await Task.find({ columnId: column.id });
    expect(tasks.every((t) => t.status === "In Progress")).toBe(true);
  });

  it("does not touch tasks in a sibling column", async () => {
    const { owner, boardId } = await seedBoard();
    const todo = await addColumn(owner, boardId, "Todo");
    const done = await addColumn(owner, boardId, "Done");

    await Task.create({
      title: "Untouched",
      boardId,
      columnId: done.id,
      position: 0,
      status: "Done",
    });

    await request(app)
      .put(`/columns/${todo.id}`)
      .set(owner.authHeader)
      .send({ title: "Renamed" })
      .expect(200);

    const task = await Task.findOne({ columnId: done.id });
    expect(task!.status).toBe("Done");
  });

  describe("RBAC via the column's board", () => {
    it.each(["owner", "editor", "admin"] as const)("%s can rename", async (role) => {
      const scenario = await seedBoard();
      const column = await addColumn(scenario.owner, scenario.boardId, "Todo");

      await request(app)
        .put(`/columns/${column.id}`)
        .set(scenario[role].authHeader)
        .send({ title: `By ${role}` })
        .expect(200);
    });

    it("viewer gets 403", async () => {
      const scenario = await seedBoard();
      const column = await addColumn(scenario.owner, scenario.boardId, "Todo");

      await request(app)
        .put(`/columns/${column.id}`)
        .set(scenario.viewer.authHeader)
        .send({ title: "Nope" })
        .expect(403);

      const stored = await Column.findById(column.id);
      expect(stored!.title).toBe("Todo");
    });

    it("a column in someone else's board is 403, not 404", async () => {
      const scenario = await seedBoard();
      const column = await addColumn(scenario.owner, scenario.boardId, "Todo");

      const res = await request(app)
        .put(`/columns/${column.id}`)
        .set(scenario.outsider.authHeader)
        .send({ title: "Nope" })
        .expect(403);

      expect(res.body.message).toMatch(/do not have access/i);
    });

    it("a column that does not exist is 404", async () => {
      const { owner } = await seedBoard();

      const res = await request(app)
        .put(`/columns/${MISSING_ID}`)
        .set(owner.authHeader)
        .send({ title: "Nope" })
        .expect(404);

      expect(res.body.message).toBe("Column not found");
    });

    it("a malformed column id is 400", async () => {
      const { owner } = await seedBoard();

      await request(app)
        .put("/columns/not-an-id")
        .set(owner.authHeader)
        .send({ title: "Nope" })
        .expect(400);
    });
  });
});

describe("DELETE /columns/:id", () => {
  it("deletes the column and its tasks", async () => {
    const { owner, boardId } = await seedBoard();
    const column = await addColumn(owner, boardId, "Todo");

    await Task.create([
      { title: "T1", boardId, columnId: column.id, position: 0, status: "Todo" },
      { title: "T2", boardId, columnId: column.id, position: 1, status: "Todo" },
    ]);

    const res = await request(app)
      .delete(`/columns/${column.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted.tasks).toBe(2);
    await expect(Column.countDocuments({ _id: column.id })).resolves.toBe(0);
    await expect(Task.countDocuments({ columnId: column.id })).resolves.toBe(0);
  });

  it("re-compacts the positions of the columns after it", async () => {
    const { owner, boardId } = await seedBoard();
    await addColumn(owner, boardId, "Todo");
    const doing = await addColumn(owner, boardId, "Doing");
    await addColumn(owner, boardId, "Done");
    await addColumn(owner, boardId, "Archive");

    const res = await request(app)
      .delete(`/columns/${doing.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted.columnsShifted).toBe(2);
    await expect(positionsOf(boardId)).resolves.toEqual([
      { title: "Todo", position: 0 },
      { title: "Done", position: 1 },
      { title: "Archive", position: 2 },
    ]);
  });

  it("leaves positions contiguous when the last column goes", async () => {
    const { owner, boardId } = await seedBoard();
    await addColumn(owner, boardId, "Todo");
    const last = await addColumn(owner, boardId, "Done");

    await request(app).delete(`/columns/${last.id}`).set(owner.authHeader).expect(200);

    await expect(positionsOf(boardId)).resolves.toEqual([
      { title: "Todo", position: 0 },
    ]);
  });

  it("does not disturb another board's columns", async () => {
    const { owner, boardId } = await seedBoard();
    const other = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Other" })
      .expect(201);
    const otherId = other.body.data.board.id;

    const first = await addColumn(owner, boardId, "First");
    await addColumn(owner, boardId, "Second");
    await addColumn(owner, otherId, "Elsewhere A");
    await addColumn(owner, otherId, "Elsewhere B");

    await request(app).delete(`/columns/${first.id}`).set(owner.authHeader).expect(200);

    await expect(positionsOf(otherId)).resolves.toEqual([
      { title: "Elsewhere A", position: 0 },
      { title: "Elsewhere B", position: 1 },
    ]);
  });

  it("viewer gets 403", async () => {
    const scenario = await seedBoard();
    const column = await addColumn(scenario.owner, scenario.boardId, "Todo");

    await request(app)
      .delete(`/columns/${column.id}`)
      .set(scenario.viewer.authHeader)
      .expect(403);

    await expect(Column.countDocuments({ _id: column.id })).resolves.toBe(1);
  });

  it("editor can delete", async () => {
    const scenario = await seedBoard();
    const column = await addColumn(scenario.owner, scenario.boardId, "Todo");

    await request(app)
      .delete(`/columns/${column.id}`)
      .set(scenario.editor.authHeader)
      .expect(200);
  });
});

describe("PATCH /boards/:id/columns/reorder", () => {
  async function seedThreeColumns() {
    const scenario = await seedBoard();
    const todo = await addColumn(scenario.owner, scenario.boardId, "Todo");
    const doing = await addColumn(scenario.owner, scenario.boardId, "Doing");
    const done = await addColumn(scenario.owner, scenario.boardId, "Done");

    return { ...scenario, todo, doing, done };
  }

  it("rewrites positions to match the given order", async () => {
    const { owner, boardId, todo, doing, done } = await seedThreeColumns();

    const res = await request(app)
      .patch(`/boards/${boardId}/columns/reorder`)
      .set(owner.authHeader)
      .send({ orderedColumnIds: [done.id, todo.id, doing.id] })
      .expect(200);

    expect(res.body.data.columns.map((c: { name: string }) => c.name)).toEqual([
      "Done",
      "Todo",
      "Doing",
    ]);
    await expect(positionsOf(boardId)).resolves.toEqual([
      { title: "Done", position: 0 },
      { title: "Todo", position: 1 },
      { title: "Doing", position: 2 },
    ]);
  });

  it("survives a round trip back to the original order", async () => {
    const { owner, boardId, todo, doing, done } = await seedThreeColumns();

    await request(app)
      .patch(`/boards/${boardId}/columns/reorder`)
      .set(owner.authHeader)
      .send({ orderedColumnIds: [done.id, doing.id, todo.id] })
      .expect(200);

    await request(app)
      .patch(`/boards/${boardId}/columns/reorder`)
      .set(owner.authHeader)
      .send({ orderedColumnIds: [todo.id, doing.id, done.id] })
      .expect(200);

    await expect(positionsOf(boardId)).resolves.toEqual([
      { title: "Todo", position: 0 },
      { title: "Doing", position: 1 },
      { title: "Done", position: 2 },
    ]);
  });

  describe("the set must match exactly", () => {
    it("rejects a partial list", async () => {
      const { owner, boardId, todo, doing } = await seedThreeColumns();

      const res = await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: [doing.id, todo.id] })
        .expect(400);

      expect(res.body.message).toMatch(/exactly the board's columns/i);
      expect(res.body.details[0].message).toMatch(/Missing column ids/);
    });

    it("rejects an id from another board", async () => {
      const { owner, boardId, todo, doing, done } = await seedThreeColumns();
      const other = await request(app)
        .post("/boards")
        .set(owner.authHeader)
        .send({ title: "Other" })
        .expect(201);
      const foreign = await addColumn(owner, other.body.data.board.id, "Foreign");

      const res = await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: [todo.id, doing.id, done.id, foreign.id] })
        .expect(400);

      expect(res.body.details.some((d: { message: string }) => /do not belong/.test(d.message))).toBe(
        true,
      );
    });

    it("rejects duplicate ids", async () => {
      const { owner, boardId, todo, doing } = await seedThreeColumns();

      const res = await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: [todo.id, todo.id, doing.id] })
        .expect(400);

      expect(res.body.message).toMatch(/duplicate/i);
    });

    it("leaves positions untouched after a rejected reorder", async () => {
      const { owner, boardId, todo, doing } = await seedThreeColumns();

      await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: [doing.id, todo.id] })
        .expect(400);

      await expect(positionsOf(boardId)).resolves.toEqual([
        { title: "Todo", position: 0 },
        { title: "Doing", position: 1 },
        { title: "Done", position: 2 },
      ]);
    });

    it("rejects an empty array", async () => {
      const { owner, boardId } = await seedThreeColumns();

      await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: [] })
        .expect(400);
    });

    it("rejects a malformed id", async () => {
      const { owner, boardId } = await seedThreeColumns();

      const res = await request(app)
        .patch(`/boards/${boardId}/columns/reorder`)
        .set(owner.authHeader)
        .send({ orderedColumnIds: ["nope"] })
        .expect(400);

      expect(res.body.details[0].field).toBe("orderedColumnIds.0");
    });
  });

  it("editor can reorder, viewer cannot", async () => {
    const scenario = await seedThreeColumns();
    const order = [scenario.done.id, scenario.todo.id, scenario.doing.id];

    await request(app)
      .patch(`/boards/${scenario.boardId}/columns/reorder`)
      .set(scenario.viewer.authHeader)
      .send({ orderedColumnIds: order })
      .expect(403);

    await request(app)
      .patch(`/boards/${scenario.boardId}/columns/reorder`)
      .set(scenario.editor.authHeader)
      .send({ orderedColumnIds: order })
      .expect(200);
  });
});

describe("GET /boards/:id/full", () => {
  async function seedPopulatedBoard() {
    const scenario = await seedBoard();
    const { owner, boardId } = scenario;

    const todo = await addColumn(owner, boardId, "Todo");
    const doing = await addColumn(owner, boardId, "Doing");
    const done = await addColumn(owner, boardId, "Done");

    // Inserted out of order on purpose - the endpoint must sort by position.
    await Task.create([
      {
        title: "Second in Todo",
        description: "b",
        boardId,
        columnId: todo.id,
        position: 1,
        status: "Todo",
      },
      {
        title: "First in Todo",
        description: "a",
        boardId,
        columnId: todo.id,
        position: 0,
        status: "Todo",
        subtasks: [
          { title: "Sign up page", isCompleted: true },
          { title: "Sign in page", isCompleted: false },
        ],
      },
      {
        title: "In Doing",
        boardId,
        columnId: doing.id,
        position: 0,
        status: "Doing",
        assignedTo: scenario.editor.user.id,
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
      },
    ]);

    return { ...scenario, todo, doing, done };
  }

  it("emits the nested shape with name, myRole, collaborators and columns", async () => {
    const { owner, boardId } = await seedPopulatedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.status).toBe("success");
    expect(Object.keys(res.body.data).sort()).toEqual([
      "collaborators",
      "columns",
      "id",
      "myRole",
      "name",
      // null on a personal board; a team id makes it reachable by that team.
      "organizationId",
    ]);
    expect(res.body.data.id).toBe(boardId);
    expect(res.body.data.name).toBe("Platform Launch");
    expect(res.body.data.myRole).toBe("owner");
  });

  it("populates collaborators with id, name and email only", async () => {
    const { owner, editor, boardId } = await seedPopulatedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    const entry = res.body.data.collaborators.find(
      (c: { user: { id: string } }) => c.user.id === editor.user.id,
    );

    expect(Object.keys(entry).sort()).toEqual(["role", "user"]);
    expect(Object.keys(entry.user).sort()).toEqual(["email", "id", "name"]);
    expect(entry).toMatchObject({
      role: "editor",
      user: { id: editor.user.id, email: editor.user.email },
    });
  });

  it("returns columns sorted by position with the exact column shape", async () => {
    const { owner, boardId } = await seedPopulatedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    const { columns } = res.body.data;
    expect(columns.map((c: { name: string }) => c.name)).toEqual(["Todo", "Doing", "Done"]);
    expect(columns.map((c: { position: number }) => c.position)).toEqual([0, 1, 2]);
    expect(Object.keys(columns[0]).sort()).toEqual(["id", "name", "position", "tasks"]);
  });

  it("groups tasks under their column and sorts them by position", async () => {
    const { owner, boardId } = await seedPopulatedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    const [todo, doing, done] = res.body.data.columns;

    expect(todo.tasks.map((t: { title: string }) => t.title)).toEqual([
      "First in Todo",
      "Second in Todo",
    ]);
    expect(doing.tasks).toHaveLength(1);
    expect(done.tasks).toEqual([]);
  });

  it("emits the exact task shape", async () => {
    const { owner, editor, boardId } = await seedPopulatedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    const first = res.body.data.columns[0].tasks[0];
    expect(Object.keys(first).sort()).toEqual([
      "assignedTo",
      "description",
      "dueDate",
      "id",
      "position",
      "status",
      "subtasks",
      "title",
    ]);
    expect(first).toMatchObject({
      title: "First in Todo",
      description: "a",
      status: "Todo",
      position: 0,
      assignedTo: null,
      dueDate: null,
      subtasks: [
        { title: "Sign up page", isCompleted: true },
        { title: "Sign in page", isCompleted: false },
      ],
    });

    const assigned = res.body.data.columns[1].tasks[0];
    expect(assigned.assignedTo).toBe(editor.user.id);
    expect(assigned.dueDate).toBe("2026-08-15T00:00:00.000Z");
  });

  it("groups by columnId, not by status, when two columns share a name", async () => {
    const { owner, boardId } = await seedBoard();
    const first = await addColumn(owner, boardId, "Todo");
    const second = await addColumn(owner, boardId, "Todo");

    await Task.create([
      { title: "In first", boardId, columnId: first.id, position: 0, status: "Todo" },
      { title: "In second", boardId, columnId: second.id, position: 0, status: "Todo" },
    ]);

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.columns[0].tasks.map((t: { title: string }) => t.title)).toEqual([
      "In first",
    ]);
    expect(res.body.data.columns[1].tasks.map((t: { title: string }) => t.title)).toEqual([
      "In second",
    ]);
  });

  it("still returns the task when its status drifted from the column title", async () => {
    const { owner, boardId } = await seedBoard();
    const column = await addColumn(owner, boardId, "Todo");
    await Task.create({
      title: "Stale status",
      boardId,
      columnId: column.id,
      position: 0,
      status: "Something Else",
    });

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.columns[0].tasks).toHaveLength(1);
  });

  it("returns an empty columns array for a fresh board", async () => {
    const { owner, boardId } = await seedBoard();

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.columns).toEqual([]);
  });

  describe("RBAC - viewer and above", () => {
    it.each(["owner", "editor", "viewer", "admin"] as const)("%s can read", async (role) => {
      const scenario = await seedPopulatedBoard();

      await request(app)
        .get(`/boards/${scenario.boardId}/full`)
        .set(scenario[role].authHeader)
        .expect(200);
    });

    it("reports the caller's own myRole", async () => {
      const { viewer, boardId } = await seedPopulatedBoard();

      const res = await request(app)
        .get(`/boards/${boardId}/full`)
        .set(viewer.authHeader)
        .expect(200);

      expect(res.body.data.myRole).toBe("viewer");
    });

    it("outsider gets 403", async () => {
      const { outsider, boardId } = await seedPopulatedBoard();

      await request(app).get(`/boards/${boardId}/full`).set(outsider.authHeader).expect(403);
    });

    it("missing board is 404", async () => {
      const { owner } = await seedBoard();

      await request(app).get(`/boards/${MISSING_ID}/full`).set(owner.authHeader).expect(404);
    });

    it("no token is 401", async () => {
      const { boardId } = await seedBoard();

      await request(app).get(`/boards/${boardId}/full`).expect(401);
    });
  });

  it("reflects a rename across both the column and its tasks", async () => {
    const { owner, boardId, todo } = await seedPopulatedBoard();

    await request(app)
      .put(`/columns/${todo.id}`)
      .set(owner.authHeader)
      .send({ title: "Backlog" })
      .expect(200);

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.columns[0].name).toBe("Backlog");
    expect(
      res.body.data.columns[0].tasks.every((t: { status: string }) => t.status === "Backlog"),
    ).toBe(true);
  });
});
