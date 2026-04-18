// Phase 3 Q5. Commercial customers need ~2 weeks lead time to schedule,
// so a 30-day due-soon window surfaces things the tester can't actually
// act on yet. 60 days buys enough runway for coordination.
//
// Phase 5: expose this as a per-company setting in /settings/company
// alongside next_due_calculation_method — some utilities / tester shops
// will want to tune it. Until then, one constant is the contract.
export const DUE_SOON_WINDOW_DAYS = 60;

export type DeviceStatus =
  | "never_tested"
  | "overdue"
  | "due_soon"
  | "current";

// Minimal shape consumed by every helper in this module. Widening to
// `Pick<DeviceListRow, ...>` would pull db types into a pure date
// utility — kept structural so search rows, dashboard rows, detail
// rows, test-entry pickers all compose the same check.
export type DueStatusInput = {
  last_tested_date: string | null;
  next_test_due_date: string | null;
  next_due_override: string | null;
};

// Format a Date as "YYYY-MM-DD" anchored to the tester's local wall
// clock (not UTC). DB date columns are pure calendar dates, so lining
// up Date.now() to the caller's local date avoids "due tomorrow" vs
// "due today" flips around midnight UTC.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Calendar-day delta between two "YYYY-MM-DD" strings. Uses Date.UTC
// on the parts to sidestep the local-timezone DST boundary that can
// otherwise turn 24h into 23h or 25h.
function diffCalendarDays(aYmd: string, bYmd: string): number {
  const [ay, am, ad] = aYmd.split("-").map(Number);
  const [by, bm, bd] = bYmd.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000,
  );
}

export function deviceStatus(
  d: DueStatusInput,
  today: Date = new Date(),
  windowDays: number = DUE_SOON_WINDOW_DAYS,
): DeviceStatus {
  if (!d.last_tested_date) return "never_tested";

  const dueStr = d.next_due_override ?? d.next_test_due_date;
  if (!dueStr) return "current"; // tested but no due date — treat as ok

  const todayStr = toLocalDateStr(today);

  // Lexical compare works on ISO "YYYY-MM-DD" strings. No Date parsing,
  // no time-of-day quirks.
  if (dueStr < todayStr) return "overdue";

  const diffDays = diffCalendarDays(dueStr, todayStr);
  if (diffDays <= windowDays) return "due_soon";
  return "current";
}

export function isOverdue(d: DueStatusInput, today?: Date): boolean {
  return deviceStatus(d, today) === "overdue";
}

export function isDueSoon(
  d: DueStatusInput,
  today?: Date,
  windowDays?: number,
): boolean {
  return deviceStatus(d, today, windowDays) === "due_soon";
}

export type DueStatusBuckets<T> = {
  overdue: T[];
  dueSoon: T[];
  current: T[];
  neverTested: T[];
};

// Sort a list into status buckets in one pass. Dashboard's Overdue +
// Due Soon cards (unit 16) read from these buckets directly.
export function bucketByDueStatus<T extends DueStatusInput>(
  devices: T[],
  today?: Date,
  windowDays?: number,
): DueStatusBuckets<T> {
  const out: DueStatusBuckets<T> = {
    overdue: [],
    dueSoon: [],
    current: [],
    neverTested: [],
  };
  for (const d of devices) {
    const s = deviceStatus(d, today, windowDays);
    if (s === "overdue") out.overdue.push(d);
    else if (s === "due_soon") out.dueSoon.push(d);
    else if (s === "current") out.current.push(d);
    else out.neverTested.push(d);
  }
  return out;
}
