import { ATS_API_BASE_URL } from "./config";

type ApiOptions = RequestInit & { raw?: boolean };

export async function atsFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${ATS_API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const parsed = (await response.json()) as { message?: string };
      if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      // Ignore body parsing failures and keep generic message.
    }
    throw new Error(message);
  }

  if (options.raw) {
    return response as T;
  }

  return (await response.json()) as T;
}
