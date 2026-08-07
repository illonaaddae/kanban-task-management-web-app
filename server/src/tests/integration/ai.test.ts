import request from "supertest";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { registerAndLogin } from "../fixtures/auth";

const create = jest.fn();

// Never reaches OpenAI, so the suite costs nothing whatever is in .env.
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({ responses: { create } })),
}));

import app from "../../app";
import { resetAiClient, resetRateLimit } from "../../services/aiService";

beforeAll(async () => {
  await User.init();
});

beforeEach(() => {
  create.mockReset();
  resetAiClient();
  resetRateLimit();
});

function enableAi() {
  jest.replaceProperty(env, "aiEnabled", true);
  jest.replaceProperty(env, "OPENAI_API_KEY", "sk-test");
  resetAiClient();
}

function ok(payload: unknown) {
  return { status: "completed", output_text: JSON.stringify(payload) };
}

const SUGGESTION = {
  description: "Fix the redirect loop.",
  subtasks: ["Reproduce it", "Fix the guard", "Add a test"],
};

describe("GET /ai/status", () => {
  it("reports enabled and the model when a key is set", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    const res = await request(app)
      .get("/ai/status")
      .set(user.authHeader)
      .expect(200);

    expect(res.body.data).toEqual({ enabled: true, model: env.OPENAI_MODEL });
  });

  it("reports disabled without a key, so the UI can hide the buttons", async () => {
    jest.replaceProperty(env, "aiEnabled", false);
    const user = await registerAndLogin(app);

    const res = await request(app)
      .get("/ai/status")
      .set(user.authHeader)
      .expect(200);

    // Offering a button that answers 503 is worse than not offering it.
    expect(res.body.data).toEqual({ enabled: false, model: null });
  });

  it("never reveals the key itself", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    const res = await request(app)
      .get("/ai/status")
      .set(user.authHeader)
      .expect(200);

    expect(JSON.stringify(res.body)).not.toContain("sk-test");
  });

  it("requires a session", async () => {
    await request(app).get("/ai/status").expect(401);
  });
});

describe("POST /ai/task-suggestion", () => {
  it("returns a suggestion", async () => {
    enableAi();
    create.mockResolvedValue(ok(SUGGESTION));
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "Fix the login redirect", context: "Platform Launch" })
      .expect(200);

    expect(res.body.data.suggestion).toMatchObject({ subtasks: SUGGESTION.subtasks });
  });

  it("writes nothing to the database", async () => {
    enableAi();
    create.mockResolvedValue(ok(SUGGESTION));
    const user = await registerAndLogin(app);

    await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "Fix the login redirect" })
      .expect(200);

    // The model proposes; the existing validated endpoints create. A wrong or
    // hostile response must not be able to make anything.
    const boards = await request(app).get("/boards").set(user.authHeader).expect(200);
    expect(boards.body.data.boards).toEqual([]);
  });

  it("400s a title below the minimum", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "ab" })
      .expect(400);

    expect(res.body.details).toEqual([expect.objectContaining({ field: "title" })]);
    expect(create).not.toHaveBeenCalled();
  });

  it("400s a title beyond the ceiling rather than sending it", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "x".repeat(500) })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("503s when no key is configured", async () => {
    jest.replaceProperty(env, "aiEnabled", false);
    resetAiClient();
    const user = await registerAndLogin(app);

    await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "Fix the login redirect" })
      .expect(503);
  });

  it("401s without a session, so nobody anonymous can spend the balance", async () => {
    enableAi();

    await request(app)
      .post("/ai/task-suggestion")
      .send({ title: "Fix the login redirect" })
      .expect(401);

    expect(create).not.toHaveBeenCalled();
  });

  it("429s a user who loops", async () => {
    enableAi();
    create.mockResolvedValue(ok(SUGGESTION));
    const user = await registerAndLogin(app);

    for (let i = 0; i < 8; i += 1) {
      await request(app)
        .post("/ai/task-suggestion")
        .set(user.authHeader)
        .send({ title: "Fix the login redirect" })
        .expect(200);
    }

    await request(app)
      .post("/ai/task-suggestion")
      .set(user.authHeader)
      .send({ title: "Fix the login redirect" })
      .expect(429);
  });
});

