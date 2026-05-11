import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { OrganizationRow } from "@/lib/supabase/types";
import { dbOrgToOrganization } from "./orgMapper";
import type { AiTestRequest, AiTestSuccess, Organization, SettingsUpdate } from "./types";

export async function getSettings(): Promise<{ organization: Organization }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (error || !data) throw new Error("Settings lookup failed.");
  return { organization: dbOrgToOrganization(data as OrganizationRow, user.email ?? "") };
}

export async function updateSettings(
  payload: SettingsUpdate,
): Promise<{ organization: Organization }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const updateData: Record<string, unknown> = {};
  if (payload.companyName !== undefined) updateData.company_name = payload.companyName;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.logo !== undefined) updateData.logo = payload.logo;
  if (payload.autoShortlistEnabled !== undefined)
    updateData.auto_shortlist_enabled = payload.autoShortlistEnabled;
  if (payload.autoShortlistThreshold !== undefined)
    updateData.auto_shortlist_threshold = payload.autoShortlistThreshold;
  if (payload.autoRejectEnabled !== undefined)
    updateData.auto_reject_enabled = payload.autoRejectEnabled;
  if (payload.autoRejectThreshold !== undefined)
    updateData.auto_reject_threshold = payload.autoRejectThreshold;
  if (payload.defaultScoringWeights !== undefined)
    updateData.default_scoring_weights = payload.defaultScoringWeights;
  if (payload.defaultJobIsPublic !== undefined)
    updateData.default_job_is_public = payload.defaultJobIsPublic;
  if (payload.aiProvider !== undefined) updateData.ai_provider = payload.aiProvider;
  if (payload.aiModel !== undefined) updateData.ai_model = payload.aiModel;
  if (payload.aiCustomUrl !== undefined) updateData.ai_custom_url = payload.aiCustomUrl;

  // Secrets: only overwrite when a non-empty value is provided. Empty string
  // in the form means "keep existing" — never accidentally blank a saved key.
  if (payload.aiApiKey !== undefined && payload.aiApiKey !== "") {
    updateData.ai_api_key = payload.aiApiKey;
  }
  if (payload.aiCustomAuthHeader !== undefined && payload.aiCustomAuthHeader !== "") {
    updateData.ai_custom_auth_header = payload.aiCustomAuthHeader;
  }

  const { data, error } = await supabase
    .from("organizations")
    .update(updateData)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Settings update failed.");
  return { organization: dbOrgToOrganization(data as OrganizationRow, user.email ?? "") };
}

export async function testAiProvider(payload: AiTestRequest): Promise<AiTestSuccess> {
  const res = await fetch("/api/settings/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "AI provider test failed");
  }
  return (await res.json()) as AiTestSuccess;
}
