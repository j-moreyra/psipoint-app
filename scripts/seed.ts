/* eslint-disable no-console */
/**
 * Phase 2 dev seed script.
 *
 * Populates a single company with a realistic hierarchy:
 *   5 customers × ~3 locations each × ~2-3 devices each ≈ 15 locations, 40 devices.
 *
 * Usage (from repo root):
 *   SEED_COMPANY_ID=<uuid> npm run seed
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL           must point at backflo-dev
 *   SUPABASE_SERVICE_ROLE_KEY          service-role key (dev-only; the app
 *                                      itself never reads this — see
 *                                      HANDOFF.md § "Key Decisions")
 *
 * Safeguards:
 *   - Refuses to run if the Supabase URL doesn't contain "backflo-dev"
 *   - Refuses to run without SEED_COMPANY_ID (UUID)
 *   - Idempotent: deletes all customers for the target company before
 *     inserting (cascades to service_locations + devices + test_results
 *     via ON DELETE CASCADE)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// env loading — tsx doesn't auto-load .env.local
// ---------------------------------------------------------------------------
function loadDotEnv(path: string): void {
  try {
    const raw = readFileSync(resolve(path), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local is optional — env vars may be provided inline instead.
  }
}

loadDotEnv(".env.local");

// ---------------------------------------------------------------------------
// safeguards
// ---------------------------------------------------------------------------
const URL_GATE = "backflo-dev";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function die(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COMPANY_ID = process.env.SEED_COMPANY_ID ?? "";

if (!SUPABASE_URL) die("NEXT_PUBLIC_SUPABASE_URL is not set.");
if (!SUPABASE_URL.includes(URL_GATE)) {
  die(
    `Refusing to seed: SUPABASE_URL "${SUPABASE_URL}" does not contain "${URL_GATE}". ` +
      `This script is dev-only and must not touch production.`,
  );
}
if (!SERVICE_KEY) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Seed needs RLS-bypass to wipe + reseed.",
  );
}
if (!COMPANY_ID) {
  die(
    "SEED_COMPANY_ID is not set. Pass a company UUID, e.g.\n" +
      "  SEED_COMPANY_ID=<uuid> npm run seed",
  );
}
if (!UUID_RE.test(COMPANY_ID)) die(`SEED_COMPANY_ID "${COMPANY_ID}" is not a UUID.`);

// ---------------------------------------------------------------------------
// data
// ---------------------------------------------------------------------------
type CustomerSeed = {
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address_line_1: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  notes?: string | null;
  locations: LocationSeed[];
};

type LocationSeed = {
  nickname: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  zip: string;
  location_type:
    | "commercial"
    | "residential"
    | "industrial"
    | "irrigation"
    | "fire_line"
    | "other"
    | null;
  hazard_type: "low" | "high" | "unknown" | null;
  water_district?: string | null;
  access_notes?: string | null;
  on_site_contact_first_name?: string | null;
  on_site_contact_last_name?: string | null;
  on_site_contact_phone?: string | null;
  on_site_contact_email?: string | null;
  devices: DeviceSeed[];
};

type DeviceSeed = {
  serial_number: string;
  manufacturer: string;
  model: string;
  size: string;
  type: "RP" | "DC" | "PVB" | "SVB" | "AVB";
  location_description: string;
  service_type:
    | "domestic"
    | "irrigation"
    | "fire_line"
    | "process_water"
    | "other"
    | null;
  install_date?: string | null;
  // Synthetic test-tracking fields so the UI status dots aren't all
  // "never tested" on a fresh seed. Phase 3 will drive these via the
  // update_device_last_tested trigger instead.
  last_tested_date?: string | null;
  last_test_result?: "pass" | "fail" | null;
  next_test_due_date?: string | null;
};

const customers: CustomerSeed[] = [
  {
    company_name: "Maple Leaf Property Management",
    contact_first_name: "Elena",
    contact_last_name: "Rodriguez",
    email: "elena@mapleleafpm.example.com",
    phone: "512-555-0132",
    billing_address_line_1: "801 Congress Ave Ste 400",
    billing_city: "Austin",
    billing_state: "TX",
    billing_zip: "78701",
    notes: "Invoice monthly; NET-30.",
    locations: [
      {
        nickname: "Maple Tower",
        address_line_1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        location_type: "commercial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Loading dock on 2nd St. Call 30 min ahead.",
        on_site_contact_first_name: "Darius",
        on_site_contact_last_name: "Shah",
        on_site_contact_phone: "512-555-0181",
        on_site_contact_email: "darius@mapletower.example.com",
        devices: [
          {
            serial_number: "MT-DOM-001",
            manufacturer: "Watts",
            model: "LF909",
            size: "2\"",
            type: "RP",
            location_description: "Basement mechanical room",
            service_type: "domestic",
            install_date: "2019-06-12",
            last_tested_date: "2025-12-01",
            last_test_result: "pass",
            next_test_due_date: "2025-12-01", // overdue (today is 2026-04-18)
          },
          {
            serial_number: "MT-FL-002",
            manufacturer: "Febco",
            model: "825Y",
            size: "4\"",
            type: "DC",
            location_description: "Fire-riser room, 1st floor",
            service_type: "fire_line",
            install_date: "2019-06-12",
            last_tested_date: "2025-12-01",
            last_test_result: "pass",
            next_test_due_date: "2026-12-01",
          },
        ],
      },
      {
        nickname: "Maple Warehouse",
        address_line_1: "456 Industrial Blvd",
        city: "Austin",
        state: "TX",
        zip: "78744",
        location_type: "industrial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Gate code 4455. Yard dogs — security meets at gate.",
        on_site_contact_first_name: "Paula",
        on_site_contact_last_name: "Nguyen",
        on_site_contact_phone: "512-555-0140",
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "MW-PRO-010",
            manufacturer: "Wilkins",
            model: "975XL",
            size: "1-1/2\"",
            type: "RP",
            location_description: "Process-water supply, dock 3",
            service_type: "process_water",
            install_date: "2020-04-05",
            last_tested_date: "2026-02-15",
            last_test_result: "pass",
            next_test_due_date: "2027-02-15",
          },
          {
            serial_number: "MW-IRR-011",
            manufacturer: "Apollo",
            model: "4A-100",
            size: "1\"",
            type: "PVB",
            location_description: "Irrigation box, east lawn",
            service_type: "irrigation",
            install_date: "2020-04-05",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
        ],
      },
      {
        nickname: "Maple Retail Plaza",
        address_line_1: "789 Commerce Way",
        city: "Round Rock",
        state: "TX",
        zip: "78664",
        location_type: "commercial",
        hazard_type: "low",
        water_district: "Round Rock Utilities",
        access_notes: null,
        on_site_contact_first_name: "Marcus",
        on_site_contact_last_name: "Obi",
        on_site_contact_phone: "512-555-0199",
        on_site_contact_email: "marcus@mapleretail.example.com",
        devices: [
          {
            serial_number: "MR-DOM-020",
            manufacturer: "Wilkins",
            model: "975XL",
            size: "3/4\"",
            type: "DC",
            location_description: "Mech closet, unit B",
            service_type: "domestic",
            install_date: "2022-09-18",
            last_tested_date: "2025-04-10",
            last_test_result: "pass",
            next_test_due_date: "2026-05-10", // due soon
          },
          {
            serial_number: "MR-IRR-021",
            manufacturer: "Zurn",
            model: "Wilkins 720A",
            size: "1\"",
            type: "PVB",
            location_description: "North side irrigation manifold",
            service_type: "irrigation",
            install_date: "2022-09-18",
            last_tested_date: "2025-04-10",
            last_test_result: "pass",
            next_test_due_date: "2026-05-10", // due soon
          },
        ],
      },
      {
        nickname: "Maple Garage",
        address_line_1: "902 West Parkway",
        city: "Austin",
        state: "TX",
        zip: "78703",
        location_type: "commercial",
        hazard_type: "unknown",
        water_district: "Austin Water",
        access_notes: "Spare key at front desk.",
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "MG-DOM-030",
            manufacturer: "Febco",
            model: "860",
            size: "1\"",
            type: "DC",
            location_description: "Parking level P1, utility closet",
            service_type: "domestic",
            install_date: "2021-01-22",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
        ],
      },
    ],
  },
  {
    company_name: "Sierra Vista HOA",
    contact_first_name: "Priya",
    contact_last_name: "Patel",
    email: "priya@sierravista-hoa.example.com",
    phone: "512-555-0240",
    billing_address_line_1: "2100 Ridgeview Dr",
    billing_city: "Austin",
    billing_state: "TX",
    billing_zip: "78745",
    notes: null,
    locations: [
      {
        nickname: "Clubhouse",
        address_line_1: "2100 Ridgeview Dr",
        city: "Austin",
        state: "TX",
        zip: "78745",
        location_type: "commercial",
        hazard_type: "low",
        water_district: "Austin Water",
        access_notes: "Use HOA-assigned fob.",
        on_site_contact_first_name: "Priya",
        on_site_contact_last_name: "Patel",
        on_site_contact_phone: "512-555-0240",
        on_site_contact_email: "priya@sierravista-hoa.example.com",
        devices: [
          {
            serial_number: "SV-DOM-101",
            manufacturer: "Watts",
            model: "LF009",
            size: "3/4\"",
            type: "DC",
            location_description: "Pool equipment room",
            service_type: "domestic",
            install_date: "2018-05-14",
            last_tested_date: "2026-02-20",
            last_test_result: "pass",
            next_test_due_date: "2027-02-20",
          },
        ],
      },
      {
        nickname: "Pool house",
        address_line_1: "2114 Ridgeview Dr",
        city: "Austin",
        state: "TX",
        zip: "78745",
        location_type: "commercial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Chlorine injection — high hazard.",
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "SV-PH-102",
            manufacturer: "Watts",
            model: "LF909",
            size: "1-1/2\"",
            type: "RP",
            location_description: "Pool chemical room",
            service_type: "process_water",
            install_date: "2018-05-14",
            last_tested_date: "2024-12-15",
            last_test_result: "fail",
            next_test_due_date: "2025-12-15", // overdue
          },
          {
            serial_number: "SV-PH-103",
            manufacturer: "Apollo",
            model: "4A-100",
            size: "1\"",
            type: "PVB",
            location_description: "Irrigation, south lawn",
            service_type: "irrigation",
            install_date: "2018-05-14",
            last_tested_date: "2026-02-20",
            last_test_result: "pass",
            next_test_due_date: "2027-02-20",
          },
        ],
      },
      {
        nickname: "Maintenance yard",
        address_line_1: "2190 Ridgeview Service Rd",
        city: "Austin",
        state: "TX",
        zip: "78745",
        location_type: "other",
        hazard_type: "unknown",
        water_district: "Austin Water",
        access_notes: "Supplies are padlocked — bring bolt cutters or call.",
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "SV-MY-104",
            manufacturer: "Zurn",
            model: "Wilkins 350",
            size: "3/4\"",
            type: "DC",
            location_description: "Wash-down spigot, east wall",
            service_type: "domestic",
            install_date: "2020-08-30",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
        ],
      },
    ],
  },
  {
    company_name: "Bright Valley Restaurants LLC",
    contact_first_name: "Adrian",
    contact_last_name: "Okafor",
    email: "adrian@brightvalleyrest.example.com",
    phone: "512-555-0330",
    billing_address_line_1: "50 W 5th St Ste 2",
    billing_city: "Austin",
    billing_state: "TX",
    billing_zip: "78701",
    notes: "Four locations; unified billing.",
    locations: [
      {
        nickname: "BV Downtown",
        address_line_1: "110 E 6th St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        location_type: "commercial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Kitchen closes at 3pm — schedule around that.",
        on_site_contact_first_name: "Sonia",
        on_site_contact_last_name: "Martínez",
        on_site_contact_phone: "512-555-0401",
        on_site_contact_email: "sonia@bvdowntown.example.com",
        devices: [
          {
            serial_number: "BV-DT-201",
            manufacturer: "Watts",
            model: "LF009",
            size: "1\"",
            type: "RP",
            location_description: "Behind dish line",
            service_type: "domestic",
            install_date: "2017-11-02",
            last_tested_date: "2025-09-05",
            last_test_result: "pass",
            next_test_due_date: "2026-09-05",
          },
        ],
      },
      {
        nickname: "BV Commissary",
        address_line_1: "3300 Hydroponic Way",
        city: "Austin",
        state: "TX",
        zip: "78744",
        location_type: "industrial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Dock 4 receiving.",
        on_site_contact_first_name: "Jimi",
        on_site_contact_last_name: "Park",
        on_site_contact_phone: "512-555-0444",
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "BV-CM-210",
            manufacturer: "Wilkins",
            model: "975XL",
            size: "3\"",
            type: "RP",
            location_description: "Main supply, line-in room",
            service_type: "process_water",
            install_date: "2021-03-18",
            last_tested_date: "2025-10-10",
            last_test_result: "pass",
            next_test_due_date: "2026-10-10",
          },
          {
            serial_number: "BV-CM-211",
            manufacturer: "Watts",
            model: "LF909",
            size: "2\"",
            type: "RP",
            location_description: "Sanitation wash-down",
            service_type: "domestic",
            install_date: "2021-03-18",
            last_tested_date: "2025-10-10",
            last_test_result: "pass",
            next_test_due_date: "2026-10-10",
          },
        ],
      },
      {
        nickname: "BV South Lamar",
        address_line_1: "2405 S Lamar Blvd",
        city: "Austin",
        state: "TX",
        zip: "78704",
        location_type: "commercial",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: null,
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "BV-SL-220",
            manufacturer: "Febco",
            model: "860",
            size: "1\"",
            type: "DC",
            location_description: "Utility closet by bar",
            service_type: "domestic",
            install_date: "2023-02-01",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
        ],
      },
      {
        nickname: "BV Round Rock",
        address_line_1: "3001 Joe DiMaggio Blvd",
        city: "Round Rock",
        state: "TX",
        zip: "78665",
        location_type: "commercial",
        hazard_type: "high",
        water_district: "Round Rock Utilities",
        access_notes: "Back door unlocked before 10am.",
        on_site_contact_first_name: "Janet",
        on_site_contact_last_name: "Pham",
        on_site_contact_phone: "512-555-0466",
        on_site_contact_email: "janet@bvroundrock.example.com",
        devices: [
          {
            serial_number: "BV-RR-230",
            manufacturer: "Watts",
            model: "LF009",
            size: "3/4\"",
            type: "RP",
            location_description: "Dish room",
            service_type: "domestic",
            install_date: "2022-05-20",
            last_tested_date: "2025-05-20",
            last_test_result: "pass",
            next_test_due_date: "2026-05-20", // due soon (within 30 days)
          },
          {
            serial_number: "BV-RR-231",
            manufacturer: "Watts",
            model: "800M4",
            size: "1/2\"",
            type: "AVB",
            location_description: "Mop sink",
            service_type: "domestic",
            install_date: "2022-05-20",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
        ],
      },
    ],
  },
  {
    company_name: null,
    contact_first_name: "John",
    contact_last_name: "Kowalski",
    email: "jkowalski@example.com",
    phone: "512-555-0510",
    billing_address_line_1: "15 Oak Grove Ln",
    billing_city: "Austin",
    billing_state: "TX",
    billing_zip: "78731",
    notes: "Single-family — bills to homeowner.",
    locations: [
      {
        nickname: null,
        address_line_1: "15 Oak Grove Ln",
        city: "Austin",
        state: "TX",
        zip: "78731",
        location_type: "residential",
        hazard_type: "low",
        water_district: "Austin Water",
        access_notes: "Side yard gate — chihuahua.",
        on_site_contact_first_name: "John",
        on_site_contact_last_name: "Kowalski",
        on_site_contact_phone: "512-555-0510",
        on_site_contact_email: "jkowalski@example.com",
        devices: [
          {
            serial_number: "JK-IRR-301",
            manufacturer: "Apollo",
            model: "4A-100",
            size: "3/4\"",
            type: "PVB",
            location_description: "Front yard sprinkler system",
            service_type: "irrigation",
            install_date: "2016-03-12",
            last_tested_date: "2026-03-22",
            last_test_result: "pass",
            next_test_due_date: "2027-03-22",
          },
        ],
      },
    ],
  },
  {
    company_name: "Evergreen Irrigation Co",
    contact_first_name: "Luz",
    contact_last_name: "Herrera",
    email: "luz@evergreen-irrigation.example.com",
    phone: "512-555-0610",
    billing_address_line_1: "4100 Mesa Rd",
    billing_city: "Austin",
    billing_state: "TX",
    billing_zip: "78759",
    notes: null,
    locations: [
      {
        nickname: "Evergreen HQ",
        address_line_1: "4100 Mesa Rd",
        city: "Austin",
        state: "TX",
        zip: "78759",
        location_type: "commercial",
        hazard_type: "low",
        water_district: "Austin Water",
        access_notes: null,
        on_site_contact_first_name: "Luz",
        on_site_contact_last_name: "Herrera",
        on_site_contact_phone: "512-555-0610",
        on_site_contact_email: "luz@evergreen-irrigation.example.com",
        devices: [
          {
            serial_number: "EV-HQ-401",
            manufacturer: "Wilkins",
            model: "720A",
            size: "1\"",
            type: "PVB",
            location_description: "Demo yard water feature",
            service_type: "irrigation",
            install_date: "2019-07-22",
            last_tested_date: "2026-01-10",
            last_test_result: "pass",
            next_test_due_date: "2027-01-10",
          },
        ],
      },
      {
        nickname: "Equipment yard",
        address_line_1: "4188 Mesa Service Rd",
        city: "Austin",
        state: "TX",
        zip: "78759",
        location_type: "irrigation",
        hazard_type: "high",
        water_district: "Austin Water",
        access_notes: "Gate code 7719.",
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "EV-YD-410",
            manufacturer: "Febco",
            model: "825Y",
            size: "2\"",
            type: "DC",
            location_description: "Central supply manifold",
            service_type: "irrigation",
            install_date: "2020-04-01",
            last_tested_date: "2024-04-05",
            last_test_result: "pass",
            next_test_due_date: "2025-04-05", // overdue
          },
          {
            serial_number: "EV-YD-411",
            manufacturer: "Watts",
            model: "800M4",
            size: "3/4\"",
            type: "AVB",
            location_description: "Wash-down rack",
            service_type: "domestic",
            install_date: "2020-04-01",
            last_tested_date: null,
            last_test_result: null,
            next_test_due_date: null,
          },
          {
            serial_number: "EV-YD-412",
            manufacturer: "Apollo",
            model: "4A-100",
            size: "1\"",
            type: "PVB",
            location_description: "Mixing station",
            service_type: "process_water",
            install_date: "2020-04-01",
            last_tested_date: "2026-02-28",
            last_test_result: "pass",
            next_test_due_date: "2027-02-28",
          },
        ],
      },
      {
        nickname: "Field storage",
        address_line_1: "4220 Mesa Service Rd",
        city: "Austin",
        state: "TX",
        zip: "78759",
        location_type: "industrial",
        hazard_type: "unknown",
        water_district: "Austin Water",
        access_notes: null,
        on_site_contact_first_name: null,
        on_site_contact_last_name: null,
        on_site_contact_phone: null,
        on_site_contact_email: null,
        devices: [
          {
            serial_number: "EV-FS-420",
            manufacturer: "Zurn",
            model: "Wilkins 350",
            size: "1\"",
            type: "DC",
            location_description: "Warehouse wet wall",
            service_type: "domestic",
            install_date: "2022-06-15",
            last_tested_date: "2025-06-01",
            last_test_result: "pass",
            next_test_due_date: "2026-06-01",
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  const supabase: SupabaseClient<Database> = createClient<Database>(
    SUPABASE_URL,
    SERVICE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log(`\n  seed → ${SUPABASE_URL}`);
  console.log(`  company_id=${COMPANY_ID}\n`);

  // Idempotent wipe. FK cascades handle service_locations + devices +
  // test_results in one shot.
  const { error: delErr, count: delCount } = await supabase
    .from("customers")
    .delete({ count: "exact" })
    .eq("company_id", COMPANY_ID);
  if (delErr) die(`delete failed: ${delErr.message}`);
  console.log(`  ↻ wiped ${delCount ?? 0} existing customers`);

  let customerCount = 0;
  let locationCount = 0;
  let deviceCount = 0;

  for (const c of customers) {
    const { data: inserted, error: cErr } = await supabase
      .from("customers")
      .insert({
        company_id: COMPANY_ID,
        company_name: c.company_name,
        contact_first_name: c.contact_first_name,
        contact_last_name: c.contact_last_name,
        email: c.email,
        phone: c.phone,
        billing_address_line_1: c.billing_address_line_1,
        billing_city: c.billing_city,
        billing_state: c.billing_state,
        billing_zip: c.billing_zip,
        notes: c.notes ?? null,
      })
      .select("id")
      .single();
    if (cErr || !inserted) die(`customer insert failed: ${cErr?.message}`);
    customerCount++;

    for (const l of c.locations) {
      const { data: loc, error: lErr } = await supabase
        .from("service_locations")
        .insert({
          company_id: COMPANY_ID,
          customer_id: inserted.id,
          nickname: l.nickname,
          address_line_1: l.address_line_1,
          address_line_2: l.address_line_2 ?? null,
          city: l.city,
          state: l.state,
          zip: l.zip,
          location_type: l.location_type,
          hazard_type: l.hazard_type,
          water_district: l.water_district ?? null,
          access_notes: l.access_notes ?? null,
          on_site_contact_first_name: l.on_site_contact_first_name ?? null,
          on_site_contact_last_name: l.on_site_contact_last_name ?? null,
          on_site_contact_phone: l.on_site_contact_phone ?? null,
          on_site_contact_email: l.on_site_contact_email ?? null,
        })
        .select("id")
        .single();
      if (lErr || !loc) die(`location insert failed: ${lErr?.message}`);
      locationCount++;

      for (const d of l.devices) {
        const { error: dErr } = await supabase.from("devices").insert({
          company_id: COMPANY_ID,
          customer_id: inserted.id,
          service_location_id: loc.id,
          serial_number: d.serial_number,
          manufacturer: d.manufacturer,
          model: d.model,
          size: d.size,
          type: d.type,
          location_description: d.location_description,
          service_type: d.service_type,
          install_date: d.install_date ?? null,
          last_tested_date: d.last_tested_date ?? null,
          last_test_result: d.last_test_result ?? null,
          next_test_due_date: d.next_test_due_date ?? null,
        });
        if (dErr) die(`device insert failed: ${dErr.message}`);
        deviceCount++;
      }
    }
  }

  console.log(
    `\n  ✓ seeded ${customerCount} customers, ${locationCount} locations, ${deviceCount} devices\n`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
