import { Schema, model, InferSchemaType } from "mongoose";

const defaultScoringWeightsSchema = new Schema(
  {
    skills: { type: Number, default: 40, min: 0, max: 100 },
    experience: { type: Number, default: 25, min: 0, max: 100 },
    format: { type: Number, default: 15, min: 0, max: 100 },
    answers: { type: Number, default: 20, min: 0, max: 100 },
  },
  { _id: false },
);

const organizationSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: "" },
    googleId: { type: String, unique: true, sparse: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },
    plan: { type: String, enum: ["free", "starter", "pro"], default: "free" },
    freeJobUsed: { type: Boolean, default: false },
    subscriptionStatus: {
      type: String,
      enum: ["active", "canceled", "trialing", "past_due", "none"],
      default: "none",
    },
    currentPeriodEnd: { type: Date, default: null },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },

    // Hiring automation
    autoShortlistEnabled: { type: Boolean, default: false },
    autoShortlistThreshold: { type: Number, default: 80, min: 0, max: 100 },
    autoRejectEnabled: { type: Boolean, default: false },
    autoRejectThreshold: { type: Number, default: 30, min: 0, max: 100 },

    // New job defaults
    defaultScoringWeights: { type: defaultScoringWeightsSchema, default: () => ({}) },
    defaultJobIsPublic: { type: Boolean, default: false },

    // AI scoring provider (per-org). When provider === "skillbias" we use the
    // built-in Groq key; for "anthropic" / "openai" the org supplies their own
    // API key + model; "custom" hits an arbitrary endpoint with an Authorization header.
    // SECURITY NOTE: aiApiKey is stored as plaintext for now. Encrypt at rest before
    // shipping to real customers (KMS-derived key, AES-GCM, etc.).
    aiProvider: {
      type: String,
      enum: ["skillbias", "anthropic", "openai", "groq", "custom"],
      default: "skillbias",
    },
    aiModel: { type: String, default: "" },
    aiApiKey: { type: String, default: "" },
    aiCustomUrl: { type: String, default: "" },
    aiCustomAuthHeader: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export type Organization = InferSchemaType<typeof organizationSchema> & { _id: string };
export const OrganizationModel = model("Organization", organizationSchema);
