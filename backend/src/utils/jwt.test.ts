import { describe, expect, it } from "vitest";
import { signOrganizationToken, verifyOrganizationToken } from "./jwt.js";

describe("JWT auth helpers", () => {
  it("signs and verifies organization tokens", () => {
    const token = signOrganizationToken({
      orgId: "org_123",
      email: "hiring@company.com",
    });
    const payload = verifyOrganizationToken(token);

    expect(payload.orgId).toBe("org_123");
    expect(payload.email).toBe("hiring@company.com");
  });
});
