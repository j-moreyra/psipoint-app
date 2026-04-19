import { describe, expect, it } from "vitest";
import {
  GAUGE_STALE_DAYS,
  isCalibrationStale,
  isGaugeChanged,
} from "./gauge-notice";

const TODAY = new Date("2026-04-18T12:00:00");

describe("GAUGE_STALE_DAYS", () => {
  it("defaults to 365 days (Q11 >12 months)", () => {
    expect(GAUGE_STALE_DAYS).toBe(365);
  });
});

describe("isGaugeChanged", () => {
  it("true when current differs from last", () => {
    expect(isGaugeChanged("NEW-GAUGE", "OLD-GAUGE")).toBe(true);
  });

  it("false when they match", () => {
    expect(isGaugeChanged("G-123", "G-123")).toBe(false);
  });

  it("false when current is empty (no basis to warn)", () => {
    expect(isGaugeChanged("", "OLD-GAUGE")).toBe(false);
  });

  it("false when last is null (first test ever)", () => {
    expect(isGaugeChanged("NEW-GAUGE", null)).toBe(false);
  });

  it("false when last is undefined", () => {
    expect(isGaugeChanged("NEW-GAUGE", undefined)).toBe(false);
  });

  it("false when last is empty string", () => {
    expect(isGaugeChanged("NEW-GAUGE", "")).toBe(false);
  });

  it("trims whitespace before comparing", () => {
    expect(isGaugeChanged("  G-123  ", "G-123")).toBe(false);
  });

  it("trims both sides", () => {
    expect(isGaugeChanged("  G-123  ", "  G-123  ")).toBe(false);
  });

  it("trimmed current that collapses to empty suppresses the note", () => {
    expect(isGaugeChanged("   ", "OLD-GAUGE")).toBe(false);
  });

  it("trimmed last that collapses to empty suppresses the note", () => {
    expect(isGaugeChanged("NEW-GAUGE", "   ")).toBe(false);
  });

  it("is case-sensitive (G-1 ≠ g-1)", () => {
    // Gauge serials are printed with fixed casing — case differences
    // typically mean a typo, and we'd rather surface the warning.
    expect(isGaugeChanged("G-1", "g-1")).toBe(true);
  });

  it("preserves internal whitespace in the comparison", () => {
    // Internal whitespace isn't trimmed — only leading/trailing. A
    // stray internal space means a typo; the soft notice catches it.
    expect(isGaugeChanged("G 1", "G1")).toBe(true);
  });
});

describe("isCalibrationStale", () => {
  it("false for empty input (suppresses the note)", () => {
    expect(isCalibrationStale("", TODAY)).toBe(false);
  });

  it("false for malformed date", () => {
    expect(isCalibrationStale("nope", TODAY)).toBe(false);
  });

  it("false for today", () => {
    expect(isCalibrationStale("2026-04-18", TODAY)).toBe(false);
  });

  it("false at exactly 365 days ago (boundary not yet stale)", () => {
    expect(isCalibrationStale("2025-04-18", TODAY)).toBe(false);
  });

  it("true at 366 days ago (just over)", () => {
    expect(isCalibrationStale("2025-04-17", TODAY)).toBe(true);
  });

  it("true for a years-old date", () => {
    expect(isCalibrationStale("2020-01-01", TODAY)).toBe(true);
  });

  it("false for a future calibration (treat as fresh)", () => {
    expect(isCalibrationStale("2027-01-01", TODAY)).toBe(false);
  });

  it("respects a custom threshold", () => {
    // 45 days ago — stale at a 30d threshold, fresh at the default 365.
    expect(isCalibrationStale("2026-03-04", TODAY)).toBe(false);
    expect(isCalibrationStale("2026-03-04", TODAY, 30)).toBe(true);
  });

  it("threshold of 0 → anything before today is stale", () => {
    expect(isCalibrationStale("2026-04-17", TODAY, 0)).toBe(true);
    // today itself is not yet stale at a 0 threshold (0 > 0 is false)
    expect(isCalibrationStale("2026-04-18", TODAY, 0)).toBe(false);
  });

  it("rejects month-first MM/DD/YYYY (malformed at this layer)", () => {
    expect(isCalibrationStale("04/18/2025", TODAY)).toBe(false);
  });

  it("rejects single-digit month (YYYY-M-DD malformed)", () => {
    expect(isCalibrationStale("2025-4-18", TODAY)).toBe(false);
  });

  it("crosses a leap-year boundary without the extra day tripping the check", () => {
    // From 2025-04-18 to 2026-04-18 is exactly 365 real days; a leap
    // day somewhere in the span would throw a naive 365-day floor off
    // by one if we were doing wall-clock math. Date.UTC keeps us honest.
    expect(isCalibrationStale("2025-04-18", TODAY)).toBe(false);
    expect(isCalibrationStale("2025-04-17", TODAY)).toBe(true);
  });

  it("defaults today to new Date() when not supplied", () => {
    // Far-past date is always stale regardless of now() — just prove
    // the default parameter doesn't crash.
    expect(isCalibrationStale("1990-01-01")).toBe(true);
  });
});
