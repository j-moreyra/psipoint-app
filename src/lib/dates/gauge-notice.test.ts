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
});
