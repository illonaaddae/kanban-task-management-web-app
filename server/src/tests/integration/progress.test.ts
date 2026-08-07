import request from "supertest";
import app from "../../app";
import { Invitation } from "../../models/Invitation";
import { Task } from "../../models/Task";
import { User } from "../../models/User";
import { emailService } from "../../services/emailService";
import { registerAndLogin, type AuthedUser } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
  await Invitation.init();
});

beforeEach(() => {
  jest
    .spyOn(emailService, "sendOrganizationInvitation")
    .mockResolvedValue({ delivered: true, id: "email_test" });
});

async function createOrg(actor: AuthedUser, name = "Acme") {
  const res = await request(app)
    .post("/orgs")
    .set(actor.authHeader)
    .send({ name })
    .expect(201);
  return res.body.data.organization as { id: string; name: string };
}

/** Invites a registered user to a team and has them accept. */
async function joinTeam(owner: AuthedUser, orgId: string, member: AuthedUser) {
  const invite = await request(app)
    .post(`/orgs/${orgId}/invitations`)
    .set(owner.authHeader)
    .send({ email: member.user.email })
    .expect(201);

  const token = invite.body.data.acceptUrl.split("/invite/")[1];
  await request(app)
    .post(`/invitations/${token}/accept`)
    .set(member.authHeader)
    .expect(200);
}

async function createBoard(actor: AuthedUser, title = "Progress Board") {
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

async function createTask(
  actor: AuthedUser,
  boardId: string,
  columnId: string,
  body: Record<string, unknown>,
) {
  const res = await request(app)
    .post("/tasks")
    .set(actor.authHeader)
    .send({ boardId, columnId, ...body })
    .expect(201);
  return res.body.data.task.id as string;
}

describe("GET /orgs/teammates", () => {
  it("returns everyone from every shared team, once each", async () => {
    const owner = await registerAndLogin(app, { name: "Owner Person" });
    const mate = await registerAndLogin(app, { name: "Shared Mate" });
    const first = await createOrg(owner, "First Team");
    const second = await createOrg(owner, "Second Team");

    await joinTeam(owner, first.id, mate);
    await joinTeam(owner, second.id, mate);

    const res = await request(app)
      .get("/orgs/teammates")
      .set(owner.authHeader)
      .expect(200);

    // One row despite two shared teams, with both named.
    expect(res.body.data.teammates).toHaveLength(1);
    expect(res.body.data.teammates[0]).toMatchObject({
      id: mate.user.id,
      name: "Shared Mate",
      email: mate.user.email,
    });
    expect(res.body.data.teammates[0].teams.sort()).toEqual([
      "First Team",
      "Second Team",
    ]);
  });

  it("includes the team owner when seen from a member's side", async () => {
    const owner = await registerAndLogin(app, { name: "Team Owner" });
    const member = await registerAndLogin(app);
    const org = await createOrg(owner);
    await joinTeam(owner, org.id, member);

    const res = await request(app)
      .get("/orgs/teammates")
      .set(member.authHeader)
      .expect(200);

    // The owner is not a members entry, so they are easy to miss entirely.
    expect(res.body.data.teammates.map((t: { id: string }) => t.id)).toEqual([
      owner.user.id,
    ]);
  });

  it("never lists the caller", async () => {
    const owner = await registerAndLogin(app);
    await createOrg(owner);

    const res = await request(app)
      .get("/orgs/teammates")
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.teammates).toEqual([]);
  });

  it("does not leak people from teams the caller is not in", async () => {
    const outsider = await registerAndLogin(app);
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const org = await createOrg(owner, "Private Team");
    await joinTeam(owner, org.id, member);

    const res = await request(app)
      .get("/orgs/teammates")
      .set(outsider.authHeader)
      .expect(200);

    expect(res.body.data.teammates).toEqual([]);
  });

  it("requires a token", async () => {
    await request(app).get("/orgs/teammates").expect(401);
  });

  it("is not parsed as an organization id", async () => {
    const user = await registerAndLogin(app);

    // Declared before "/:id"; otherwise this would be a 400 on the ObjectId
    // param schema.
    await request(app)
      .get("/orgs/teammates")
      .set(user.authHeader)
      .expect(200);
  });
});

