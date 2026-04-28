import { ATS_API_BASE_URL } from "./config";
import { endApiCall, startApiCall } from "./loadingStore";

type ApiOptions = RequestInit & {
  raw?: boolean;
  /** Per-request timeout in ms. Defaults to 15000 (15s). Set 0 to disable. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Structured error class so callers can branch on `code` / `status`
 * (e.g. show an upgrade prompt for `payment_required`) instead of
 * matching free-text messages.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True for transient/network/server errors that are reasonable to retry. */
  get isRetryable(): boolean {
    if (this.code === "network_error" || this.code === "timeout") return true;
    return this.status >= 500;
  }

  /** True if the user is unauthenticated and should be sent to login. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export async function atsFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, raw, signal: callerSignal, ...rest } = options;

  // Combine caller's AbortSignal (if any) with our timeout signal so either can cancel.
  const controller = new AbortController();
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), timeoutMs)
      : null;

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason));
  }

  // Bracket the call with the global in-flight counter so the
  // <ApiLoadingIndicator /> in the layout knows when something is happening.
  startApiCall();
  try {
    let response: Response;
    try {
      response = await fetch(`${ATS_API_BASE_URL}${path}`, {
        credentials: "include",
        ...rest,
        signal: controller.signal,
        headers: {
          ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
          ...(rest.headers ?? {}),
        },
      });
    } catch (networkErr) {
      if (timeoutId) clearTimeout(timeoutId);

      // Caller cancelled deliberately — re-throw so they can handle it.
      if (callerSignal?.aborted) {
        throw networkErr;
      }

      if (
        networkErr instanceof DOMException &&
        (networkErr.name === "TimeoutError" || networkErr.name === "AbortError")
      ) {
        throw new ApiError(
          "The server took too long to respond. Please try again.",
          0,
          "timeout",
        );
      }
      throw new ApiError(
        "Can't reach the server. Check your connection and try again.",
        0,
        "network_error",
      );
    }

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      let message = defaultMessageForStatus(response.status);
      let code = "http_error";
      let details: unknown = undefined;
      try {
        const parsed = (await response.json()) as {
          message?: string;
          code?: string;
          details?: unknown;
        };
        if (parsed.message) message = parsed.message;
        if (parsed.code) code = parsed.code;
        if (parsed.details !== undefined) details = parsed.details;
      } catch {
        // Body wasn't JSON; keep the defaults.
      }
      throw new ApiError(message, response.status, code, details);
    }

    if (raw) return response as T;

    // Tolerate empty bodies on 2xx (e.g. 204 No Content).
    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ApiError("Server returned an invalid response.", 0, "bad_response");
    }
  } finally {
    endApiCall();
  }
}

function defaultMessageForStatus(status: number): string {
  if (status === 401) return "You're signed out. Please log in again.";
  if (status === 403) return "You don't have access to do that.";
  if (status === 404) return "Not found.";
  if (status === 409) return "That conflicts with something already on file.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many requests — please slow down.";
  if (status >= 500) return "The server hit a problem. Try again in a moment.";
  return `Request failed (${status}).`;
}

/**
 * Convenience: extract a user-safe message from any thrown value.
 * Use in catch blocks instead of inline `instanceof Error ? ...` checks.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
