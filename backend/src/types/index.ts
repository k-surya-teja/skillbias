import { Request } from "express";

export type OrganizationJwtPayload = {
  orgId: string;
  email: string;
};

export type AuthenticatedRequest = Request & {
  organization?: OrganizationJwtPayload;
};

export type JobFormField = {
  label: string;
  type: "text" | "number" | "email" | "file" | "select" | "textarea" | "date";
  required: boolean;
  options?: string[];
};

export type JobScoringWeights = {
  skills: number;
  experience: number;
  format: number;
  answers: number;
};
