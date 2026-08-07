/**
 * Fetch wrapper for the Express API in `server/`.
 *
 * Owns three things so nothing above it has to:
 *   • the Bearer token (read from localStorage on every request)
 *   • unwrapping the `{ status, data }` envelope
 *   • refreshing once on a 401, then giving up and clearing the session
 */

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:5050").replace(
  /\/+$/,
  "",
);

export const ACCESS_TOKEN_KEY = "kanban_access_token";
export const REFRESH_TOKEN_KEY = "kanban_refresh_token";

/** One field-level problem from a 400 response. */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

/**
 * An error carrying the server's own message, so the UI can show it verbatim
 * instead of a generic "request failed".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(message: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** True when the server rejected the payload rather than the caller. */
  get isValidationError(): boolean {
    return this.status === 400;
  }
}

// ── Token storage ──────────────────────────────────────────────────────────

export const tokenStore = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  set(accessToken: string, refreshToken?: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  get isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
  },
};

// ── Request plumbing ───────────────────────────────────────────────────────

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip the Authorization header - for login/register/refresh. */
  skipAuth?: boolean;
  /** Skip the refresh-and-retry dance. Set on the refresh call itself. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
  /** Override the default request timeout, in milliseconds. */
  timeoutMs?: number;
}

/**
 * How long to wait before giving up on a request.
 *
 * Generous, because a free-tier host that has spun down can take 30-60 seconds
 * to answer its first request. But *finite*: without a ceiling a stalled
 * connection leaves the promise pending forever, so a loading flag set before
 * the call is never cleared and the UI spins with no error and no way out. A
 * failed request the user can retry beats an honest-looking spinner.
 */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Runs `fetch` with a timeout, honouring a caller-supplied signal as well.
 *
 * Built from AbortController rather than `AbortSignal.any` so it does not depend
 * on very recent browser support, and the timer is always cleared - including on
 * the error path - so a long-lived page does not accumulate timers.
 */
async function fetchWithTimeout(
  request: Request,
  options: RequestOptions,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });

  try {
    return await fetch(request, { signal: controller.signal });
  } catch (error) {
    // Distinguish "we gave up" from "the caller cancelled" - only the first is
    // an error worth showing.
    if (timedOut) {
      throw new ApiError(
        `The server did not respond within ${Math.round(timeoutMs / 1000)}s. It may be starting up - please try again.`,
        408,
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

interface SuccessEnvelope<T> {
  status: "success";
  data: T;
}

interface ErrorEnvelope {
  status: "error";
  message: string;
  details?: ApiErrorDetail[];
}

/** A single in-flight refresh, shared by every 401 that arrives while it runs. */
let refreshInFlight: Promise<boolean> | null = null;

async function readEnvelope<T>(response: Response): Promise<T> {
  // 204 and empty bodies have no envelope to unwrap.
  const text = await response.text();
  if (!text) {
    if (response.ok) return undefined as T;
    throw new ApiError(response.statusText || "Request failed", response.status);
  }

  let parsed: SuccessEnvelope<T> | ErrorEnvelope;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A proxy or crash returned HTML - surface the status, not a parse error.
    throw new ApiError(
      response.ok ? "The server returned a malformed response" : text.slice(0, 200),
      response.status,
    );
  }

  if (!response.ok || parsed.status === "error") {
    const error = parsed as ErrorEnvelope;
    throw new ApiError(
      error.message || "Request failed",
      response.status,
      error.details,
    );
  }

  return (parsed as SuccessEnvelope<T>).data;
}

function buildRequest(path: string, options: RequestOptions): Request {
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  if (!options.skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return new Request(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

/**
 * Exchanges the refresh token for a new pair.
 *
 * Concurrent callers share one request - otherwise a page that fires several
 * requests at once would send several refreshes, and with rotation on the
 * server all but one of the resulting tokens would be stale.
 */
async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetchWithTimeout(
      new Request(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }),
      {},
    );

    const data = await readEnvelope<{ accessToken: string; refreshToken: string }>(
      response,
    );

    tokenStore.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= refreshSession().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Performs a request and unwraps its envelope.
 *
 * On a 401 with a refresh token available, refreshes **once** and replays the
 * request. If that still fails the session is cleared, so the app falls back to
 * the login screen rather than looping.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetchWithTimeout(buildRequest(path, options), options);
  } catch (error) {
    // A timeout already carries a precise message - do not flatten it into the
    // generic network error below.
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // Past this point fetch only rejects on a network-level failure, which
    // includes a CORS rejection: the browser refuses to expose the response, so
    // "cannot reach the server" is the honest description from here.
    throw new ApiError(
      "Cannot reach the server. Check that the API is running and try again.",
      0,
    );
  }

  const canRetry =
    response.status === 401 &&
    !options.skipRefresh &&
    !options.skipAuth &&
    tokenStore.getRefreshToken() !== null;

  if (!canRetry) return readEnvelope<T>(response);

  const refreshed = await refreshOnce();
  if (!refreshed) {
    tokenStore.clear();
    return readEnvelope<T>(response);
  }

  // Rebuild so the replay picks up the new token.
  const retried = await fetchWithTimeout(
    buildRequest(path, { ...options, skipRefresh: true }),
    options,
  );
  if (retried.status === 401) tokenStore.clear();

  return readEnvelope<T>(retried);
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { API_URL };
export default api;
