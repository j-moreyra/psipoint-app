/* eslint-disable no-console */
/**
 * Phase 2 dev seed script.
 *
 * Populates a single company with a realistic hierarchy:
 *   5 customers × ~3 locations each × ~2-3 devices each ≈ 15 locations, 40 devices.
 *
 * Usage (from repo root):
 *   ALLOW_SEEDING=true SEED_COMPANY_ID=<uuid> npx tsx scripts/seed.ts
 *
 * Requires:
 *   .env.local  — NEXT_PUBLIC_SUPABASE_URL (must match SEED_ALLOWED_PROJECT_REF)
 *   .env.seed   — SUPABASE_SERVICE_ROLE_KEY (gitignored; only this script reads it)
 *                 SEED_ALLOWED_PROJECT_REF (the dev project ref, e.g. oscalardqnipswcdwhke)
 *
 * Safeguards (all must pass):
 *   1. ALLOW_SEEDING=true must be set explicitly at the command line
 *   2. SUPABASE_URL must contain the project ref listed in SEED_ALLOWED_PROJECT_REF
 *   3. SEED_COMPANY_ID must be a valid UUID
 *   4. .env.seed must exist (else service key loads fail, halting the script)
 *
 * Idempotent: deletes all customers for the target company before inserting
 * (cascades to service_locations + devices + test_results via ON DELETE CASCADE).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// env loading — tsx doesn't auto-load env files
// ---------------------------------------------------------------------------
function loadDotEnv(path: string, { required = false } = {}): void {
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
    if (required) {
      die(
        `Could not read ${path}.\n` +
          `  Seed requires a separate .env.seed file with:\n` +
          `    SUPABASE_SERVICE_ROLE_KEY=<dev project service role key>\n` +
          `    SEED_ALLOWED_PROJECT_REF=<dev project ref, e.g. oscalardqnipswcdwhke>\n` +
          `  This file should be gitignored. The app itself never reads it.`,
      );
    }
  }
}

// .env.local is loaded first (public URL, anon key for normal app use),
// then .env.seed overrides with the service key and allowed project ref.
loadDotEnv(".env.local");
loadDotEnv(".env.seed", { required: true });

// ---------------------------------------------------------------------------
// safeguards
// ---------------------------------------------------------------------------
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function die(msg: string): never {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const COMPANY_ID = process.env.SEED_COMPANY_ID ?? "";
const ALLOW_SEEDING = process.env.ALLOW_SEEDING ?? "";
const ALLOWED_PROJECT_REF = process.env.SEED_ALLOWED_PROJECT_REF ?? "";

if (ALLOW_SEEDING !== "true") {
  die(
    "Refusing to seed: ALLOW_SEEDING is not set to 'true'.\n" +
      "  Run with: ALLOW_SEEDING=true SEED_COMPANY_ID=<uuid> npx tsx scripts/seed.ts\n" +
      "  This explicit opt-in prevents accidental runs.",
  );
}

if (!SUPABASE_URL) die("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local.");

if (!ALLOWED_PROJECT_REF) {
  die(
    "SEED_ALLOWED_PROJECT_REF is not set in .env.seed.\n" +
      "  Set it to your dev project ref (the slug in your Supabase URL,\n" +
      "  e.g., for https://oscalardqnipswcdwhke.supabase.co the ref is\n" +
      "  oscalardqnipswcdwhke).",
  );
}

if (!SUPABASE_URL.includes(ALLOWED_PROJECT_REF)) {
  die(
    `Refusing to seed: SUPABASE_URL does not contain the allowed project ref.\n` +
      `  URL:      ${SUPABASE_URL}\n` +
      `  Expected: ${ALLOWED_PROJECT_REF}\n` +
      `  This script is dev-only and must not touch production.`,
  );
}

if (!SERVICE_KEY) {
  die(
    "SUPABASE_SERVICE_ROLE_KEY is not set in .env.seed.\n" +
      "  Seed needs RLS-bypass to wipe + reseed. Paste the dev project's\n" +
      "  service role key from Supabase dashboard → Settings → API.",
  );
}

if (!COMPANY_ID) {
  die(
    "SEED_COMPANY_ID is not set. Pass a company UUID at the command line:\n" +
      "  ALLOW_SEEDING=true SEED_COMPANY_ID=<uuid> npx tsx scripts/seed.ts\n" +
      "  Find your company_id by signing into the app and running this SQL\n" +
      "  in Supabase: select id, name from companies;",
  );
}

if (!UUID_RE.test(COMPANY_ID)) {
  die(`SEED_COMPANY_ID "${COMPANY_ID}" is not a valid UUID.`);
}

// ---------------------------------------------------------------------------
// data — unchanged from prior version
// ---------------------------------------------------------------------------
// [... PASTE THE ENTIRE `customers` ARRAY FROM YOUR EXISTING FILE HERE,
//  VERBATIM. I am not reproducing it below to keep this response readable.
//  It starts with `const customers: CustomerSeed[] = [` and ends with `];`. ]

// Also paste the `CustomerSeed`, `LocationSeed`, `DeviceSeed` type definitions.

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
