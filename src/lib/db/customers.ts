import type { DbClient } from "@/lib/db/client";

// Columns selected for list views. Keep the shape narrow — the list
// renders names + city + a per-row link only.
const CUSTOMER_LIST_COLUMNS =
  "id, company_name, contact_first_name, contact_last_name, billing_city, billing_state, is_active";

// Full columns for the detail + edit forms.
const CUSTOMER_DETAIL_COLUMNS =
  "id, company_name, contact_first_name, contact_last_name, email, phone, billing_address_line_1, billing_address_line_2, billing_city, billing_state, billing_zip, notes, is_active";

export type CustomerListRow = {
  id: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  billing_city: string | null;
  billing_state: string | null;
  is_active: boolean;
};

export type CustomerDetailRow = CustomerListRow & {
  email: string | null;
  phone: string | null;
  billing_address_line_1: string | null;
  billing_address_line_2: string | null;
  billing_zip: string | null;
  notes: string | null;
};

export async function listCustomers(db: DbClient): Promise<CustomerListRow[]> {
  const { data, error } = await db
    .from("customers")
    .select(CUSTOMER_LIST_COLUMNS)
    .eq("is_active", true)
    .order("company_name", { ascending: true, nullsFirst: false })
    .order("contact_last_name", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getCustomer(
  db: DbClient,
  id: string,
): Promise<CustomerDetailRow | null> {
  const { data, error } = await db
    .from("customers")
    .select(CUSTOMER_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Display name preference: company_name > "first last" > "last" > "first".
// Consumers use this for list rows and breadcrumbs.
export function customerDisplayName(c: {
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
}): string {
  if (c.company_name) return c.company_name;
  const full = [c.contact_first_name, c.contact_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || "Unnamed customer";
}
