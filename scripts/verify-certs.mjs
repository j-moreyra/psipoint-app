#!/usr/bin/env node
/**
 * Phase 4 cert verification helper.
 *
 * Pick one when you're eyeballing the certificate PDF output — e.g. after a
 * `src/lib/pdf/certificate.tsx` change, or when spot-checking a type-aware
 * render branch (RP / DC / PVB / SVB / AVB). Drives a roundtrip that's
 * awkward through the UI alone because the signed-URL TTL is 60s.
 *
 * Usage (from repo root):
 *   node scripts/verify-certs.mjs list           # devices by type + their
 *                                                # customer/location/device
 *                                                # UUIDs for /tests/new URLs
 *   node scripts/verify-certs.mjs storage-list   # every PDF currently in the
 *                                                # certificates bucket
 *   node scripts/verify-certs.mjs render-all     # download + qlmanage each PDF
 *                                                # in storage → /tmp/backflo-
 *                                                # cert-verify/*.pdf.png
 *   node scripts/verify-certs.mjs render <uuid>  # same, for one test_result
 *
 * Security posture — same as scripts/seed.ts:
 *   - reads SUPABASE_SERVICE_ROLE_KEY from .env.seed (gitignored)
 *   - app code never reads the service-role key; this script does only
 *     because the 60s cert signed-URL TTL is too tight to keep the browser
 *     + Node in lockstep
 *   - dev-only — the .env.seed path pin prevents it running against prod
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import path from "node:path";

const envSeedPath = "/Users/joaquinmoreyra/backflo-app/.env.seed";
const envLocalPath = "/Users/joaquinmoreyra/backflo-app/.env.local";
const env = {};
for (const p of [envLocalPath, envSeedPath]) {
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const outDir = "/tmp/backflo-cert-verify";
fs.mkdirSync(outDir, { recursive: true });

async function devicesByType() {
  const { data: devices, error } = await db
    .from("devices")
    .select(`
      id, serial_number, type, company_id, service_location_id,
      service_locations(id, customer_id, address_line_1, nickname)
    `)
    .eq("is_active", true)
    .order("serial_number");
  if (error) throw error;

  const byType = {};
  for (const d of devices) {
    (byType[d.type] ??= []).push(d);
  }
  return byType;
}

async function listExistingCerts() {
  const { data: folders, error: fErr } = await db.storage
    .from("certificates")
    .list("", { limit: 100 });
  if (fErr) { console.error("list err", fErr); return []; }

  const found = [];
  for (const f of folders ?? []) {
    if (f.id) continue;
    const { data: files } = await db.storage
      .from("certificates")
      .list(f.name, { limit: 100 });
    for (const file of files ?? []) {
      found.push(`${f.name}/${file.name}`);
    }
  }
  return found;
}

async function downloadAndThumbnail(storagePath, label) {
  const { data, error } = await db.storage
    .from("certificates")
    .download(storagePath);
  if (error || !data) {
    console.log(`${label}: DOWNLOAD FAIL — ${error?.message ?? "no data"}`);
    return null;
  }
  const buf = Buffer.from(await data.arrayBuffer());
  const pdfPath = path.join(outDir, `${label}.pdf`);
  fs.writeFileSync(pdfPath, buf);
  const pngPath = `${pdfPath}.png`;
  if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
  execSync(`qlmanage -t -s 1600 -o "${outDir}" "${pdfPath}"`, { stdio: "pipe" });
  console.log(`${label}: ${buf.length}B → ${pngPath}`);
  return { pdfPath, pngPath };
}

async function testFor(testId) {
  const { data } = await db
    .from("test_results")
    .select(`
      id, company_id, device_id, service_location_id, customer_id, test_date,
      result, retest_result,
      devices(serial_number, type)
    `)
    .eq("id", testId)
    .single();
  return data;
}

async function main() {
  const cmd = process.argv[2] ?? "list";

  if (cmd === "list") {
    const by = await devicesByType();
    console.log("=== active devices by type:");
    for (const t of ["RP", "DC", "PVB", "SVB", "AVB"]) {
      console.log(`\n  ${t}:`);
      for (const d of (by[t] ?? []).slice(0, 3)) {
        const loc = d.service_locations;
        console.log(
          `    ${d.serial_number}  customer=${loc?.customer_id}  location=${loc?.id}  device=${d.id}`,
        );
      }
    }
    return;
  }

  if (cmd === "storage-list") {
    const files = await listExistingCerts();
    console.log(`=== ${files.length} certificate PDFs in storage:`);
    for (const f of files) console.log(`   ${f}`);
    return;
  }

  if (cmd === "render-all") {
    const files = await listExistingCerts();
    for (const f of files) {
      const [companyId, fname] = f.split("/");
      const testId = fname.replace(/\.pdf$/, "");
      const t = await testFor(testId);
      const type = t?.devices?.type ?? "?";
      const serial = t?.devices?.serial_number ?? "unknown";
      await downloadAndThumbnail(f, `${type}-${serial}-${testId.slice(0, 8)}`);
    }
    return;
  }

  if (cmd === "render") {
    const testId = process.argv[3];
    if (!testId) { console.error("usage: render <test_id>"); process.exit(1); }
    const t = await testFor(testId);
    if (!t) { console.error("test not found"); process.exit(1); }
    const storagePath = `${t.company_id}/${t.id}.pdf`;
    const type = t.devices?.type ?? "?";
    const serial = t.devices?.serial_number ?? "unk";
    await downloadAndThumbnail(storagePath, `${type}-${serial}-${t.id.slice(0, 8)}`);
    return;
  }

  console.error("unknown cmd", cmd);
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
