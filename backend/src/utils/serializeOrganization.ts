// Structural type — we only read fields, so we don't need to bind to mongoose's
// hydrated document generic chain (which gets messy across re-exports).
type OrganizationLike = {
  _id: unknown;
  companyName: string;
  email: string;
  logo?: string;
  description?: string;
  website?: string;
  plan?: string;
  freeJobUsed?: boolean;
  subscriptionStatus?: string;
  currentPeriodEnd?: Date | null;
  autoShortlistEnabled?: boolean;
  autoShortlistThreshold?: number;
  autoRejectEnabled?: boolean;
  autoRejectThreshold?: number;
  defaultScoringWeights?: unknown;
  defaultJobIsPublic?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiCustomUrl?: string;
  aiCustomAuthHeader?: string;
};

/**
 * Single source of truth for what we send to the client when describing
 * an organization (used by login, signup, me, getSettings, updateSettings).
 *
 * Strips secrets (`password`, `aiApiKey`, `aiCustomAuthHeader`) and replaces
 * the latter two with boolean *Set flags so the UI can show "saved" placeholders
 * without ever round-tripping the secret value.
 */
export function serializeOrganization(
  org: OrganizationLike,
): Record<string, unknown> {
  return {
    id: org._id,
    _id: org._id,
    companyName: org.companyName,
    email: org.email,
    logo: org.logo,
    description: org.description,
    website: org.website,
    plan: org.plan,
    freeJobUsed: org.freeJobUsed,
    subscriptionStatus: org.subscriptionStatus,
    currentPeriodEnd: org.currentPeriodEnd,
    autoShortlistEnabled: org.autoShortlistEnabled,
    autoShortlistThreshold: org.autoShortlistThreshold,
    autoRejectEnabled: org.autoRejectEnabled,
    autoRejectThreshold: org.autoRejectThreshold,
    defaultScoringWeights: org.defaultScoringWeights,
    defaultJobIsPublic: org.defaultJobIsPublic,
    aiProvider: org.aiProvider,
    aiModel: org.aiModel,
    aiCustomUrl: org.aiCustomUrl,
    aiApiKeySet: Boolean(org.aiApiKey && org.aiApiKey.length > 0),
    aiCustomAuthHeaderSet: Boolean(
      org.aiCustomAuthHeader && org.aiCustomAuthHeader.length > 0,
    ),
  };
}
