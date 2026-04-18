import { isUuid, type DbClient } from "@/lib/db/client";

// Row selected for a device's test history panel. Joins the tester so
// each row can render "date · pass/fail · initials · notes snippet"
// without a second round-trip. RLS filters testers to the caller's
// company, so the nested object is safe to trust.
//
// `testers!tester_id` hint: test_results has TWO FKs to testers
// (tester_id + reviewed_by for the v2 review workflow), so PostgREST
// refuses to auto-embed. The column-name hint pins the join to the
// "who ran the test" side.
const DEVICE_HISTORY_COLUMNS =
  "id, test_date, result, retest_result, notes, tester_id, testers!tester_id(first_name, last_name)" as const;

export type TestResultDeviceRow = {
  id: string;
  test_date: string;
  result: string;
  retest_result: string | null;
  notes: string | null;
  tester_id: string;
  testers: { first_name: string; last_name: string } | null;
};

// Row for the dashboard "Recent tests" card. Joined device + customer
// gives each row enough context to be meaningful on a flat list
// ("Acme Property — BF-001 — Pass").
const RECENT_COLUMNS =
  "id, test_date, result, retest_result, device_id, customer_id, devices(serial_number, manufacturer, model), customers(company_name, contact_first_name, contact_last_name)" as const;

export type TestResultRecentRow = {
  id: string;
  test_date: string;
  result: string;
  retest_result: string | null;
  device_id: string;
  customer_id: string;
  devices: {
    serial_number: string;
    manufacturer: string;
    model: string;
  } | null;
  customers: {
    company_name: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
  } | null;
};

// Narrow row for the gauge-change soft notice on the test form (Q11).
// Pulls only what the check needs: the tester's last-used gauge serial
// and calibration date.
const MOST_RECENT_GAUGE_COLUMNS =
  "id, test_date, test_gauge_serial, test_gauge_calibration_date" as const;

export type MostRecentTesterTest = {
  id: string;
  test_date: string;
  test_gauge_serial: string;
  test_gauge_calibration_date: string | null;
};

export async function listTestsForDevice(
  db: DbClient,
  deviceId: string,
  limit = 20,
): Promise<TestResultDeviceRow[]> {
  if (!isUuid(deviceId)) return [];
  const { data, error } = await db
    .from("test_results")
    .select(DEVICE_HISTORY_COLUMNS)
    .eq("device_id", deviceId)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentTests(
  db: DbClient,
  limit = 10,
): Promise<TestResultRecentRow[]> {
  const { data, error } = await db
    .from("test_results")
    .select(RECENT_COLUMNS)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Returns the caller's most recent test (across all devices) so the
// form can flag "Last test used gauge X. Still correct?" when the
// currently-selected gauge differs. Null when the tester has no tests
// yet — in which case the form offers no soft notice.
export async function getMostRecentTesterTest(
  db: DbClient,
  testerId: string,
): Promise<MostRecentTesterTest | null> {
  if (!isUuid(testerId)) return null;
  const { data, error } = await db
    .from("test_results")
    .select(MOST_RECENT_GAUGE_COLUMNS)
    .eq("tester_id", testerId)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Display label for a joined tester row (e.g. on device history). Falls
// back to "Unknown" if the join unexpectedly comes back null — the
// history should still render even if one tester row goes missing.
export function testerDisplayInitials(
  t: { first_name: string; last_name: string } | null,
): string {
  if (!t) return "—";
  const f = t.first_name?.[0]?.toUpperCase() ?? "";
  const l = t.last_name?.[0]?.toUpperCase() ?? "";
  return (f + l) || "—";
}
