import { describe, expect, it } from "vitest";
import { isUuid } from "./client";

describe("isUuid", () => {
  it("accepts a canonical v4 uuid", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects missing dashes", () => {
    expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-44665544000z")).toBe(false);
  });

  it("rejects short strings", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isUuid("")).toBe(false);
  });

  it("rejects strings with trailing garbage", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000 ")).toBe(false);
  });
});
