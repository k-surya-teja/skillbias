import type { OrganizationRow } from "@/lib/supabase/types";
import type { Organization } from "./types";

// Translates a Postgres row from public.organizations into the camelCase
// Organization shape the rest of the frontend reads. Email comes from the
// Supabase auth user (organizations table doesn't store it — auth.users does).
export function dbOrgToOrganization(row: OrganizationRow, email: string): Organization {
  return {
    id: row.user_id,
    _id: row.user_id,
    companyName: row.company_name,
    email,
    logo: row.logo,
    description: row.description,
    website: row.website,
    plan: row.plan,
    freeJobUsed: row.free_job_used,
    autoShortlistEnabled: row.auto_shortlist_enabled,
    autoShortlistThreshold: row.auto_shortlist_threshold,
    autoRejectEnabled: row.auto_reject_enabled,
    autoRejectThreshold: row.auto_reject_threshold,
    defaultScoringWeights: row.default_scoring_weights,
    defaultJobIsPublic: row.default_job_is_public,
    subscriptionStatus: row.subscription_status,
    currentPeriodEnd: row.current_period_end,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    aiCustomUrl: row.ai_custom_url,
    aiApiKeySet: !!row.ai_api_key,
    aiCustomAuthHeaderSet: !!row.ai_custom_auth_header,
  };
}
