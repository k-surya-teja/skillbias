import { Schema, model, InferSchemaType } from "mongoose";

const organizationSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: "" },
    clerkUserId: { type: String, unique: true, sparse: true },
    logo: { type: String, default: "" },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    freeJobUsed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export type Organization = InferSchemaType<typeof organizationSchema> & { _id: string };
export const OrganizationModel = model("Organization", organizationSchema);
