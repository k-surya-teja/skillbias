import { atsFetch } from "./api";
import type { AiTestRequest, AiTestSuccess, Organization, SettingsUpdate } from "./types";

export async function getSettings(): Promise<{ organization: Organization }> {
  return atsFetch("/settings");
}

export async function updateSettings(
  payload: SettingsUpdate,
): Promise<{ organization: Organization }> {
  return atsFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/**
 * Hits the configured (or proposed) AI provider with a sample candidate
 * and returns a real score + latency. Throws ApiError on provider failure
 * with the original provider message in `details`.
 */
export async function testAiProvider(payload: AiTestRequest): Promise<AiTestSuccess> {
  return atsFetch("/settings/ai/test", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 45_000, // provider calls can be slow on cold start
  });
}
