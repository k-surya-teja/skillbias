import { JobModel } from "../models/Job.js";
import { OrganizationModel } from "../models/Organization.js";

type Plan = "free" | "starter" | "pro";

const PLAN_ACTIVE_JOB_LIMITS: Record<Plan, number | null> = {
  free: 1, // sticky: gated by freeJobUsed boolean instead of count
  starter: 10,
  pro: null, // unlimited
};

export async function canCreateJob(orgId: string): Promise<boolean> {
  const organization = await OrganizationModel.findById(orgId);
  if (!organization) return false;

  const plan = (organization.plan as Plan) ?? "free";

  // Free plan: one job ever (sticky boolean — not refunded on close/delete).
  if (plan === "free") {
    return !organization.freeJobUsed;
  }

  // Paid plans: gate by current active job count.
  const limit = PLAN_ACTIVE_JOB_LIMITS[plan];
  if (limit === null) return true;

  const activeJobs = await JobModel.countDocuments({ orgId, status: "active" });
  return activeJobs < limit;
}

export async function markFreeJobUsed(orgId: string): Promise<void> {
  // Only flip the free-job boolean for orgs still on the free plan.
  await OrganizationModel.findOneAndUpdate(
    { _id: orgId, plan: "free" },
    { freeJobUsed: true },
  );
}

export function getPlanJobLimit(plan: Plan): number | null {
  return PLAN_ACTIVE_JOB_LIMITS[plan];
}

// Pure helper kept for unit testing the policy without DB dependencies.
export function isOrganizationAllowedToCreateJob(input: {
  plan: Plan;
  freeJobUsed: boolean;
  activeJobs: number;
}): boolean {
  if (input.plan === "free") return !input.freeJobUsed;
  const limit = PLAN_ACTIVE_JOB_LIMITS[input.plan];
  if (limit === null) return true;
  return input.activeJobs < limit;
}
