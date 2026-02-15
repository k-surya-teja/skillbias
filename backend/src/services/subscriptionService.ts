import { OrganizationModel } from "../models/Organization.js";

export function isOrganizationAllowedToCreateJob(input: {
  freeJobUsed: boolean;
  plan: "free" | "pro";
}): boolean {
  if (!input.freeJobUsed) {
    return true;
  }

  return input.plan === "pro";
}

export async function canCreateJob(orgId: string): Promise<boolean> {
  const organization = await OrganizationModel.findById(orgId);
  if (!organization) {
    return false;
  }

  return isOrganizationAllowedToCreateJob({
    freeJobUsed: organization.freeJobUsed,
    plan: organization.plan,
  });
}

export async function markFreeJobUsed(orgId: string): Promise<void> {
  await OrganizationModel.findByIdAndUpdate(orgId, { freeJobUsed: true });
}
