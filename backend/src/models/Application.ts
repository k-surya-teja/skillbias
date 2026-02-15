import { Schema, model, InferSchemaType } from "mongoose";

const applicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    answers: { type: Schema.Types.Mixed, default: {} },
    resumeUrl: { type: String, required: true },
    resumeAnalysis: { type: Schema.Types.Mixed, default: {} },
    score: { type: Number, default: 0 },
    aiFeedback: { type: String, default: "" },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "rejected", "pending"],
      default: "pending",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

applicationSchema.index({ jobId: 1, email: 1 }, { unique: true });

export type Application = InferSchemaType<typeof applicationSchema> & { _id: string };
export const ApplicationModel = model("Application", applicationSchema);
