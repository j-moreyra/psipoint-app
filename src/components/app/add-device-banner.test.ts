import { describe, expect, it } from "vitest";
import { buildReturnToQuery } from "./add-device-banner";

describe("buildReturnToQuery", () => {
  it("returns empty string when both args undefined", () => {
    expect(buildReturnToQuery(undefined, undefined)).toBe("");
  });

  it("returnTo only", () => {
    expect(buildReturnToQuery("/tests/new", undefined)).toBe(
      "?returnTo=%2Ftests%2Fnew",
    );
  });

  it("serial only", () => {
    expect(buildReturnToQuery(undefined, "BF-42")).toBe("?serial=BF-42");
  });

  it("both set", () => {
    expect(buildReturnToQuery("/tests/new", "BF-42")).toBe(
      "?returnTo=%2Ftests%2Fnew&serial=BF-42",
    );
  });

  it("preserves order: returnTo before serial", () => {
    // Q13 flow reads both params downstream; deterministic order keeps
    // server-rendered URLs cache-friendly.
    const q = buildReturnToQuery("/a", "s");
    const returnToIdx = q.indexOf("returnTo");
    const serialIdx = q.indexOf("serial");
    expect(returnToIdx).toBeGreaterThan(-1);
    expect(serialIdx).toBeGreaterThan(returnToIdx);
  });

  it("url-encodes the returnTo path (slashes, query chars)", () => {
    expect(
      buildReturnToQuery("/tests/new?x=1", "BF-42"),
    ).toBe("?returnTo=%2Ftests%2Fnew%3Fx%3D1&serial=BF-42");
  });

  it("url-encodes serials with special chars", () => {
    expect(buildReturnToQuery(undefined, "A B+C")).toBe("?serial=A+B%2BC");
  });

  it("empty-string returnTo is treated as not-set (no key emitted)", () => {
    expect(buildReturnToQuery("", "BF-42")).toBe("?serial=BF-42");
  });

  it("empty-string serial is treated as not-set (no key emitted)", () => {
    expect(buildReturnToQuery("/tests/new", "")).toBe("?returnTo=%2Ftests%2Fnew");
  });

  it("both empty strings → empty string output", () => {
    expect(buildReturnToQuery("", "")).toBe("");
  });

  it("starts with a single '?' when any param is present", () => {
    expect(buildReturnToQuery("/a", undefined).startsWith("?")).toBe(true);
    expect(buildReturnToQuery(undefined, "s").startsWith("?")).toBe(true);
    expect(buildReturnToQuery("/a", "s").startsWith("?")).toBe(true);
  });
});
