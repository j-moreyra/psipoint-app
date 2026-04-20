import { describe, it, expect } from "vitest";
import { licenseWarning } from "./license-warning";

// Anchor "today" so the tests read like a narrative rather than
// threading Date.now() through every case.
const TODAY = new Date(2026, 3, 19); // 2026-04-19 local

function ymdPlus(days: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("licenseWarning", () => {
  it("returns null for no expiration date", () => {
    expect(licenseWarning(null, TODAY)).toBeNull();
    expect(licenseWarning(undefined, TODAY)).toBeNull();
    expect(licenseWarning("", TODAY)).toBeNull();
  });

  it("returns null for malformed dates", () => {
    expect(licenseWarning("2026/04/19", TODAY)).toBeNull();
    expect(licenseWarning("not-a-date", TODAY)).toBeNull();
    expect(licenseWarning("2026-4-19", TODAY)).toBeNull();
  });

  it("returns null for > 90 days out", () => {
    expect(licenseWarning(ymdPlus(120), TODAY)).toBeNull();
    expect(licenseWarning(ymdPlus(91), TODAY)).toBeNull();
  });

  it("returns info at exactly 90 days", () => {
    const w = licenseWarning(ymdPlus(90), TODAY);
    expect(w).not.toBeNull();
    expect(w?.level).toBe("info");
    expect(w?.daysLeft).toBe(90);
  });

  it("returns info in 61–90 range", () => {
    expect(licenseWarning(ymdPlus(75), TODAY)?.level).toBe("info");
    expect(licenseWarning(ymdPlus(61), TODAY)?.level).toBe("info");
  });

  it("returns warn at exactly 60 days", () => {
    const w = licenseWarning(ymdPlus(60), TODAY);
    expect(w?.level).toBe("warn");
    expect(w?.daysLeft).toBe(60);
  });

  it("returns warn in 31–60 range", () => {
    expect(licenseWarning(ymdPlus(45), TODAY)?.level).toBe("warn");
    expect(licenseWarning(ymdPlus(31), TODAY)?.level).toBe("warn");
  });

  it("returns urgent at exactly 30 days", () => {
    const w = licenseWarning(ymdPlus(30), TODAY);
    expect(w?.level).toBe("urgent");
    expect(w?.daysLeft).toBe(30);
  });

  it("returns urgent in 1–30 range", () => {
    expect(licenseWarning(ymdPlus(15), TODAY)?.level).toBe("urgent");
    expect(licenseWarning(ymdPlus(1), TODAY)?.level).toBe("urgent");
  });

  it("returns expired on the day of expiration", () => {
    const w = licenseWarning(ymdPlus(0), TODAY);
    expect(w?.level).toBe("expired");
    expect(w?.daysLeft).toBe(0);
  });

  it("returns expired for past dates with a negative daysLeft", () => {
    const w = licenseWarning(ymdPlus(-10), TODAY);
    expect(w?.level).toBe("expired");
    expect(w?.daysLeft).toBe(-10);
  });

  it("carries the original expiration string through", () => {
    const w = licenseWarning(ymdPlus(45), TODAY);
    expect(w?.expirationYmd).toBe(ymdPlus(45));
  });
});
