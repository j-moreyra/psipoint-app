import { describe, it, expect } from "vitest";
import {
  DRAFT_SCHEMA_VERSION,
  DRAFT_STALE_MS,
  isDraftStale,
  testDraftKey,
} from "./draft-keys";

describe("testDraftKey", () => {
  it("builds a deterministic key from a device id", () => {
    expect(testDraftKey("abc-123")).toBe(
      `backflo:draft:test:v${DRAFT_SCHEMA_VERSION}:abc-123`,
    );
  });

  it("embeds the schema version so bumps invalidate old drafts", () => {
    const key = testDraftKey("x");
    expect(key).toContain(`v${DRAFT_SCHEMA_VERSION}`);
  });

  it("throws on empty device id so callers don't share a global key", () => {
    expect(() => testDraftKey("")).toThrow();
  });

  it("distinguishes different devices", () => {
    expect(testDraftKey("a")).not.toBe(testDraftKey("b"));
  });
});

describe("isDraftStale", () => {
  const NOW = 1_800_000_000_000;

  it("returns false for fresh drafts", () => {
    expect(isDraftStale(NOW - 1000, NOW)).toBe(false);
    expect(isDraftStale(NOW - DRAFT_STALE_MS + 1, NOW)).toBe(false);
  });

  it("returns true once past the TTL", () => {
    expect(isDraftStale(NOW - DRAFT_STALE_MS - 1, NOW)).toBe(true);
    expect(isDraftStale(NOW - DRAFT_STALE_MS * 10, NOW)).toBe(true);
  });

  it("treats zero / negative / NaN savedAt as stale (corrupt entry)", () => {
    expect(isDraftStale(0, NOW)).toBe(true);
    expect(isDraftStale(-1, NOW)).toBe(true);
    expect(isDraftStale(Number.NaN, NOW)).toBe(true);
  });

  it("handles savedAt in the future as fresh (clock skew is not stale)", () => {
    expect(isDraftStale(NOW + 10_000, NOW)).toBe(false);
  });
});
