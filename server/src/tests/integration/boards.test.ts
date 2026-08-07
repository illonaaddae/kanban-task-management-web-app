import { Types } from "mongoose";
import request from "supertest";
import app from "../../app";
import { ActivityLog } from "../../models/ActivityLog";
import { Board } from "../../models/Board";
import { Column } from "../../models/Column";
import { Task } from "../../models/Task";
import { User } from "../../models/User";
import { registerAndLogin, type AuthedUser } from "../fixtures/auth";

beforeAll(async () => {
  await User.init();
});

const MISSING_ID = new Types.ObjectId().toString();

async function createBoard(actor: AuthedUser, title = "Platform Launch") {
  const res = await request(app)
    .post("/boards")
    .set(actor.authHeader)
    .send({ title })
    .expect(201);

  return res.body.data.board as { id: string; title: string; name: string };
}

async function invite(
  owner: AuthedUser,
  boardId: string,
  invitee: AuthedUser,
  role: "editor" | "viewer",
) {
  await request(app)
    .post(`/boards/${boardId}/collaborators`)
    .set(owner.authHeader)
    .send({ email: invitee.user.email, role })
    .expect(201);
}

describe("POST /boards", () => {
  it("creates the board with the caller as owner", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Platform Launch" })
      .expect(201);

    expect(res.body.data.board).toMatchObject({
      title: "Platform Launch",
      name: "Platform Launch",
      myRole: "owner",
      collaborators: [],
    });

    const stored = await Board.findById(res.body.data.board.id);
    expect(stored!.owner.toString()).toBe(owner.user.id);
  });

  it("accepts `name` as an alias for `title`", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ name: "From The Frontend" })
      .expect(201);

    expect(res.body.data.board.title).toBe("From The Frontend");
    expect(res.body.data.board.name).toBe("From The Frontend");
  });

  it("ignores an owner supplied by the client", async () => {
    const owner = await registerAndLogin(app);
    const someoneElse = await registerAndLogin(app);

    const res = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({ title: "Mine", owner: someoneElse.user.id })
      .expect(201);

    const stored = await Board.findById(res.body.data.board.id);
    expect(stored!.owner.toString()).toBe(owner.user.id);
  });

  it("logs board.created", async () => {
    const owner = await registerAndLogin(app);
    const board = await createBoard(owner);

    const entries = await ActivityLog.find({ boardId: board.id });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.action).toBe("board.created");
    expect(entries[0]!.message).toContain("Platform Launch");
    expect(entries[0]!.user.toString()).toBe(owner.user.id);
  });

  it("rejects a missing title", async () => {
    const owner = await registerAndLogin(app);

    const res = await request(app)
      .post("/boards")
      .set(owner.authHeader)
      .send({})
      .expect(400);

    expect(res.body.details).toEqual([
      { field: "title", message: "Board title is required" },
    ]);
  });

  it("requires authentication", async () => {
    await request(app).post("/boards").send({ title: "Anon" }).expect(401);
  });
});

describe("GET /boards", () => {
  it("returns owned and shared boards with myRole on each", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);

    const owned = await createBoard(owner, "Owned");
    const shared = await createBoard(owner, "Shared");
    await invite(owner, shared.id, collaborator, "viewer");

    const ownerList = await request(app).get("/boards").set(owner.authHeader).expect(200);
    expect(ownerList.body.data.count).toBe(2);
    expect(ownerList.body.data.boards.every((b: { myRole: string }) => b.myRole === "owner")).toBe(true);

    const collabList = await request(app)
      .get("/boards")
      .set(collaborator.authHeader)
      .expect(200);

    expect(collabList.body.data.boards).toHaveLength(1);
    expect(collabList.body.data.boards[0]).toMatchObject({
      id: shared.id,
      name: "Shared",
      myRole: "viewer",
    });
    expect(collabList.body.data.boards.map((b: { id: string }) => b.id)).not.toContain(owned.id);
  });

  it("does not leak other people's boards", async () => {
    const owner = await registerAndLogin(app);
    await createBoard(owner);
    const outsider = await registerAndLogin(app);

    const res = await request(app).get("/boards").set(outsider.authHeader).expect(200);
    expect(res.body.data.boards).toEqual([]);
  });

  it("does not give a platform admin every board in the listing", async () => {
    const owner = await registerAndLogin(app);
    await createBoard(owner);
    const admin = await registerAndLogin(app, { role: "admin" });

    const res = await request(app).get("/boards").set(admin.authHeader).expect(200);
    expect(res.body.data.boards).toEqual([]);
  });
});

