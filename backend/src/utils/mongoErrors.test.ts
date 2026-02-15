import { describe, expect, it } from "vitest";
import { isDuplicateKeyError } from "./mongoErrors.js";

describe("mongo duplicate key errors", () => {
  it("detects duplicate key error code 11000", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });

  it("ignores non-duplicate errors", () => {
    expect(isDuplicateKeyError({ code: 500 })).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
