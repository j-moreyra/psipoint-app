import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("returns fallback when candidate is null", () => {
    expect(safeNextPath(null, "/dashboard")).toBe("/dashboard");
  });

  it("returns fallback when candidate is undefined", () => {
    expect(safeNextPath(undefined, "/dashboard")).toBe("/dashboard");
  });

  it("returns fallback when candidate is empty", () => {
    expect(safeNextPath("", "/dashboard")).toBe("/dashboard");
  });

  it("accepts a simple relative path", () => {
    expect(safeNextPath("/customers", "/dashboard")).toBe("/customers");
  });

  it("accepts a relative path with query string", () => {
    expect(safeNextPath("/customers?q=acme", "/dashboard")).toBe(
      "/customers?q=acme",
    );
  });

  it("rejects protocol-relative URL (open redirect)", () => {
    expect(safeNextPath("//evil.com/phish", "/dashboard")).toBe("/dashboard");
  });

  it("rejects absolute https URL", () => {
    expect(safeNextPath("https://evil.com/phish", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects javascript: scheme", () => {
    expect(safeNextPath("javascript:alert(1)", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects a path with no leading slash", () => {
    expect(safeNextPath("customers", "/dashboard")).toBe("/dashboard");
  });
});
