import { Response } from "express";
import { z } from "zod";
import { OrganizationModel } from "../models/Organization.js";
import { AuthenticatedRequest } from "../types/index.js";
import {
  AiProviderError,
  SAMPLE_TEST_INPUT,
  scoreWithProvider,
  type AiScoringConfig,
} from "../services/aiScoringService.js";
import { serializeOrganization } from "../utils/serializeOrganization.js";

const scoringWeightsSchema = z
  .object({
    skills: z.number().int().min(0).max(100),
    experience: z.number().int().min(0).max(100),
    format: z.number().int().min(0).max(100),
    answers: z.number().int().min(0).max(100),
  })
  .refine((w) => w.skills + w.experience + w.format + w.answers === 100, {
    message: "Scoring weights must sum to 100",
  });

const updateSettingsSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120).optional(),
    description: z.string().max(2000).optional(),
    website: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || /^https?:\/\//i.test(v), {
        message: "Website must start with http:// or https://",
      })
      .optional(),
    logo: z.string().max(2_000_000).optional(),

    autoShortlistEnabled: z.boolean().optional(),
    autoShortlistThreshold: z.number().int().min(0).max(100).optional(),
    autoRejectEnabled: z.boolean().optional(),
    autoRejectThreshold: z.number().int().min(0).max(100).optional(),

    defaultScoringWeights: scoringWeightsSchema.optional(),
    defaultJobIsPublic: z.boolean().optional(),

    aiProvider: z.enum(["skillbias", "anthropic", "openai", "groq", "custom"]).optional(),
    aiModel: z.string().trim().max(120).optional(),
    aiApiKey: z.string().trim().max(500).optional(),
    aiCustomUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^https?:\/\//i.test(v), {
        message: "Custom URL must start with http:// or https://",
      })
      .optional(),
    aiCustomAuthHeader: z.string().trim().max(500).optional(),
  })
  .strict();

const testAiSchema = z.object({
  provider: z.enum(["skillbias", "anthropic", "openai", "groq", "custom"]),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  customUrl: z.string().optional(),
  customAuthHeader: z.string().optional(),
});

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const organization = await OrganizationModel.findById(orgId).select("-password");
  if (!organization) {
    res.status(404).json({ message: "Organization not found" });
    return;
  }
  res.json({ organization: serializeOrganization(organization) });
}

export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = updateSettingsSchema.parse(req.body);

  // Cross-field check: when both auto rules are enabled, shortlist threshold must exceed reject threshold.
  if (
    payload.autoShortlistEnabled &&
    payload.autoRejectEnabled &&
    payload.autoShortlistThreshold !== undefined &&
    payload.autoRejectThreshold !== undefined &&
    payload.autoShortlistThreshold <= payload.autoRejectThreshold
  ) {
    res.status(400).json({
      message: "Auto-shortlist threshold must be greater than auto-reject threshold",
    });
    return;
  }

  // Preserve existing secrets when the client sends an empty string —
  // the UI never re-displays them, so an empty submit means "no change".
  const sanitized: Record<string, unknown> = { ...payload };
  if (payload.aiApiKey !== undefined && payload.aiApiKey === "") {
    delete sanitized.aiApiKey;
  }
  if (payload.aiCustomAuthHeader !== undefined && payload.aiCustomAuthHeader === "") {
    delete sanitized.aiCustomAuthHeader;
  }

  const updated = await OrganizationModel.findByIdAndUpdate(orgId, sanitized, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updated) {
    res.status(404).json({ message: "Organization not found" });
    return;
  }

  res.json({ organization: serializeOrganization(updated) });
}

export async function testAiProvider(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const orgId = req.organization?.orgId;
  if (!orgId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const payload = testAiSchema.parse(req.body);
  const config: AiScoringConfig = {
    provider: payload.provider,
    model: payload.model ?? "",
    apiKey: payload.apiKey ?? "",
    customUrl: payload.customUrl ?? "",
    customAuthHeader: payload.customAuthHeader ?? "",
  };

  try {
    const start = Date.now();
    const result = await scoreWithProvider(config, SAMPLE_TEST_INPUT);
    res.json({
      ok: true,
      latencyMs: Date.now() - start,
      sampleScore: result.score,
      sampleFeedback: result.feedback,
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      // Surface the real provider error so the org can fix it (bad key, wrong model, etc.)
      res.status(400).json({
        ok: false,
        provider: err.provider,
        message: err.message, // already includes "<Provider> returned an error: ..."
        originalMessage: err.originalMessage,
        status: err.status ?? null,
      });
      return;
    }
    throw err;
  }
}
