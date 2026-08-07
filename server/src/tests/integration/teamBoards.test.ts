import { Types } from "mongoose";
import request from "supertest";
import app from "../../app";
import { Board } from "../../models/Board";
import { Invitation } from "../../models/Invitation";
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

const MISSING_ID = new Types.ObjectId().toString();

async function createOrg(actor: AuthedUser, name = "Acme") {
  const res = await request(app)
    .post("/orgs")
    .set(actor.authHeader)
    .send({ name })
    .expect(201);
  return res.body.data.organization.id as string;
}

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

async function createTeamBoard(actor: AuthedUser, orgId: string, title = "Team Board") {
  const res = await request(app)
    .post("/boards")
    .set(actor.authHeader)
    .send({ title, organizationId: orgId })
    .expect(201);
  return res.body.data.board.id as string;
}

async function createColumn(actor: AuthedUser, boardId: string, name = "Todo") {
  const res = await request(app)
    .post(`/boards/${boardId}/columns`)
    .set(actor.authHeader)
    .send({ name })
    .expect(201);
  return res.body.data.column.id as string;
}

describe("POST /boards with a team", () => {
  it("stores the team and reports the board as usual", async () => {
    const owner = await registerAndLogin(app);
    const orgId = await createOrg(owner);

    const boardId = await createTeamBoard(owner, orgId);

    const stored = await Board.findById(boardId);
    expect(stored?.organization?.toString()).toBe(orgId);
  });

  it("403s a team the caller is not in - otherwise this publishes into someone else's team", async () => {
    const outsider = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const orgId = await createOrg(stranger, "Not Yours");

    await request(app)
      .post("/boards")
      .set(outsider.authHeader)
      .send({ title: "Sneaky", organizationId: orgId })
      .expect(403);
  });

  it("404s an unknown team", async () => {
    const owner = await registerAndLogin(app);

    await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Board", organizationId: MISSING_ID })
      .expect(404);
  });

  it("400s a malformed team id", async () => {
    const owner = await registerAndLogin(app);

    await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Board", organizationId: "nope" })
      .expect(400);
  });

  it("still creates a personal board when no team is named", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Just Mine" })
      .expect(201);

    const stored = await Board.findById(res.body.data.board.id);
    expect(stored?.organization).toBeUndefined();
  });
});

describe("team board access", () => {
  it("lets a team member read and edit without being a collaborator", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);

    const boardId = await createTeamBoard(owner, orgId);
    const columnId = await createColumn(owner, boardId);

    // Never invited to this board specifically - membership is the grant.
    const read = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);
    expect(read.body.data.myRole).toBe("editor");

    await request(app)
      .post("/tasks")
      .set(member.authHeader)
      .send({ boardId, columnId, title: "Member's task" })
      .expect(201);
  });

  it("shows team boards in the member's board list", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    const res = await request(app)
      .get("/boards")
      .set(member.authHeader)
      .expect(200);

    const found = res.body.data.boards.find((b: { id: string }) => b.id === boardId);
    expect(found).toBeDefined();
    // The list's own role resolution has to agree with boardAccess, or the UI
    // would render a read-only board the API would happily let them edit.
    expect(found.myRole).toBe("editor");
  });

  it("403s somebody outside the team", async () => {
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(outsider.authHeader)
      .expect(403);
  });

  it("stops granting access once the member leaves the team", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);

    await request(app)
      .delete(`/orgs/${orgId}/members/${member.user.id}`)
      .set(member.authHeader)
      .expect(200);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(403);
  });

  it("keeps the board owner as owner, not editor", async () => {
    const owner = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    const boardId = await createTeamBoard(owner, orgId);

    const res = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.myRole).toBe("owner");
    // Owner-only actions must still work for them.
    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "Renamed" })
      .expect(200);
  });

  it("an explicit viewer entry overrides the team's editor default", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);
    const columnId = await createColumn(owner, boardId);

    // The reason collaborator entries are checked before team membership: without
    // that order there would be no way to hold one person read-only.
    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: member.user.email, role: "viewer" })
      .expect(201);

    const read = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);
    expect(read.body.data.myRole).toBe("viewer");

    await request(app)
      .post("/tasks")
      .set(member.authHeader)
      .send({ boardId, columnId, title: "Blocked" })
      .expect(403);
  });

  it("does not let a team member do owner-only things", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    // Editor, not owner: renaming, sharing and deleting stay with the creator.
    await request(app)
      .put(`/boards/${boardId}`)
      .set(member.authHeader)
      .send({ title: "Hijacked" })
      .expect(403);

    await request(app)
      .delete(`/boards/${boardId}`)
      .set(member.authHeader)
      .expect(403);
  });

  it("leaves a personal board untouched by team membership", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);

    const personal = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Private" })
      .expect(201);

    // Being on the same team is not access to everything the other person owns.
    await request(app)
      .get(`/boards/${personal.body.data.board.id}/full`)
      .set(member.authHeader)
      .expect(403);
  });
});

