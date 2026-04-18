import { isUuid, type DbClient } from "@/lib/db/client";

const LIST_COLUMNS =
  "id, nickname, address_line_1, city, state, location_type, is_active" as const;

const DETAIL_COLUMNS =
  "id, customer_id, company_id, nickname, address_line_1, address_line_2, city, state, zip, location_type, on_site_contact_first_name, on_site_contact_last_name, on_site_contact_phone, on_site_contact_email, water_district, access_notes, hazard_type, latitude, longitude, is_active" as const;

export type ServiceLocationListRow = {
  id: string;
  nickname: string | null;
  address_line_1: string;
  city: string;
  state: string;
  location_type: string | null;
  is_active: boolean;
};

export type ServiceLocationDetailRow = ServiceLocationListRow & {
  customer_id: string;
  company_id: string;
  address_line_2: string | null;
  zip: string;
  on_site_contact_first_name: string | null;
  on_site_contact_last_name: string | null;
  on_site_contact_phone: string | null;
  on_site_contact_email: string | null;
  water_district: string | null;
  access_notes: string | null;
  hazard_type: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function listLocationsForCustomer(
  db: DbClient,
  customerId: string,
): Promise<ServiceLocationListRow[]> {
  if (!isUuid(customerId)) return [];
  const { data, error } = await db
    .from("service_locations")
    .select(LIST_COLUMNS)
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("nickname", { ascending: true, nullsFirst: false })
    .order("address_line_1", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getServiceLocation(
  db: DbClient,
  id: string,
): Promise<ServiceLocationDetailRow | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await db
    .from("service_locations")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Display label for a location row. Prefers nickname; falls back to
// address_line_1. Kept separate from customerDisplayName so the rules
// can diverge if the UX wants it.
export function serviceLocationDisplayName(l: {
  nickname: string | null;
  address_line_1: string;
}): string {
  return l.nickname && l.nickname.trim() !== ""
    ? l.nickname
    : l.address_line_1;
}
