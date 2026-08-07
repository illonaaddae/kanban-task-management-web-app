import OpenAI from "openai";
import { z } from "zod";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../utils/AppError";

/**
 * The AI layer.
 *
 * Two rules shape everything here.
 *
 * **The model never writes.** Every call returns a *proposal* that the user
 * confirms, and the existing validated endpoints do the creating. A hostile or
 * simply wrong response cannot make a team, send an invitation or touch a board.
 *
 * **The bill is bounded.** Short prompts, a hard output cap, truncated input, and
 * a per-user rate limit. This runs on a small prepaid balance, and an unbounded
 * generation loop is an unbounded invoice.
 */

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.aiEnabled) {
    // 503 rather than 500: the service is fine, this feature is simply not
    // configured, and the frontend hides the buttons on the same signal.
    throw new AppError(
      "AI features are not configured on this server",
      503,
    );
  }
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

/** Test seam: drops the memoised client so a stubbed key takes effect. */
export function resetAiClient(): void {
  client = null;
}

// ── Rate limiting ───────────────────────────────────────────────────────────

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

/**
 * Per-user, in memory.
 *
 * Deliberately not in Mongo: this guards spend on a single process, and a
 * round trip to the database per request would cost more than it saves. The
 * trade-off is that it resets on restart and does not span instances, which is
 * acceptable for a limit whose job is stopping one person from looping, not
 * enforcing a quota.
 */
