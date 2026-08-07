import { api } from "./api";

export interface AiStatus {
  enabled: boolean;
  /** Null when disabled. Shown so the UI can say what is answering. */
  model: string | null;
}

export interface TaskSuggestion {
  description: string;
  subtasks: string[];
}

export interface TeamPlan {
  name: string;
  description: string;
  /** Only addresses that appeared literally in the prompt; the server strips the rest. */
  emails: string[];
  boardName: string;
  columns: string[];
}

/** One recognised instruction about a board. A closed set, so `unknown` is valid. */
export interface CommandPlan {
  action: 'move_task' | 'assign_task' | 'set_due_date' | 'create_task' | 'unknown';
  taskTitle: string;
  columnName: string;
  assigneeName: string;
  /** `yyyy-mm-dd`, or empty. The server discards anything that is not a real date. */
  dueDate: string;
  newTaskTitle: string;
  summary: string;
}

/**
 * The assistant.
 *
 * Every one of these returns a *proposal*. Nothing is created until the user
 * confirms and the existing board, team and invitation endpoints do the writing
 * with their own validation. The key never reaches the browser.
 */

export function getAiStatus(): Promise<AiStatus> {
  return api.get<AiStatus>("/ai/status");
}

export async function suggestTask(
  title: string,
  context: string,
): Promise<TaskSuggestion> {
  const { suggestion } = await api.post<{ suggestion: TaskSuggestion }>(
    "/ai/task-suggestion",
    { title, context },
  );
  return suggestion;
}

export async function interpretCommand(
  boardId: string,
  instruction: string,
): Promise<CommandPlan> {
  const { plan } = await api.post<{ plan: CommandPlan }>('/ai/command', {
    boardId,
    instruction,
  });
  return plan;
}

/** One turn of a board conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * An answer, and at most one change it is offering to make.
 *
 * `action` is the same closed set the command bar resolves, so a reply that wants
 * to change something goes through exactly the same confirmation and the same
 * mutations. A reply is never itself a write.
 */
export interface ChatReply {
  reply: string;
  action: CommandPlan | null;
}

export async function chat(
  boardId: string,
  messages: ChatMessage[],
): Promise<ChatReply> {
  return api.post<ChatReply>('/ai/chat', { boardId, messages });
}

export async function planTeam(prompt: string): Promise<TeamPlan> {
  const { plan } = await api.post<{ plan: TeamPlan }>("/ai/team-plan", { prompt });
  return plan;
}
