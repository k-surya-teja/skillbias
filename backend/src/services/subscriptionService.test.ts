import { describe, expect, it } from "vitest";
import { isOrganizationAllowedToCreateJob } from "./subscriptionService.js";

describe("subscription job-creation policy", () => {
  it("allows the first free job", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        plan: "free",
        freeJobUsed: false,
        activeJobs: 0,
      }),
    ).toBe(true);
  });

  it("blocks a second job on the free plan once the credit is used", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        plan: "free",
        freeJobUsed: true,
        activeJobs: 0,
      }),
    ).toBe(false);
  });

  it("allows starter plan up to 10 active jobs", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        plan: "starter",
        freeJobUsed: true,
        activeJobs: 9,
      }),
    ).toBe(true);
  });

  it("blocks starter plan at the 10th active job", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        plan: "starter",
        freeJobUsed: true,
        activeJobs: 10,
      }),
    ).toBe(false);
  });

  it("allows unlimited jobs on the pro plan", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        plan: "pro",
        freeJobUsed: true,
        activeJobs: 100,
      }),
    ).toBe(true);
  });
});
