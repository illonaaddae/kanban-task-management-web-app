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
