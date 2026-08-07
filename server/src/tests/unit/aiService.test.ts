import { env } from "../../config/env";

const create = jest.fn();

/**
 * Mocked at the module boundary, so the suite never reaches OpenAI and never
 * spends from the balance, whatever is in the developer's .env.
 */
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn(() => ({ responses: { create } })),
}));

// Imported after the mock is registered.
import {
  aiService,
  resetAiClient,
  resetRateLimit,
} from "../../services/aiService";

/** A completed response carrying `text` as its output. */
function ok(text: string) {
  return { status: "completed", output_text: text, usage: { output_tokens: 40 } };
}

function withAiConfigured() {
  jest.replaceProperty(env, "aiEnabled", true);
  jest.replaceProperty(env, "OPENAI_API_KEY", "sk-test");
  resetAiClient();
}

const SUGGESTION = JSON.stringify({
  description: "Fix the redirect.",
  subtasks: ["Reproduce it", "Fix the guard", "Add a test"],
});

beforeEach(() => {
  create.mockReset();
  resetAiClient();
  resetRateLimit();
});

describe("aiService when no key is configured", () => {
  it("reports 503 rather than failing as a server error", async () => {
    jest.replaceProperty(env, "aiEnabled", false);
    resetAiClient();

    // The service is fine; this feature is simply not set up, and the frontend
    // hides the buttons on the same signal.
    await expect(
      aiService.suggestTask("user-1", "Fix the login redirect", ""),
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(create).not.toHaveBeenCalled();
  });
});

describe("aiService.suggestTask", () => {
  beforeEach(withAiConfigured);

  it("returns the parsed suggestion", async () => {
    create.mockResolvedValue(ok(SUGGESTION));

    const suggestion = await aiService.suggestTask("u1", "Fix the login redirect", "Board X");

    expect(suggestion.subtasks).toHaveLength(3);
    expect(suggestion.description).toBe("Fix the redirect.");
  });

  it("asks for structured JSON and caps the output", async () => {
    create.mockResolvedValue(ok(SUGGESTION));

    await aiService.suggestTask("u1", "Fix the login redirect", "Board X");

    const [payload] = create.mock.calls[0];
    expect(payload.model).toBe(env.OPENAI_MODEL);
    expect(payload.max_output_tokens).toBe(env.OPENAI_MAX_OUTPUT_TOKENS);
    // Structured output, so the reply is JSON by construction rather than by
    // asking politely and hoping.
    expect(payload.text.format).toMatchObject({ type: "json_schema", strict: true });
  });

  it("truncates a long title instead of sending it whole", async () => {
    create.mockResolvedValue(ok(SUGGESTION));

    await aiService.suggestTask("u1", "x".repeat(5000), "y".repeat(5000));

    const [payload] = create.mock.calls[0];
    // A pasted document must not become the prompt: that is the first line of
    // cost control.
    expect(payload.input.length).toBeLessThan(700);
  });

  it("400s a title too short to work with, without calling the model", async () => {
    await expect(aiService.suggestTask("u1", "ab", "")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("reports a cut-off response as such", async () => {
    // A response stopped at the ceiling is truncated JSON, so parsing it would
    // fail with a message that says nothing about the real cause.
    create.mockResolvedValue({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output_text: '{"description":"half a sen',
    });

    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.toThrow(/cut off/i);
  });

  it("rejects unparseable output", async () => {
    create.mockResolvedValue(ok("not json at all"));

    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("rejects output that parses but does not match the shape", async () => {
    // `strict` makes this unlikely, not impossible. The response is untrusted
    // input like any other.
    create.mockResolvedValue(ok(JSON.stringify({ description: 42 })));

    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("does not leak the upstream error to the caller", async () => {
    create.mockRejectedValue(
      new Error("Insufficient quota for org-abc123 on model gpt-5.6-luna"),
    );

    // The upstream text can name the account, the model or a quota. That belongs
    // in the log, not in a response any signed-in user can read.
    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.toThrow(/unavailable right now/i);

    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.not.toThrow(/org-abc123/);
  });
});

describe("aiService rate limiting", () => {
  beforeEach(withAiConfigured);

  it("stops one user after the window allowance", async () => {
    create.mockResolvedValue(ok(SUGGESTION));

    for (let i = 0; i < 8; i += 1) {
      await aiService.suggestTask("looper", "Fix the login redirect", "");
    }

    // The balance is small and prepaid; one person looping must not drain it.
    await expect(
      aiService.suggestTask("looper", "Fix the login redirect", ""),
    ).rejects.toMatchObject({ statusCode: 429 });

    expect(create).toHaveBeenCalledTimes(8);
  });

  it("counts per user, so one person cannot block another", async () => {
    create.mockResolvedValue(ok(SUGGESTION));

    for (let i = 0; i < 8; i += 1) {
      await aiService.suggestTask("looper", "Fix the login redirect", "");
    }

    await expect(
      aiService.suggestTask("someone-else", "Fix the login redirect", ""),
    ).resolves.toBeDefined();
  });

  it("counts a rejected call too, so failures cannot be retried without limit", async () => {
    create.mockRejectedValue(new Error("upstream down"));

    for (let i = 0; i < 8; i += 1) {
      await expect(
        aiService.suggestTask("u1", "Fix the login redirect", ""),
      ).rejects.toThrow();
    }

    await expect(
      aiService.suggestTask("u1", "Fix the login redirect", ""),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});

describe("aiService.planTeam", () => {
  beforeEach(withAiConfigured);

  const plan = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      name: "Design Squad",
      description: "The design team.",
      emails: [],
      boardName: "Design Sprint",
      columns: ["Todo", "Doing", "Done"],
      ...overrides,
    });

  it("returns the parsed plan", async () => {
    create.mockResolvedValue(ok(plan()));

    const result = await aiService.planTeam("u1", "A design squad for the new site");

    expect(result).toMatchObject({ name: "Design Squad", columns: ["Todo", "Doing", "Done"] });
  });

  it("keeps an address that appears in the prompt", async () => {
    create.mockResolvedValue(ok(plan({ emails: ["ama@example.com"] })));

    const result = await aiService.planTeam(
      "u1",
      "Design squad with ama@example.com on it",
    );

    expect(result.emails).toEqual(["ama@example.com"]);
  });

  it("drops an address the model invented", async () => {
    create.mockResolvedValue(
      ok(plan({ emails: ["ama@example.com", "kofi@example.com"] })),
    );

    const result = await aiService.planTeam("u1", "Design squad with ama@example.com");

    // A fabricated address would send a real invitation to a stranger. Only what
    // the user actually typed survives.
    expect(result.emails).toEqual(["ama@example.com"]);
  });

  it("drops every address when the prompt named nobody", async () => {
    create.mockResolvedValue(
      ok(plan({ emails: ["guessed@example.com"] })),
    );

    const result = await aiService.planTeam("u1", "A squad for Ama and Kofi");

    // Names are not addresses, and constructing one from a name is exactly the
    // failure this guards.
    expect(result.emails).toEqual([]);
  });

  it("matches an address case-insensitively", async () => {
    create.mockResolvedValue(ok(plan({ emails: ["ama@example.com"] })));

    const result = await aiService.planTeam("u1", "Squad with AMA@Example.com");

    expect(result.emails).toEqual(["ama@example.com"]);
  });

  it("400s a prompt too short to plan from", async () => {
    await expect(aiService.planTeam("u1", "hi")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a plan with too few columns to mean anything", async () => {
    // A single column has no done state, which the progress rules also refuse.
    create.mockResolvedValue(ok(plan({ columns: ["Everything"] })));

    await expect(
      aiService.planTeam("u1", "A design squad for the new site"),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("aiService.interpretCommand", () => {
  beforeEach(withAiConfigured);

  const board = {
    name: "Platform Launch",
    columns: ["Todo", "Doing", "Done"],
    tasks: ["Fix the login redirect", "Write the changelog"],
    people: ["Ama Mensah", "Kofi Boateng"],
  };

  const plan = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      action: "move_task",
      taskTitle: "Fix the login redirect",
      columnName: "Done",
      assigneeName: "",
      dueDate: "",
      newTaskTitle: "",
      summary: "Move it to Done.",
      ...overrides,
    });

  it("names the action and echoes the board's own wording", async () => {
    create.mockResolvedValue(ok(plan()));

    const result = await aiService.interpretCommand("u1", "move the login fix to done", board);

    expect(result.action).toBe("move_task");
    // Copied from the board, so the caller can match it exactly rather than fuzzily.
    expect(result.taskTitle).toBe("Fix the login redirect");
    expect(result.columnName).toBe("Done");
  });

  it("passes the board's real names to the model", async () => {
    create.mockResolvedValue(ok(plan()));

    await aiService.interpretCommand("u1", "move the login fix to done", board);

    const [payload] = create.mock.calls[0];
    // Inventing a plausible column name is the failure this prevents.
    expect(payload.input).toContain("Todo, Doing, Done");
    expect(payload.input).toContain("Fix the login redirect");
    expect(payload.input).toContain("Ama Mensah");
  });

  it("accepts unknown as an answer", async () => {
    create.mockResolvedValue(
      ok(plan({ action: "unknown", summary: "Not sure what that means." })),
    );

    const result = await aiService.interpretCommand("u1", "make it better somehow", board);

    // Guessing an action would be worse than admitting the instruction was unclear.
    expect(result.action).toBe("unknown");
  });

  it("discards a relative due date rather than passing it on", async () => {
    create.mockResolvedValue(
      ok(plan({ action: "set_due_date", dueDate: "next Friday" })),
    );

    const result = await aiService.interpretCommand("u1", "due next friday", board);

    // The client cannot act on a phrase, and letting it through would fail later
    // with a validation error that explains nothing.
    expect(result.dueDate).toBe("");
  });

  it("keeps a well-formed date", async () => {
    create.mockResolvedValue(
      ok(plan({ action: "set_due_date", dueDate: "2026-09-01" })),
    );

    const result = await aiService.interpretCommand("u1", "due first of september", board);

    expect(result.dueDate).toBe("2026-09-01");
  });

  it("rejects an action outside the closed set", async () => {
    // A chat window would let the model reply with anything; this can only name an
    // action the app implements.
    create.mockResolvedValue(ok(plan({ action: "delete_the_board" })));

    await expect(
      aiService.interpretCommand("u1", "burn it down", board),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("counts against the same rate limit", async () => {
    create.mockResolvedValue(ok(plan()));

    for (let i = 0; i < 8; i += 1) {
      await aiService.interpretCommand("u1", "move the login fix to done", board);
    }

    await expect(
      aiService.interpretCommand("u1", "move the login fix to done", board),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});

describe("aiService.chat", () => {
  beforeEach(withAiConfigured);

  const board = {
    name: "Platform Launch",
    columns: ["Todo", "Doing", "Done"],
    tasks: ["Fix the login redirect", "Write the changelog"],
    people: ["Ama Mensah"],
  };

  const reply = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({ reply: "Two tasks are open.", action: null, ...overrides });

  const action = (overrides: Record<string, unknown> = {}) => ({
    action: "move_task",
    taskTitle: "Fix the login redirect",
    columnName: "Done",
    assigneeName: "",
    dueDate: "",
    newTaskTitle: "",
    summary: "Move it to Done.",
    ...overrides,
  });

  it("answers a question with no action attached", async () => {
    create.mockResolvedValue(ok(reply()));

    const result = await aiService.chat("u1", [{ role: "user", content: "what is open?" }], board);

    expect(result.reply).toBe("Two tasks are open.");
    // A question is not a change, so there is nothing to confirm.
    expect(result.action).toBeNull();
  });

  it("attaches an action when a change is asked for", async () => {
    create.mockResolvedValue(ok(reply({ action: action() })));

    const result = await aiService.chat(
      "u1",
      [{ role: "user", content: "move the login fix to done" }],
      board,
    );

    expect(result.action?.action).toBe("move_task");
    expect(result.action?.taskTitle).toBe("Fix the login redirect");
  });

  it("grounds the reply in the board rather than letting it guess", async () => {
    create.mockResolvedValue(ok(reply()));

    await aiService.chat("u1", [{ role: "user", content: "what is open?" }], board);

    const [payload] = create.mock.calls[0];
    expect(payload.input).toContain("Fix the login redirect");
    expect(payload.input).toContain("Todo, Doing, Done");
    expect(payload.instructions).toMatch(/nothing else/i);
    // Claiming to have made a change it has not made is the worst failure here.
    expect(payload.instructions).toMatch(/never claim to have made a change/i);
  });

  it("keeps only the last eight messages", async () => {
    create.mockResolvedValue(ok(reply()));

    const long: Array<{ role: "user" | "assistant"; content: string }> = Array.from(
      { length: 20 },
      (_, i) => ({ role: i % 2 === 0 ? "user" : "assistant", content: `message ${i}` }),
    );

    await aiService.chat("u1", long, board);

    const [payload] = create.mock.calls[0];
    // Without a cap the transcript grows every turn and each request pays for all
    // of it.
    expect(payload.input).not.toContain("message 0");
    expect(payload.input).toContain("message 19");
  });

  it("clamps a single very long message", async () => {
    create.mockResolvedValue(ok(reply()));

    await aiService.chat("u1", [{ role: "user", content: "x".repeat(5000) }], board);

    const [payload] = create.mock.calls[0];
    expect(payload.input.length).toBeLessThan(1600);
  });

  it("drops an unknown action rather than offering a useless button", async () => {
    create.mockResolvedValue(
      ok(reply({ reply: "Not sure.", action: action({ action: "unknown" }) })),
    );

    const result = await aiService.chat("u1", [{ role: "user", content: "do a thing" }], board);

    expect(result.action).toBeNull();
  });

  it("discards a relative date on an attached action", async () => {
    create.mockResolvedValue(
      ok(reply({ action: action({ action: "set_due_date", dueDate: "next Tuesday" }) })),
    );

    const result = await aiService.chat("u1", [{ role: "user", content: "due next tuesday" }], board);

    expect(result.action?.dueDate).toBe("");
  });

  it("counts against the same rate limit", async () => {
    create.mockResolvedValue(ok(reply()));

    for (let i = 0; i < 8; i += 1) {
      await aiService.chat("u1", [{ role: "user", content: "hello" }], board);
    }

    await expect(
      aiService.chat("u1", [{ role: "user", content: "hello" }], board),
    ).rejects.toMatchObject({ statusCode: 429 });
  });
});
