import { describe, expect, it } from "vitest";
import { isOrganizationAllowedToCreateJob } from "./subscriptionService.js";

describe("subscription free-job policy", () => {
  it("allows first free job", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        freeJobUsed: false,
        plan: "free",
      }),
    ).toBe(true);
  });

  it("blocks second job for free plan", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        freeJobUsed: true,
        plan: "free",
      }),
    ).toBe(false);
  });

  it("allows second job for pro plan", () => {
    expect(
      isOrganizationAllowedToCreateJob({
        freeJobUsed: true,
        plan: "pro",
      }),
    ).toBe(true);
  });
});
