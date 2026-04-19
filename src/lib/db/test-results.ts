import { isUuid, type DbClient } from "@/lib/db/client";
import type {
  BuildCertificateDataInput,
  CompanyRow,
  CustomerRow,
  DeviceRow,
  ServiceLocationRow,
  TesterRow,
  TestResultRow,
} from "@/lib/pdf/certificate-data";

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
// ("Acme Property — BF-001 — Pass"). `service_location_id` included
// so rows can deep-link to the certificate page.
const RECENT_COLUMNS =
  "id, test_date, result, retest_result, device_id, customer_id, service_location_id, devices(serial_number, manufacturer, model), customers(company_name, contact_first_name, contact_last_name)" as const;

export type TestResultRecentRow = {
  id: string;
  test_date: string;
  result: string;
  retest_result: string | null;
  device_id: string;
  customer_id: string;
  service_location_id: string;
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

// Full bundle needed to render a certificate PDF. Fetches test_result
// + device + service_location + customer + tester + company in one
// PostgREST round-trip; callers pass the result straight into
// buildCertificateData(). Returns null when the test doesn't exist OR
// (via RLS) isn't visible to the caller — same shape as our other
// detail fetchers.
//
// `testers!tester_id` hint matches the other test_results selects —
// the dual FK on testers (tester_id + reviewed_by) forces PostgREST to
// require disambiguation.
const CERT_CONTEXT_COLUMNS = `
  id,
  test_date,
  result,
  check_valve_1_psid,
  check_valve_2_psid,
  relief_valve_opening,
  air_inlet_opening,
  shutoff_valve_1_condition,
  shutoff_valve_2_condition,
  test_gauge_serial,
  test_gauge_calibration_date,
  water_supply_pressure,
  repairs_made,
  retest_result,
  retest_check_valve_1_psid,
  retest_check_valve_2_psid,
  retest_relief_valve_opening,
  retest_date,
  notes,
  pdf_url,
  emailed_at,
  emailed_to,
  device_id,
  service_location_id,
  customer_id,
  tester_id,
  company_id,
  device:devices(
    id, serial_number, manufacturer, model, size, type,
    location_description, install_date, service_type
  ),
  service_location:service_locations(
    id, nickname, address_line_1, address_line_2, city, state, zip,
    on_site_contact_first_name, on_site_contact_last_name,
    on_site_contact_phone, on_site_contact_email,
    water_district, hazard_type
  ),
  customer:customers(
    id, company_name, contact_first_name, contact_last_name,
    email, phone,
    billing_address_line_1, billing_address_line_2,
    billing_city, billing_state, billing_zip
  ),
  tester:testers!tester_id(
    id, first_name, last_name, license_number,
    license_expiration, license_issuing_authority
  ),
  company:companies(
    id, name, address_line_1, address_line_2, city, state, zip,
    phone, website, logo_url, default_pdf_footer
  )
` as const;

export type CertificateContext = BuildCertificateDataInput & {
  pdfUrl: string | null;
  emailedAt: string | null;
  emailedTo: string | null;
};

export async function getCertificateContext(
  db: DbClient,
  testResultId: string,
): Promise<CertificateContext | null> {
  if (!isUuid(testResultId)) return null;
  const { data, error } = await db
    .from("test_results")
    .select(CERT_CONTEXT_COLUMNS)
    .eq("id", testResultId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Nested joins can legally come back null if the FK row vanished
  // (cascades would normally prevent this, but guard anyway).
  if (
    !data.device ||
    !data.service_location ||
    !data.customer ||
    !data.tester ||
    !data.company
  ) {
    return null;
  }

  return {
    testResult: data as unknown as TestResultRow,
    device: data.device as unknown as DeviceRow,
    serviceLocation: data.service_location as unknown as ServiceLocationRow,
    customer: data.customer as unknown as CustomerRow,
    tester: data.tester as unknown as TesterRow,
    company: data.company as unknown as CompanyRow,
    pdfUrl: data.pdf_url,
    emailedAt: data.emailed_at,
    emailedTo: data.emailed_to,
  };
}
