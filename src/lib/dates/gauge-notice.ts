// Q11 soft-notice logic for the test-entry form. Non-blocking visual
// hints — never prevent a submit — so the helpers return booleans the
// form uses to decide whether to render a yellow callout.

// Days threshold for "your gauge calibration is stale." The user's
// feedback said ">12 months old" — 365d is close enough; no leap-year
// adjustment needed since this is an advisory hint, not a cert rule.
export const GAUGE_STALE_DAYS = 365;

// True when the caller's current-form gauge serial differs from the
// serial they used on their most recent submitted test. Only fires
// when all three inputs are set — blank-current, blank-last, or a
// match all mean "nothing to warn about."
export function isGaugeChanged(
  currentSerial: string,
  lastSerial: string | null | undefined,
): boolean {
  const cur = currentSerial.trim();
  const last = lastSerial?.trim() ?? "";
  if (cur === "") return false;
  if (last === "") return false;
  return cur !== last;
}

// True when the supplied YYYY-MM-DD calibration date is more than
// GAUGE_STALE_DAYS ago relative to `today`. Returns false for empty
// or malformed input — the form-level validator already catches
// malformed strings, and an empty date just suppresses the note.
export function isCalibrationStale(
  dateYmd: string,
  today: Date = new Date(),
  thresholdDays: number = GAUGE_STALE_DAYS,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return false;
  const [y, m, d] = dateYmd.split("-").map(Number);
  // Date.UTC sidesteps the DST hour that can turn a round calendar
  // diff into a 23h / 25h surprise. Same treatment deviceStatus uses.
  const calMs = Date.UTC(y, m - 1, d);
  const todayMs = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const diffDays = Math.floor((todayMs - calMs) / 86_400_000);
  return diffDays > thresholdDays;
}
