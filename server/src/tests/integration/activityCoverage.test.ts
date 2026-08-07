import request from "supertest";
import app from "../../app";
import { User } from "../../models/User";
import { registerAndLogin, type AuthedUser } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
});

/**
 * Every mutation worth remembering should leave a trace. These actions wrote
 * nothing at all before: a board could be renamed, or a column deleted with all
 * its tasks, and the feed would show no sign of it.
 */
async function actions(actor: AuthedUser, boardId: string): Promise<string[]> {
  const res = await request(app)
    .get(`/boards/${boardId}/activity`)
    .query({ page: 1, limit: 100 })
    .set(actor.authHeader)
    .expect(200);

  return res.body.data.activity.map((entry: { action: string }) => entry.action);
}

async function messageFor(
  actor: AuthedUser,
  boardId: string,
  action: string,
): Promise<string> {
  const res = await request(app)
    .get(`/boards/${boardId}/activity`)
    .query({ page: 1, limit: 100 })
    .set(actor.authHeader)
    .expect(200);

  const entry = res.body.data.activity.find(
    (e: { action: string }) => e.action === action,
  );
  return entry?.message ?? "";
}

async function createBoard(actor: AuthedUser, title = "Activity Board") {
  const res = await request(app)
    .post("/boards")
    .set(actor.authHeader)
    .send({ title })
    .expect(201);
  return res.body.data.board.id as string;
}

async function createColumn(actor: AuthedUser, boardId: string, name: string) {
  const res = await request(app)
    .post(`/boards/${boardId}/columns`)
    .set(actor.authHeader)
    .send({ name })
    .expect(201);
  return res.body.data.column.id as string;
}

describe("activity coverage", () => {
  it("records creating a column, with its name", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const boardId = await createBoard(owner);
    await createColumn(owner, boardId, "Backlog");

    expect(await actions(owner, boardId)).toContain("column.created");
    expect(await messageFor(owner, boardId, "column.created")).toBe(
      'Ada added the column "Backlog"',
    );
  });

  it("records renaming a column with both names", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const boardId = await createBoard(owner);
    const columnId = await createColumn(owner, boardId, "Todo");

    await request(app)
      .put(`/columns/${columnId}`)
      .set(owner.authHeader)
      .send({ name: "In Progress" })
      .expect(200);

    // "renamed a column" on its own tells a reader nothing.
    expect(await messageFor(owner, boardId, "column.renamed")).toBe(
      'Ada renamed "Todo" to "In Progress"',
    );
  });

  it("records deleting a column and how many tasks went with it", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const boardId = await createBoard(owner);
    const columnId = await createColumn(owner, boardId, "Doomed");
    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({ boardId, columnId, title: "Goes too" })
      .expect(201);

    await request(app)
      .delete(`/columns/${columnId}`)
      .set(owner.authHeader)
      .expect(200);

    // The task count is the part that is not obvious after the fact.
    expect(await messageFor(owner, boardId, "column.deleted")).toBe(
      'Ada deleted "Doomed" and its 1 task',
    );
  });

  it("says 'empty' when a deleted column had no tasks", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const boardId = await createBoard(owner);
    const columnId = await createColumn(owner, boardId, "Nothing");

    await request(app)
      .delete(`/columns/${columnId}`)
      .set(owner.authHeader)
      .expect(200);

    expect(await messageFor(owner, boardId, "column.deleted")).toContain("empty");
  });

  it("records reordering columns", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createBoard(owner);
    const first = await createColumn(owner, boardId, "One");
    const second = await createColumn(owner, boardId, "Two");

    await request(app)
      .patch(`/boards/${boardId}/columns/reorder`)
      .set(owner.authHeader)
      .send({ orderedColumnIds: [second, first] })
      .expect(200);

    expect(await actions(owner, boardId)).toContain("columns.reordered");
  });

  it("records renaming the board", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const boardId = await createBoard(owner, "Old Name");

    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "New Name" })
      .expect(200);

    expect(await messageFor(owner, boardId, "board.renamed")).toBe(
      'Ada renamed the board to "New Name"',
    );
  });

  it("does not claim a rename when only the team changed", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createBoard(owner, "Same Name");

    const org = await request(app)
      .post("/orgs")
      .set(owner.authHeader)
      .send({ name: "A Team" })
      .expect(201);

    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "Same Name", organizationId: org.body.data.organization.id })
      .expect(200);

    const recorded = await actions(owner, boardId);
    expect(recorded).not.toContain("board.renamed");
    expect(recorded).toContain("board.attached");
  });

  it("records a collaborator's role changing, naming both people", async () => {
    const owner = await registerAndLogin(app, { name: "Ada" });
    const mate = await registerAndLogin(app, { name: "Grace" });
    const boardId = await createBoard(owner);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: mate.user.email, role: "editor" })
      .expect(201);

    await request(app)
      .patch(`/boards/${boardId}/collaborators/${mate.user.id}`)
      .set(owner.authHeader)
      .send({ role: "viewer" })
      .expect(200);

    // A silent permission change is the one you most want a record of.
    expect(await messageFor(owner, boardId, "collaborator.role_changed")).toBe(
      "Ada changed Grace to viewer",
    );
  });

  it("does not log a role change that changed nothing", async () => {
    const owner = await registerAndLogin(app);
    const mate = await registerAndLogin(app);
    const boardId = await createBoard(owner);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: mate.user.email, role: "editor" })
      .expect(201);

    await request(app)
      .patch(`/boards/${boardId}/collaborators/${mate.user.id}`)
      .set(owner.authHeader)
      .send({ role: "editor" })
      .expect(200);

    expect(await actions(owner, boardId)).not.toContain("collaborator.role_changed");
  });
});
