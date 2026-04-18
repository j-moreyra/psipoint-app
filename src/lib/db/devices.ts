import { isUuid, type DbClient } from "@/lib/db/client";

const LIST_COLUMNS =
  "id, serial_number, manufacturer, model, size, type, location_description, last_tested_date, last_test_result, next_test_due_date, next_due_override, is_active" as const;

const DETAIL_COLUMNS =
  "id, service_location_id, customer_id, company_id, serial_number, manufacturer, model, size, type, location_description, install_date, service_type, last_tested_date, last_test_result, next_test_due_date, next_due_override, is_active" as const;

export type DeviceListRow = {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  size: string;
  type: string;
  location_description: string;
  last_tested_date: string | null;
  last_test_result: string | null;
  next_test_due_date: string | null;
  next_due_override: string | null;
  is_active: boolean;
};

export type DeviceDetailRow = DeviceListRow & {
  service_location_id: string;
  customer_id: string;
  company_id: string;
  install_date: string | null;
  service_type: string | null;
};

export async function listDevicesForLocation(
  db: DbClient,
  serviceLocationId: string,
): Promise<DeviceListRow[]> {
  if (!isUuid(serviceLocationId)) return [];
  const { data, error } = await db
    .from("devices")
    .select(LIST_COLUMNS)
    .eq("service_location_id", serviceLocationId)
    .eq("is_active", true)
    .order("serial_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getDevice(
  db: DbClient,
  id: string,
): Promise<DeviceDetailRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db
    .from("devices")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Status classification for the per-location device list.
// Due-date columns get maintained by the update_device_last_tested trigger
// on test insert; next_due_override wins if set.
export type DeviceStatus =
  | "never_tested"
  | "overdue"
  | "due_soon"
  | "current";

// Format a Date as a tester-local "YYYY-MM-DD" string — used to line up
// Date.now() with the DB's date columns, which are pure calendar dates
// (no time-of-day). Using the Date object's getters rather than
// toISOString() keeps the answer anchored to the tester's wall clock,
// not UTC.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function deviceStatus(
  d: Pick<DeviceListRow, "last_tested_date" | "next_test_due_date" | "next_due_override">,
  today: Date = new Date(),
): DeviceStatus {
  if (!d.last_tested_date) return "never_tested";

  const dueStr = d.next_due_override ?? d.next_test_due_date;
  if (!dueStr) return "current"; // tested but no due date — treat as ok

  const todayStr = toLocalDateStr(today);

  // Overdue: lexical comparison works because both strings are
  // ISO-like "YYYY-MM-DD" — no Date parsing, no time-of-day quirks.
  if (dueStr < todayStr) return "overdue";

  // Day delta via Date.UTC on the date parts. Date.UTC ignores
  // timezone so we get a pure calendar-day diff regardless of where
  // the tester's machine thinks it is.
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [dy, dm, dd] = dueStr.split("-").map(Number);
  const diffDays = Math.round(
    (Date.UTC(dy, dm - 1, dd) - Date.UTC(ty, tm - 1, td)) / 86_400_000,
  );

  if (diffDays <= 30) return "due_soon";
  return "current";
}