describe("boardAccess resolution order", () => {
  it("returns 400 for a malformed id before any lookup", async () => {
    const user = await registerAndLogin(app);

    const res = await request(app).get("/boards/not-an-id").set(user.authHeader).expect(400);
    expect(res.body.details).toEqual([
      { field: "id", message: "Must be a valid id" },
    ]);
  });

  it("returns 404 for a board that does not exist", async () => {
    const user = await registerAndLogin(app);

    const res = await request(app).get(`/boards/${MISSING_ID}`).set(user.authHeader).expect(404);
    expect(res.body.message).toBe("Board not found");
  });

  it("returns 404 - not 403 - even for an owner-only action on a missing board", async () => {
    const user = await registerAndLogin(app);

    await request(app).delete(`/boards/${MISSING_ID}`).set(user.authHeader).expect(404);
  });

  it("returns 403 for a board that exists but is not shared with the caller", async () => {
    const owner = await registerAndLogin(app);
    const board = await createBoard(owner);
    const outsider = await registerAndLogin(app);

    const res = await request(app).get(`/boards/${board.id}`).set(outsider.authHeader).expect(403);
    expect(res.body.message).toMatch(/do not have access/i);
  });

  it("returns 401 - not 403 - with no token", async () => {
    const owner = await registerAndLogin(app);
    const board = await createBoard(owner);

    await request(app).get(`/boards/${board.id}`).expect(401);
  });
});