const hits = new Map<string, number[]>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    throw new AppError(
      `Too many AI requests. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
      429,
    );
  }

  recent.push(now);
  hits.set(userId, recent);

  // Keep the map from growing without bound in a long-lived process.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(key);
    }
  }
}

/** Test seam. */
export function resetRateLimit(): void {
  hits.clear();
}

// ── Shapes the model must return ────────────────────────────────────────────

const taskSuggestionSchema = z.object({
  description: z.string().max(2000),
  subtasks: z.array(z.string().min(1).max(200)).max(8),
});

const teamPlanSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  emails: z.array(z.email()).max(20),
  boardName: z.string().min(1).max(120),
  columns: z.array(z.string().min(1).max(80)).min(2).max(6),
});

export type TaskSuggestion = z.infer<typeof taskSuggestionSchema>;
export type TeamPlan = z.infer<typeof teamPlanSchema>;

/**
 * Parses the model's JSON and validates it.
 *
 * The response is untrusted input like any other. `strict` structured output makes
 * a mismatch unlikely, not impossible, and a malformed reply must fail as a clear
 * error rather than propagate half-built objects into the UI.
 */
function parseJson<T>(raw: string, schema: z.ZodType<T>, what: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error({ what, raw: raw.slice(0, 200) }, "AI returned unparseable JSON");
    throw new AppError("The assistant returned something unusable. Try again.", 502);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    logger.error(
      { what, issues: result.error.issues.slice(0, 5) },
      "AI response failed validation",
    );
    throw new AppError("The assistant returned something unusable. Try again.", 502);
  }

  return result.data;
}

/** Bounds what is sent, so a pasted document cannot become the prompt. */
function clamp(value: string, max: number): string {
  return value.trim().slice(0, max);
}

async function respond(
  instructions: string,
  input: string,
  schemaName: string,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const openai = getClient();

  try {
    const response = await openai.responses.create({
      model: env.OPENAI_MODEL,
      instructions,
      input,
      max_output_tokens: env.OPENAI_MAX_OUTPUT_TOKENS,
      // Structured output, so the reply is JSON by construction rather than by
      // asking politely and hoping.
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema: jsonSchema,
        },
      },
    });

    /**
     * A response cut off at the token ceiling is *truncated JSON*, not an error:
     * `output_text` comes back with the object unclosed, so parsing it fails with a
     * generic "unusable" message that says nothing about the real cause. The API
     * reports this state, so it is checked rather than inferred from a parse
     * failure.
     */
    if (response.status === "incomplete") {
      logger.warn(
        {
          reason: response.incomplete_details?.reason,
          cap: env.OPENAI_MAX_OUTPUT_TOKENS,
        },
        "AI response hit the output ceiling",
      );
      throw new AppError(
        "The assistant ran long and was cut off. Try a shorter title.",
        502,
      );
    }

    const text = response.output_text?.trim();
    if (!text) {
      throw new AppError("The assistant returned nothing. Try again.", 502);
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error({ err: message, model: env.OPENAI_MODEL }, "AI request failed");

    // The upstream message can name the model, the account or a quota. Surfacing
    // it verbatim leaks configuration to any signed-in user, so it stays in the
    // log and the caller gets something actionable instead.
    throw new AppError(
      "The assistant is unavailable right now. Try again shortly.",
      502,
    );
  }
}

export const aiService = {
  /**
   * Fleshes out a task from its title.
   *
   * Returns a suggestion for the user to edit. Nothing is saved here.
   */
  async suggestTask(
    userId: string,
    title: string,
    boardContext: string,
  ): Promise<TaskSuggestion> {
    checkRateLimit(userId);

    const cleanTitle = clamp(title, 200);
    if (cleanTitle.length < 3) {
      throw AppError.badRequest("Give the task a title first", [
        { field: "title", message: "At least 3 characters" },
      ]);
    }

    const raw = await respond(
      [
        "You help someone fill in a kanban task they have already named.",
        "Write a short description: two sentences at most, plain and concrete, no marketing tone.",
        "Then list 3 to 5 subtasks, each a single actionable step of at most 12 words.",
        "Match the vocabulary of the board it belongs to.",
        "Invent no dates, no names and no numbers.",
      ].join(" "),
      `Board: ${clamp(boardContext, 300)}\nTask title: ${cleanTitle}`,
      "task_suggestion",
      {
        type: "object",
        properties: {
          description: { type: "string" },
          subtasks: { type: "array", items: { type: "string" } },
        },
        required: ["description", "subtasks"],
        additionalProperties: false,
      },
    );

    return parseJson(raw, taskSuggestionSchema, "task suggestion");
  },

  /**
   * Turns a sentence into a proposed team, board and invitee list.
   *
   * Strictly a proposal. The caller confirms, and the existing `/orgs`,
   * `/boards` and invitation endpoints do the work with their own validation and
   * permission checks.
   */
  async planTeam(userId: string, prompt: string): Promise<TeamPlan> {
    checkRateLimit(userId);

    const cleanPrompt = clamp(prompt, 600);
    if (cleanPrompt.length < 10) {
      throw AppError.badRequest("Describe the team you want in a sentence or two", [
        { field: "prompt", message: "At least 10 characters" },
      ]);
    }

    const raw = await respond(
      [
        "You turn one sentence into a plan for a kanban team and its first board.",
        "Return a short team name, a one-sentence description, a first board name,",
        "and 3 to 4 column names that describe a workflow ending in a done state.",
        "Extract email addresses only if they appear literally in the request:",
        "never guess or construct an address from a person's name.",
        "Return an empty list if none are given.",
      ].join(" "),
      cleanPrompt,
      "team_plan",
      {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          emails: { type: "array", items: { type: "string" } },
          boardName: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "emails", "boardName", "columns"],
        additionalProperties: false,
      },
    );

    const plan = parseJson(raw, teamPlanSchema, "team plan");

    // Belt and braces on the instruction above: a fabricated address would send a
    // real invitation to a stranger, so anything not present in the prompt is
    // dropped rather than trusted.
    const mentioned = new Set(
      (cleanPrompt.toLowerCase().match(/[^\s<>()[\],;:"]+@[^\s<>()[\],;:"]+/g) ?? []),
    );
    const emails = plan.emails.filter((email) => mentioned.has(email.toLowerCase()));

    if (emails.length !== plan.emails.length) {
      logger.warn(
        { proposed: plan.emails.length, kept: emails.length },
        "Dropped AI-invented email addresses from a team plan",
      );
    }

    return { ...plan, emails };
  },
};

export default aiService;
