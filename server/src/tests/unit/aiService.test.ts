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
