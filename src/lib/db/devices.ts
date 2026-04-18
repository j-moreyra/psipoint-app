import type { DbClient } from "@/lib/db/client";

const LIST_COLUMNS =
  "id, serial_number, manufacturer, model, size, type, location_description, last_tested_date, last_test_result, next_test_due_date, next_due_override, is_active";

const DETAIL_COLUMNS =
  "id, service_location_id, customer_id, company_id, serial_number, manufacturer, model, size, type, location_description, install_date, service_type, last_tested_date, last_test_result, next_test_due_date, next_due_override, is_active";

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

export function deviceStatus(
  d: Pick<DeviceListRow, "last_tested_date" | "next_test_due_date" | "next_due_override">,
  today: Date = new Date(),
): DeviceStatus {
  if (!d.last_tested_date) return "never_tested";

  const dueStr = d.next_due_override ?? d.next_test_due_date;
  if (!dueStr) return "current"; // tested but no due date — treat as ok

  const due = new Date(dueStr + "T00:00:00");
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays <= 30) return "due_soon";
  return "current";
}
