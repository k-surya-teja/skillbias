import { Schema, model, InferSchemaType } from "mongoose";
import { JobFormField, JobScoringWeights } from "../types/index.js";

const formFieldSchema = new Schema<JobFormField>(
  {
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["text", "number", "email", "file", "select", "textarea", "date"],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  },
  { _id: false },
);

const scoringWeightsSchema = new Schema<JobScoringWeights>(
  {
    skills: { type: Number, default: 40 },
    experience: { type: Number, default: 25 },
    format: { type: Number, default: 15 },
    answers: { type: Number, default: 20 },
  },
  { _id: false },
);

const jobSchema = new Schema(
  {
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: { type: String, default: "", trim: true },
    requiredSkills: [{ type: String, trim: true }],
    postingDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    formFields: { type: [formFieldSchema], default: [] },
    scoringWeights: { type: scoringWeightsSchema, default: () => ({}) },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    applyLink: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export type Job = InferSchemaType<typeof jobSchema> & { _id: string };
export const JobModel = model("Job", jobSchema);