describe("RBAC matrix", () => {
  interface Actors {
    owner: AuthedUser;
    editor: AuthedUser;
    viewer: AuthedUser;
    admin: AuthedUser;
    outsider: AuthedUser;
    boardId: string;
  }

  async function seedBoardWithEveryRole(): Promise<Actors> {
    const owner = await registerAndLogin(app);
    const editor = await registerAndLogin(app);
    const viewer = await registerAndLogin(app);
    const admin = await registerAndLogin(app, { role: "admin" });
    const outsider = await registerAndLogin(app);

    const board = await createBoard(owner);
    await invite(owner, board.id, editor, "editor");
    await invite(owner, board.id, viewer, "viewer");

    return { owner, editor, viewer, admin, outsider, boardId: board.id };
  }

  describe("view board - viewer, editor, owner and admin all allowed", () => {
    it.each(["owner", "editor", "viewer", "admin"] as const)("%s can read", async (role) => {
      const actors = await seedBoardWithEveryRole();

      const res = await request(app)
        .get(`/boards/${actors.boardId}`)
        .set(actors[role].authHeader)
        .expect(200);

      expect(res.body.data.board.id).toBe(actors.boardId);
    });

    it("reports the caller's own role, not the owner's", async () => {
      const actors = await seedBoardWithEveryRole();

      const asViewer = await request(app)
        .get(`/boards/${actors.boardId}`)
        .set(actors.viewer.authHeader)
        .expect(200);
      expect(asViewer.body.data.board.myRole).toBe("viewer");

      const asEditor = await request(app)
        .get(`/boards/${actors.boardId}`)
        .set(actors.editor.authHeader)
        .expect(200);
      expect(asEditor.body.data.board.myRole).toBe("editor");

      const asAdmin = await request(app)
        .get(`/boards/${actors.boardId}`)
        .set(actors.admin.authHeader)
        .expect(200);
      expect(asAdmin.body.data.board.myRole).toBe("admin");
    });

    it("still refuses an outsider", async () => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .get(`/boards/${actors.boardId}`)
        .set(actors.outsider.authHeader)
        .expect(403);
    });
  });

  describe("rename board - owner and admin only", () => {
    it.each(["owner", "admin"] as const)("%s can rename", async (role) => {
      const actors = await seedBoardWithEveryRole();

      const res = await request(app)
        .put(`/boards/${actors.boardId}`)
        .set(actors[role].authHeader)
        .send({ title: `Renamed by ${role}` })
        .expect(200);

      expect(res.body.data.board.title).toBe(`Renamed by ${role}`);
      expect(res.body.data.board.name).toBe(`Renamed by ${role}`);
    });

    it.each(["editor", "viewer"] as const)("%s gets 403", async (role) => {
      const actors = await seedBoardWithEveryRole();

      const res = await request(app)
        .put(`/boards/${actors.boardId}`)
        .set(actors[role].authHeader)
        .send({ title: "Nope" })
        .expect(403);

      expect(res.body.message).toMatch(/requires owner access/i);
    });

    it("leaves the board untouched after a refused rename", async () => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .put(`/boards/${actors.boardId}`)
        .set(actors.editor.authHeader)
        .send({ title: "Nope" })
        .expect(403);

      const stored = await Board.findById(actors.boardId);
      expect(stored!.title).toBe("Platform Launch");
    });
  });

  describe("delete board - owner and admin only", () => {
    it.each(["editor", "viewer", "outsider"] as const)("%s gets 403 or 404", async (role) => {
      const actors = await seedBoardWithEveryRole();

      const res = await request(app)
        .delete(`/boards/${actors.boardId}`)
        .set(actors[role].authHeader);

      expect(res.status).toBe(403);
      await expect(Board.countDocuments({ _id: actors.boardId })).resolves.toBe(1);
    });

    it("owner can delete", async () => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .delete(`/boards/${actors.boardId}`)
        .set(actors.owner.authHeader)
        .expect(200);

      await expect(Board.countDocuments({ _id: actors.boardId })).resolves.toBe(0);
    });

    it("admin can delete a board they have no relationship with", async () => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .delete(`/boards/${actors.boardId}`)
        .set(actors.admin.authHeader)
        .expect(200);

      await expect(Board.countDocuments({ _id: actors.boardId })).resolves.toBe(0);
    });
  });

  describe("manage collaborators - owner and admin only", () => {
    it.each(["editor", "viewer"] as const)("%s cannot invite", async (role) => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .post(`/boards/${actors.boardId}/collaborators`)
        .set(actors[role].authHeader)
        .send({ email: actors.outsider.user.email, role: "editor" })
        .expect(403);
    });

    it.each(["editor", "viewer"] as const)("%s cannot remove a collaborator", async (role) => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .delete(`/boards/${actors.boardId}/collaborators/${actors.viewer.user.id}`)
        .set(actors[role].authHeader)
        .expect(403);
    });

    it.each(["editor", "viewer"] as const)("%s cannot change a role", async (role) => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .patch(`/boards/${actors.boardId}/collaborators/${actors.viewer.user.id}`)
        .set(actors[role].authHeader)
        .send({ role: "editor" })
        .expect(403);
    });

    it("a viewer cannot promote themselves", async () => {
      const actors = await seedBoardWithEveryRole();

      await request(app)
        .patch(`/boards/${actors.boardId}/collaborators/${actors.viewer.user.id}`)
        .set(actors.viewer.authHeader)
        .send({ role: "editor" })
        .expect(403);

      const stored = await Board.findById(actors.boardId);
      const entry = stored!.collaborators.find(
        (c) => c.user.toString() === actors.viewer.user.id,
      );
      expect(entry!.role).toBe("viewer");
    });
  });
});

