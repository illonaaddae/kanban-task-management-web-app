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

export async function planTeam(prompt: string): Promise<TeamPlan> {
  const { plan } = await api.post<{ plan: TeamPlan }>("/ai/team-plan", { prompt });
  return plan;
}
