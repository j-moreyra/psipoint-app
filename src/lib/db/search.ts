import { isUuid, type DbClient } from "@/lib/db/client";

// Phase 3 Q4. 2-char trigram queries on serial numbers return too much
// noise; names going through tsvector work fine at 2 chars. RLS company-
// scopes every branch so the helper doesn't need a companyId arg.
export const MIN_CHARS_NAME = 2;
export const MIN_CHARS_SERIAL = 3;

// pg_trgm similarity floor for device serial search. Effective floor is
// 0.3 regardless (the % operator in the RPC applies the default
// pg_trgm.similarity_threshold GUC on top). See migration 20260418010000
// for the full trade-off.
export const SERIAL_SIMILARITY_THRESHOLD = 0.3;

// Per-type limits match the blueprint §4 pseudocode. Customers are
// usually few; locations and devices get more headroom because property-
// managers with many buildings / many assemblies are the common case.
export const LIMIT_CUSTOMERS = 5;
export const LIMIT_LOCATIONS = 10;
export const LIMIT_DEVICES = 10;

const CUSTOMER_COLUMNS =
  "id, company_name, contact_first_name, contact_last_name, billing_city, billing_state" as const;

const SERVICE_LOCATION_COLUMNS =
  "id, nickname, address_line_1, city, customer_id, customers(company_name, contact_first_name, contact_last_name)" as const;

export type CustomerSearchRow = {
  id: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  billing_city: string | null;
  billing_state: string | null;
};

export type ServiceLocationSearchRow = {
  id: string;
  nickname: string | null;
  address_line_1: string;
  city: string;
  customer_id: string;
  customers: {
    company_name: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
  } | null;
};

// Shape mirrors the RETURNS TABLE from search_devices_by_serial. Kept
// hand-written so the search UI can consume without importing the
// Supabase Database types directly.
export type DeviceSearchRow = {
  device_id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  type: string;
  is_active: boolean;
  service_location_id: string;
  service_location_nickname: string | null;
  service_location_address_line_1: string;
  service_location_city: string;
  customer_id: string;
  customer_company_name: string | null;
  customer_contact_first_name: string | null;
  customer_contact_last_name: string | null;
  similarity_score: number;
};

export type UnifiedSearchResult = {
  customers: CustomerSearchRow[];
  serviceLocations: ServiceLocationSearchRow[];
  devices: DeviceSearchRow[];
};

const EMPTY: UnifiedSearchResult = {
  customers: [],
  serviceLocations: [],
  devices: [],
};

async function searchCustomers(
  db: DbClient,
  q: string,
): Promise<CustomerSearchRow[]> {
  if (q.length < MIN_CHARS_NAME) return [];
  const { data, error } = await db
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("is_active", true)
    .textSearch("search_vector", q, { type: "websearch" })
    .limit(LIMIT_CUSTOMERS);
  if (error) throw error;
  return data ?? [];
}

async function searchServiceLocations(
  db: DbClient,
  q: string,
): Promise<ServiceLocationSearchRow[]> {
  if (q.length < MIN_CHARS_NAME) return [];
  const { data, error } = await db
    .from("service_locations")
    .select(SERVICE_LOCATION_COLUMNS)
    .eq("is_active", true)
    .textSearch("search_vector", q, { type: "websearch" })
    .limit(LIMIT_LOCATIONS);
  if (error) throw error;
  return data ?? [];
}

async function searchDevices(
  db: DbClient,
  q: string,
): Promise<DeviceSearchRow[]> {
  if (q.length < MIN_CHARS_SERIAL) return [];
  const { data, error } = await db.rpc("search_devices_by_serial", {
    p_query: q,
    p_threshold: SERIAL_SIMILARITY_THRESHOLD,
    p_limit: LIMIT_DEVICES,
  });
  if (error) throw error;
  return data ?? [];
}

export async function unifiedSearch(
  db: DbClient,
  query: string,
): Promise<UnifiedSearchResult> {
  const q = query.trim();
  if (q.length === 0) return EMPTY;

  const [customers, serviceLocations, devices] = await Promise.all([
    searchCustomers(db, q),
    searchServiceLocations(db, q),
    searchDevices(db, q),
  ]);

  return { customers, serviceLocations, devices };
}

// Best-effort display label for a device row from the search. Prefers
// location nickname, falls back to address_line_1. UI uses this
// alongside `customer_company_name` to render the row context.
export function deviceSearchLocationLabel(d: {
  service_location_nickname: string | null;
  service_location_address_line_1: string;
}): string {
  return d.service_location_nickname?.trim() || d.service_location_address_line_1;
}

// Narrowing helper: customer_id round-trips through URL params, so
// callers validating a click-through target should confirm it's a UUID
// before composing a href.
export function isSearchableUuid(s: string): boolean {
  return isUuid(s);
}