describe("DELETE /boards/:id cascade", () => {
  it("removes the board's columns, tasks and activity, and nothing else", async () => {
    const owner = await registerAndLogin(app);
    const board = await createBoard(owner);
    const otherBoard = await createBoard(owner, "Untouched");

    const column = await Column.create({ title: "Todo", boardId: board.id, position: 0 });
    await Task.create({
      title: "T1",
      boardId: board.id,
      columnId: column._id,
      position: 0,
      status: "Todo",
    });
    await Task.create({
      title: "T2",
      boardId: board.id,
      columnId: column._id,
      position: 1,
      status: "Todo",
    });

    const keptColumn = await Column.create({
      title: "Keep",
      boardId: otherBoard.id,
      position: 0,
    });
    await Task.create({
      title: "Kept",
      boardId: otherBoard.id,
      columnId: keptColumn._id,
      position: 0,
      status: "Keep",
    });

    const res = await request(app)
      .delete(`/boards/${board.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.deleted).toEqual({ columns: 1, tasks: 2, activity: 1 });

    await expect(Column.countDocuments({ boardId: board.id })).resolves.toBe(0);
    await expect(Task.countDocuments({ boardId: board.id })).resolves.toBe(0);
    await expect(ActivityLog.countDocuments({ boardId: board.id })).resolves.toBe(0);

    await expect(Column.countDocuments({ boardId: otherBoard.id })).resolves.toBe(1);
    await expect(Task.countDocuments({ boardId: otherBoard.id })).resolves.toBe(1);
  });

  it("makes the board unreachable for its collaborators afterwards", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "editor");

    await request(app).delete(`/boards/${board.id}`).set(owner.authHeader).expect(200);

    await request(app).get(`/boards/${board.id}`).set(collaborator.authHeader).expect(404);

    const list = await request(app).get("/boards").set(collaborator.authHeader).expect(200);
    expect(list.body.data.boards).toEqual([]);
  });
});

describe("POST /boards/:id/collaborators", () => {
  it("adds a collaborator and returns the board with them resolved", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const board = await createBoard(owner);

    const res = await request(app)
      .post(`/boards/${board.id}/collaborators`)
      .set(owner.authHeader)
      .send({ email: invitee.user.email, role: "editor" })
      .expect(201);

    expect(res.body.data.board.collaborators).toHaveLength(1);
    expect(res.body.data.board.collaborators[0]).toMatchObject({
      role: "editor",
      user: { id: invitee.user.id, email: invitee.user.email },
    });
    expect(res.body.data.board.collaborators[0].user).not.toHaveProperty("password");
  });

  it("defaults the role to editor", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const board = await createBoard(owner);

    const res = await request(app)
      .post(`/boards/${board.id}/collaborators`)
      .set(owner.authHeader)
      .send({ email: invitee.user.email })
      .expect(201);

    expect(res.body.data.board.collaborators[0].role).toBe("editor");
  });

  it("matches the invitee's email case-insensitively", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const board = await createBoard(owner);

    await request(app)
      .post(`/boards/${board.id}/collaborators`)
      .set(owner.authHeader)
      .send({ email: invitee.user.email.toUpperCase() })
      .expect(201);
  });

  it("grants the invitee access immediately", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const board = await createBoard(owner);

    await request(app).get(`/boards/${board.id}`).set(invitee.authHeader).expect(403);
    await invite(owner, board.id, invitee, "viewer");
    await request(app).get(`/boards/${board.id}`).set(invitee.authHeader).expect(200);
  });

  it("logs collaborator.added", async () => {
    const owner = await registerAndLogin(app);
    const invitee = await registerAndLogin(app);
    const board = await createBoard(owner);

    await invite(owner, board.id, invitee, "editor");

    const entry = await ActivityLog.findOne({
      boardId: board.id,
      action: "collaborator.added",
    });
    expect(entry).not.toBeNull();
    expect(entry!.meta).toMatchObject({ email: invitee.user.email, role: "editor" });
  });

  describe("rejections", () => {
    it("404 when no account has that email", async () => {
      const owner = await registerAndLogin(app);
      const board = await createBoard(owner);

      const res = await request(app)
        .post(`/boards/${board.id}/collaborators`)
        .set(owner.authHeader)
        .send({ email: "nobody@example.com", role: "editor" })
        .expect(404);

      expect(res.body.message).toMatch(/cannot be invited/i);
    });

    it("409 when the user is already a collaborator", async () => {
      const owner = await registerAndLogin(app);
      const invitee = await registerAndLogin(app);
      const board = await createBoard(owner);
      await invite(owner, board.id, invitee, "editor");

      const res = await request(app)
        .post(`/boards/${board.id}/collaborators`)
        .set(owner.authHeader)
        .send({ email: invitee.user.email, role: "viewer" })
        .expect(409);

      expect(res.body.message).toMatch(/already a collaborator/i);

      const stored = await Board.findById(board.id);
      expect(stored!.collaborators).toHaveLength(1);
      expect(stored!.collaborators[0]!.role).toBe("editor");
    });

    it("409 when inviting the board owner", async () => {
      const owner = await registerAndLogin(app);
      const board = await createBoard(owner);

      const res = await request(app)
        .post(`/boards/${board.id}/collaborators`)
        .set(owner.authHeader)
        .send({ email: owner.user.email, role: "editor" })
        .expect(409);

      expect(res.body.message).toMatch(/owner already has full access/i);

      const stored = await Board.findById(board.id);
      expect(stored!.collaborators).toEqual([]);
    });

    it("400 for a malformed email", async () => {
      const owner = await registerAndLogin(app);
      const board = await createBoard(owner);

      const res = await request(app)
        .post(`/boards/${board.id}/collaborators`)
        .set(owner.authHeader)
        .send({ email: "not-an-email" })
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "email", message: "Must be a valid email address" },
      ]);
    });

    it("400 for a role outside the enum", async () => {
      const owner = await registerAndLogin(app);
      const invitee = await registerAndLogin(app);
      const board = await createBoard(owner);

      const res = await request(app)
        .post(`/boards/${board.id}/collaborators`)
        .set(owner.authHeader)
        .send({ email: invitee.user.email, role: "owner" })
        .expect(400);

      expect(res.body.details).toEqual([
        { field: "role", message: "Collaborator role must be either editor or viewer" },
      ]);
    });
  });
});

describe("PATCH /boards/:id/collaborators/:userId", () => {
  it("promotes a viewer to editor", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "viewer");

    const res = await request(app)
      .patch(`/boards/${board.id}/collaborators/${collaborator.user.id}`)
      .set(owner.authHeader)
      .send({ role: "editor" })
      .expect(200);

    expect(res.body.data.board.collaborators[0].role).toBe("editor");
  });

  it("takes effect immediately for the promoted user", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "viewer");

    const before = await request(app)
      .get(`/boards/${board.id}`)
      .set(collaborator.authHeader)
      .expect(200);
    expect(before.body.data.board.myRole).toBe("viewer");

    await request(app)
      .patch(`/boards/${board.id}/collaborators/${collaborator.user.id}`)
      .set(owner.authHeader)
      .send({ role: "editor" })
      .expect(200);

    const after = await request(app)
      .get(`/boards/${board.id}`)
      .set(collaborator.authHeader)
      .expect(200);
    expect(after.body.data.board.myRole).toBe("editor");
  });

  it("404 when the user is not a collaborator", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const board = await createBoard(owner);

    const res = await request(app)
      .patch(`/boards/${board.id}/collaborators/${stranger.user.id}`)
      .set(owner.authHeader)
      .send({ role: "editor" })
      .expect(404);

    expect(res.body.message).toMatch(/not a collaborator/i);
  });

  it("400 for a malformed userId", async () => {
    const owner = await registerAndLogin(app);
    const board = await createBoard(owner);

    const res = await request(app)
      .patch(`/boards/${board.id}/collaborators/nope`)
      .set(owner.authHeader)
      .send({ role: "editor" })
      .expect(400);

    expect(res.body.details).toEqual([
      expect.objectContaining({ field: "userId" }),
    ]);
  });
});

describe("DELETE /boards/:id/collaborators/:userId", () => {
  it("removes the collaborator and revokes their access", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "editor");

    await request(app).get(`/boards/${board.id}`).set(collaborator.authHeader).expect(200);

    const res = await request(app)
      .delete(`/boards/${board.id}/collaborators/${collaborator.user.id}`)
      .set(owner.authHeader)
      .expect(200);

    expect(res.body.data.board.collaborators).toEqual([]);

    await request(app).get(`/boards/${board.id}`).set(collaborator.authHeader).expect(403);

    const list = await request(app).get("/boards").set(collaborator.authHeader).expect(200);
    expect(list.body.data.boards).toEqual([]);
  });

  it("clears the removed user from tasks they were assigned", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "editor");

    const column = await Column.create({ title: "Todo", boardId: board.id, position: 0 });
    const task = await Task.create({
      title: "Assigned to them",
      boardId: board.id,
      columnId: column._id,
      position: 0,
      status: "Todo",
      assignedTo: collaborator.user.id,
    });

    await request(app)
      .delete(`/boards/${board.id}/collaborators/${collaborator.user.id}`)
      .set(owner.authHeader)
      .expect(200);

    const stored = await Task.findById(task._id);
    expect(stored!.assignedTo).toBeNull();
  });

  it("logs collaborator.removed", async () => {
    const owner = await registerAndLogin(app);
    const collaborator = await registerAndLogin(app);
    const board = await createBoard(owner);
    await invite(owner, board.id, collaborator, "editor");

    await request(app)
      .delete(`/boards/${board.id}/collaborators/${collaborator.user.id}`)
      .set(owner.authHeader)
      .expect(200);

    const entry = await ActivityLog.findOne({
      boardId: board.id,
      action: "collaborator.removed",
    });
    expect(entry).not.toBeNull();
    expect(entry!.meta).toMatchObject({ collaboratorId: collaborator.user.id });
  });

  it("404 when the user is not a collaborator", async () => {
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const board = await createBoard(owner);

    await request(app)
      .delete(`/boards/${board.id}/collaborators/${stranger.user.id}`)
      .set(owner.authHeader)
      .expect(404);
  });
});
