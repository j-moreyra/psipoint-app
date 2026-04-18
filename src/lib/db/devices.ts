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

// Status classification moved to src/lib/dates/due-status.ts in unit 6
// (Phase 3). Re-export kept out intentionally — callers import from
// @/lib/dates/due-status directly.