describe("GET /boards/:id on a team board", () => {
  it("reports team members separately from collaborators", async () => {
    const owner = await registerAndLogin(app, { name: "Owner Person" });
    const teammate = await registerAndLogin(app, { name: "Team Person" });
    const invited = await registerAndLogin(app, { name: "Invited Person" });
    const orgId = await createOrg(owner, "Shape Team");
    await joinTeam(owner, orgId, teammate);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: invited.user.email, role: "viewer" })
      .expect(201);

    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set(owner.authHeader)
      .expect(200);

    const { board } = res.body.data;

    // A teammate has no collaborator entry, so merging the two would make the
    // share modal offer a "remove" that silently does nothing.
    expect(board.collaborators).toHaveLength(1);
    expect(board.teamMembers).toHaveLength(1);
    expect(board.teamMembers[0]).toMatchObject({
      id: teammate.user.id,
      name: "Team Person",
      role: "editor",
    });
    expect(board.organizationName).toBe("Shape Team");
  });

  it("does not list the owner or an existing collaborator twice", async () => {
    const owner = await registerAndLogin(app);
    const both = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, both);
    const boardId = await createTeamBoard(owner, orgId);

    // In the team *and* explicitly invited: their real role is the collaborator
    // one, and appearing twice would show contradictory rows.
    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: both.user.email, role: "viewer" })
      .expect(201);

    const res = await request(app)
      .get(`/boards/${boardId}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.board.teamMembers).toEqual([]);
    expect(res.body.data.board.collaborators).toHaveLength(1);
  });

  it("omits the field entirely on a personal board", async () => {
    const owner = await registerAndLogin(app);
    const created = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Personal" })
      .expect(201);

    const res = await request(app)
      .get(`/boards/${created.body.data.board.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.board.teamMembers).toBeUndefined();
  });
});

describe("PUT /boards/:id moving a board between teams", () => {
  it("attaches a personal board to a team the owner is in", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);

    const created = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Was Personal" })
      .expect(201);
    const boardId = created.body.data.board.id;

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(403);

    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "Now Shared", organizationId: orgId })
      .expect(200);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);
  });

  it("detaches it again with null, revoking team access", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "Team Board", organizationId: null })
      .expect(200);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(403);
  });

  it("leaves the team alone when the key is omitted", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    // A plain rename must not silently make a team board personal.
    await request(app)
      .put(`/boards/${boardId}`)
      .set(owner.authHeader)
      .send({ title: "Just Renamed" })
      .expect(200);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);
  });

  it("403s moving a board into a team the owner is not in", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const foreignOrg = await createOrg(stranger, "Theirs");

    const created = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Mine" })
      .expect(201);

    await request(app)
      .put(`/boards/${created.body.data.board.id}`)
      .set(owner.authHeader)
      .send({ title: "Mine", organizationId: foreignOrg })
      .expect(403);
  });
});