/**
 * The two board-scoped endpoints.
 *
 * Both are gated at editor rather than viewer, because a response can carry a
 * proposed change and drafting one for somebody who could never apply it is only a
 * way to waste their time and the balance. The access checks are the point of these
 * tests: the model output is stubbed.
 */
async function boardWithColumns(user: Awaited<ReturnType<typeof registerAndLogin>>) {
  const board = await request(app)
    .post("/boards")
    .set(user.authHeader)
    .send({ title: "Platform Launch" })
    .expect(201);

  const boardId = board.body.data.board.id;

  for (const title of ["Todo", "Done"]) {
    await request(app)
      .post(`/boards/${boardId}/columns`)
      .set(user.authHeader)
      .send({ title })
      .expect(201);
  }

  return boardId as string;
}

const PLAN = {
  action: "move_task",
  taskTitle: "Fix the login redirect",
  columnName: "Done",
  assigneeName: "",
  dueDate: "",
  newTaskTitle: "",
  summary: "Move it to Done.",
};

describe("POST /ai/command", () => {
  it("returns a plan for an editor", async () => {
    enableAi();
    create.mockResolvedValue(ok(PLAN));
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    const res = await request(app)
      .post("/ai/command")
      .set(owner.authHeader)
      .send({ boardId, instruction: "move the login fix to done" })
      .expect(200);

    expect(res.body.data.plan).toMatchObject({ action: "move_task", columnName: "Done" });
  });

  it("403s a viewer, who could not apply the plan anyway", async () => {
    enableAi();
    create.mockResolvedValue(ok(PLAN));
    const owner = await registerAndLogin(app);
    const viewer = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: viewer.user.email, role: "viewer" })
      .expect(201);

    await request(app)
      .post("/ai/command")
      .set(viewer.authHeader)
      .send({ boardId, instruction: "move the login fix to done" })
      .expect(403);

    // Refused before the call, not after: a rejected request costs nothing.
    expect(create).not.toHaveBeenCalled();
  });

  it("403s somebody with no access to the board", async () => {
    enableAi();
    const owner = await registerAndLogin(app);
    const stranger = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    await request(app)
      .post("/ai/command")
      .set(stranger.authHeader)
      .send({ boardId, instruction: "move the login fix to done" })
      .expect(403);
  });

  it("400s a missing board id before spending anything", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/command")
      .set(user.authHeader)
      .send({ instruction: "move the login fix to done" })
      .expect(400);

    expect(res.body.details).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /ai/chat", () => {
  const reply = (action: unknown = null) => ok({ reply: "Two tasks are open.", action });

  it("answers a question about the board", async () => {
    enableAi();
    create.mockResolvedValue(reply());
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    const res = await request(app)
      .post("/ai/chat")
      .set(owner.authHeader)
      .send({ boardId, messages: [{ role: "user", content: "what is open?" }] })
      .expect(200);

    expect(res.body.data).toEqual({ reply: "Two tasks are open.", action: null });
  });

  it("can attach a proposed change without making it", async () => {
    enableAi();
    create.mockResolvedValue(reply(PLAN));
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    const res = await request(app)
      .post("/ai/chat")
      .set(owner.authHeader)
      .send({ boardId, messages: [{ role: "user", content: "move the login fix" }] })
      .expect(200);

    expect(res.body.data.action).toMatchObject({ action: "move_task" });

    // Answering is not doing. The board is untouched until the client calls the
    // ordinary move endpoint.
    const full = await request(app)
      .get(`/boards/${boardId}/full`)
      .set(owner.authHeader)
      .expect(200);
    expect(full.body.data.columns.flatMap((column: { tasks: unknown[] }) => column.tasks)).toEqual([]);
  });

  it("403s a viewer", async () => {
    enableAi();
    create.mockResolvedValue(reply());
    const owner = await registerAndLogin(app);
    const viewer = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    await request(app)
      .post(`/boards/${boardId}/collaborators`)
      .set(owner.authHeader)
      .send({ email: viewer.user.email, role: "viewer" })
      .expect(201);

    await request(app)
      .post("/ai/chat")
      .set(viewer.authHeader)
      .send({ boardId, messages: [{ role: "user", content: "what is open?" }] })
      .expect(403);
  });

  it("400s an empty transcript", async () => {
    enableAi();
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    await request(app)
      .post("/ai/chat")
      .set(owner.authHeader)
      .send({ boardId, messages: [] })
      .expect(400);
  });

  it("400s a transcript longer than the cap rather than truncating it silently", async () => {
    enableAi();
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    const messages = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message ${i}`,
    }));

    await request(app)
      .post("/ai/chat")
      .set(owner.authHeader)
      .send({ boardId, messages })
      .expect(400);
  });

  it("503s when no key is configured", async () => {
    jest.replaceProperty(env, "aiEnabled", false);
    resetAiClient();
    const owner = await registerAndLogin(app);
    const boardId = await boardWithColumns(owner);

    await request(app)
      .post("/ai/chat")
      .set(owner.authHeader)
      .send({ boardId, messages: [{ role: "user", content: "what is open?" }] })
      .expect(503);
  });

  it("401s without a session", async () => {
    enableAi();
    await request(app)
      .post("/ai/chat")
      .send({ boardId: "000000000000000000000000", messages: [{ role: "user", content: "hi" }] })
      .expect(401);
  });
});

describe("POST /ai/team-plan", () => {
  const plan = {
    name: "Design Squad",
    description: "The design team.",
    emails: ["ama@example.com"],
    boardName: "Design Sprint",
    columns: ["Todo", "Doing", "Done"],
  };

  it("returns a plan without creating anything", async () => {
    enableAi();
    create.mockResolvedValue(ok(plan));
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/team-plan")
      .set(user.authHeader)
      .send({ prompt: "A design squad with ama@example.com on it" })
      .expect(200);

    expect(res.body.data.plan).toMatchObject({ name: "Design Squad" });

    // Nothing was created and no invitation was sent: the user confirms first.
    const orgs = await request(app).get("/orgs").set(user.authHeader).expect(200);
    expect(orgs.body.data.organizations).toEqual([]);
  });

  it("strips an address the model invented", async () => {
    enableAi();
    create.mockResolvedValue(ok({ ...plan, emails: ["ama@example.com", "made-up@example.com"] }));
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/team-plan")
      .set(user.authHeader)
      .send({ prompt: "A design squad with ama@example.com on it" })
      .expect(200);

    // An invented address would mean a real invitation to a stranger.
    expect(res.body.data.plan.emails).toEqual(["ama@example.com"]);
  });

  it("400s a prompt too short to plan from", async () => {
    enableAi();
    const user = await registerAndLogin(app);

    await request(app)
      .post("/ai/team-plan")
      .set(user.authHeader)
      .send({ prompt: "hi" })
      .expect(400);

    expect(create).not.toHaveBeenCalled();
  });

  it("502s on an unusable response", async () => {
    enableAi();
    create.mockResolvedValue({ status: "completed", output_text: "nonsense" });
    const user = await registerAndLogin(app);

    await request(app)
      .post("/ai/team-plan")
      .set(user.authHeader)
      .send({ prompt: "A design squad for the new marketing site" })
      .expect(502);
  });

  it("502s a cut-off response with a message that names the cause", async () => {
    enableAi();
    create.mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: '{"name":"Des',
    });
    const user = await registerAndLogin(app);

    const res = await request(app)
      .post("/ai/team-plan")
      .set(user.authHeader)
      .send({ prompt: "A design squad for the new marketing site" })
      .expect(502);

    expect(res.body.message).toMatch(/cut off/i);
  });
});