describe("GET /boards/:id/progress", () => {
  it("counts assigned, completed, overdue and subtasks per person", async () => {
    const owner = await registerAndLogin(app, { name: "Owner Person" });
    const mate = await registerAndLogin(app, { name: "Mate Person" });
    const boardId = await createBoard(owner);
    const todo = await createColumn(owner, boardId, "Todo");
    const done = await createColumn(owner, boardId, "Done");

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: mate.user.email, role: "editor" })
      .expect(201);

    // Mate: one done, one overdue, one plain - plus subtasks.
    await createTask(owner, boardId, done, {
      title: "Shipped",
      assignedTo: mate.user.id,
      subtasks: [{ title: "a", isCompleted: true }, { title: "b", isCompleted: true }],
    });
    await createTask(owner, boardId, todo, {
      title: "Late",
      assignedTo: mate.user.id,
      dueDate: "2020-01-01T00:00:00.000Z",
      subtasks: [{ title: "c", isCompleted: false }],
    });
    await createTask(owner, boardId, todo, {
      title: "Pending",
      assignedTo: mate.user.id,
    });
    // Owner: one task, not done.
    await createTask(owner, boardId, todo, { title: "Mine", assignedTo: owner.user.id });
    // Nobody.
    await createTask(owner, boardId, todo, { title: "Loose" });

    const res = await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(owner.authHeader)
      .expect(200);

    const { progress } = res.body.data;

    // "Done" is the last column by position, not a name match.
    expect(progress.doneColumn).toBe("Done");
    expect(progress.totals).toMatchObject({
      tasks: 5,
      completed: 1,
      overdue: 1,
      unassigned: 1,
      completionRate: 20,
    });

    const byId = Object.fromEntries(
      progress.members.map((m: { userId: string | null }) => [m.userId ?? "none", m]),
    );

    expect(byId[mate.user.id]).toMatchObject({
      name: "Mate Person",
      assigned: 3,
      completed: 1,
      overdue: 1,
      completionRate: 33,
      subtasks: { total: 3, completed: 2 },
    });
    // The owner is not a collaborator entry, so they are the easy one to lose.
    expect(byId[owner.user.id]).toMatchObject({
      name: "Owner Person",
      assigned: 1,
      completed: 0,
    });
    expect(byId.none).toMatchObject({ name: "Unassigned", assigned: 1 });
  });

  it("lists a member with nothing assigned rather than hiding them", async () => {
    const owner = await registerAndLogin(app);
    const idle = await registerAndLogin(app, { name: "Idle Person" });
    const boardId = await createBoard(owner);
    await createColumn(owner, boardId, "Todo");

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: idle.user.email, role: "viewer" })
      .expect(201);

    const res = await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(owner.authHeader)
      .expect(200);

    const row = res.body.data.progress.members.find(
      (m: { userId: string | null }) => m.userId === idle.user.id,
    );
    // "No tasks" is a fact about them, not a reason to omit the row.
    expect(row).toMatchObject({ assigned: 0, completionRate: 0 });
  });

  it("does not count a task in the last column as overdue", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createBoard(owner);
    await createColumn(owner, boardId, "Todo");
    const done = await createColumn(owner, boardId, "Done");

    await createTask(owner, boardId, done, {
      title: "Late but finished",
      assignedTo: owner.user.id,
      dueDate: "2020-01-01T00:00:00.000Z",
    });

    const res = await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.progress.totals).toMatchObject({
      completed: 1,
      overdue: 0,
    });
  });

  it("reports zeroes for an empty board without dividing by zero", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createBoard(owner);

    const res = await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.progress.doneColumn).toBeNull();
    expect(res.body.data.progress.totals).toMatchObject({
      tasks: 0,
      completed: 0,
      completionRate: 0,
    });
  });

  it("still accounts for a task whose assignee left the board", async () => {
    const owner = await registerAndLogin(app);
    const leaver = await registerAndLogin(app);
    const boardId = await createBoard(owner);
    const todo = await createColumn(owner, boardId, "Todo");

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: leaver.user.email, role: "editor" })
      .expect(201);
    await createTask(owner, boardId, todo, { title: "Theirs", assignedTo: leaver.user.id });

    // Removing a collaborator clears them from tasks, so write the orphan
    // directly - the state a manual database edit or an older record leaves.
    await request(app)
      .delete(`/boards/${boardId}/collaborators/${leaver.user.id}`)
      .set(owner.authHeader)
      .expect(200);
    await Task.updateOne({ title: "Theirs" }, { assignedTo: leaver.user.id });

    const res = await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(owner.authHeader)
      .expect(200);

    const { progress } = res.body.data;
    // Dropping the row would make the per-person numbers disagree with the board.
    expect(progress.totals.tasks).toBe(1);
    expect(
      progress.members.find((m: { name: string }) => m.name === "Former member"),
    ).toMatchObject({ assigned: 1 });
  });

  it("lets a viewer read it - nothing here is hidden from them anyway", async () => {
    const owner = await registerAndLogin(app);
    const viewer = await registerAndLogin(app);
    const boardId = await createBoard(owner);
    await createColumn(owner, boardId, "Todo");

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: viewer.user.email, role: "viewer" })
      .expect(201);

    await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(viewer.authHeader)
      .expect(200);
  });

  it("403s somebody with no access to the board", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const boardId = await createBoard(owner);

    await request(app)
      .get(`/boards/${boardId}/progress`)
      .set(stranger.authHeader)
      .expect(403);
  });

  it("401s without a token", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createBoard(owner);

    await request(app).get(`/boards/${boardId}/progress`).expect(401);
  });
});