describe("DELETE /orgs/:id with boards in it", () => {
  it("keeps the boards but makes them personal again", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);

    const res = await request(app)
      .delete(`/orgs/${orgId}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted).toMatchObject({ boardsDetached: 1 });

    // The board survives: a team is a grouping of people, and the work outlives
    // it. Leaving `organization` set would point it at a team that is gone.
    const stored = await Board.findById(boardId);
    expect(stored).not.toBeNull();
    expect(stored?.organization).toBeUndefined();

    // Its owner keeps it...
    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);

    // ...and whoever reached it only through the team no longer can, which is the
    // point of deleting the team.
    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(403);
  });

  it("leaves an explicit collaborator's access alone", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: member.user.email, role: "viewer" })
      .expect(201);

    await request(app).delete(`/orgs/${orgId}`).set(owner.authHeader).expect(200);

    // Their access came from the board, not the team, so it survives.
    await request(app)
      .get(`/boards/${boardId}/full`)
      .set(member.authHeader)
      .expect(200);
  });

  it("403s a member trying to delete the team", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);

    await request(app).delete(`/orgs/${orgId}`).set(member.authHeader).expect(403);
  });
});

describe("GET /tasks/mine", () => {
  it("returns tasks assigned on a team board without a per-board invite", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app, { name: "Member Person" });
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId, "Sprint");
    const todo = await createColumn(owner, boardId, "Todo");
    await createColumn(owner, boardId, "Done");

    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({
        boardId,
        columnId: todo,
        title: "Do the thing",
        assignedTo: member.user.id,
        dueDate: "2020-01-01T00:00:00.000Z",
        subtasks: [{ title: "step", isCompleted: false }],
      })
      .expect(201);

    const res = await request(app)
      .get("/tasks/mine")
      .set(member.authHeader)
      .expect(200);

    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0]).toMatchObject({
      title: "Do the thing",
      isOverdue: true,
      isDone: false,
      board: { id: boardId, name: "Sprint", organizationId: orgId },
      column: { name: "Todo" },
      subtasks: { total: 1, completed: 0 },
    });
  });

  it("marks a task in the last column as done and not overdue", async () => {
    const owner = await registerAndLogin(app);
    const boardId = await createTeamBoard(owner, await createOrg(owner), "Solo");
    await createColumn(owner, boardId, "Todo");
    const done = await createColumn(owner, boardId, "Done");

    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({
        boardId,
        columnId: done,
        title: "Finished late",
        assignedTo: owner.user.id,
        dueDate: "2020-01-01T00:00:00.000Z",
      })
      .expect(201);

    const res = await request(app)
      .get("/tasks/mine")
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.tasks[0]).toMatchObject({ isDone: true, isOverdue: false });
  });

  it("excludes tasks assigned to somebody else", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);
    const boardId = await createTeamBoard(owner, orgId);
    const todo = await createColumn(owner, boardId);

    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({ boardId, columnId: todo, title: "Owner's", assignedTo: owner.user.id })
      .expect(201);

    const res = await request(app)
      .get("/tasks/mine")
      .set(member.authHeader)
      .expect(200);

    expect(res.body.data.tasks).toEqual([]);
  });

  it("is not parsed as a task id, and needs a token", async () => {
    await request(app).get("/tasks/mine").expect(401);
  });
});

describe("GET /orgs/:id/analytics", () => {
  it("rolls up every board in the team", async () => {
    const owner = await registerAndLogin(app, { name: "Owner Person" });
    const member = await registerAndLogin(app, { name: "Member Person" });
    const orgId = await createOrg(owner, "Analytics Team");
    await joinTeam(owner, orgId, member);

    const first = await createTeamBoard(owner, orgId, "Board One");
    const firstTodo = await createColumn(owner, first, "Todo");
    const firstDone = await createColumn(owner, first, "Done");
    const second = await createTeamBoard(owner, orgId, "Board Two");
    const secondTodo = await createColumn(owner, second, "Todo");
    // Two columns, so "done" is the second one. A one-column board has no done
    // column at all - see the two-column rule in progressService.
    await createColumn(owner, second, "Done");

    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({ boardId: first, columnId: firstDone, title: "Done one", assignedTo: member.user.id })
      .expect(201);
    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({ boardId: first, columnId: firstTodo, title: "Open one", assignedTo: member.user.id })
      .expect(201);
    await request(app)
      .post("/tasks")
      .set(owner.authHeader)
      .send({ boardId: second, columnId: secondTodo, title: "Unowned" })
      .expect(201);

    const res = await request(app)
      .get(`/orgs/${orgId}/analytics`)
      .set(owner.authHeader)
      .expect(200);

    const { analytics } = res.body.data;
    expect(analytics.boards).toBe(2);
    expect(analytics.totals).toMatchObject({
      tasks: 3,
      completed: 1,
      unassigned: 1,
      completionRate: 33,
    });

    const memberRow = analytics.members.find(
      (m: { userId: string | null }) => m.userId === member.user.id,
    );
    expect(memberRow).toMatchObject({ assigned: 2, completed: 1, completionRate: 50 });

    // Busiest board first.
    expect(analytics.perBoard[0]).toMatchObject({ name: "Board One", tasks: 2 });
  });

  it("403s a plain member - it spans boards they may not open", async () => {
    const owner = await registerAndLogin(app);
    const member = await registerAndLogin(app);
    const orgId = await createOrg(owner);
    await joinTeam(owner, orgId, member);

    await request(app)
      .get(`/orgs/${orgId}/analytics`)
      .set(member.authHeader)
      .expect(403);
  });

  it("403s somebody outside the team entirely", async () => {
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app);
    const orgId = await createOrg(owner);

    await request(app)
      .get(`/orgs/${orgId}/analytics`)
      .set(outsider.authHeader)
      .expect(403);
  });

  it("reports zeroes for a team with no boards", async () => {
    const owner = await registerAndLogin(app);
    const orgId = await createOrg(owner);

    const res = await request(app)
      .get(`/orgs/${orgId}/analytics`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.analytics).toMatchObject({
      boards: 0,
      totals: { tasks: 0, completed: 0, completionRate: 0 },
    });
  });
});
