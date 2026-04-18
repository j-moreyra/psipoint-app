"use server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/db/client";
import { geocodeAddress } from "@/lib/geocode";

// Best-effort geocoder: fetches a service_location's address by id,
// resolves it to lat/lng via Nominatim, and stamps the row. Swallows
// all failures (network, Nominatim miss, RLS-denied fetch, update
// conflict). The user-visible save flow already committed before this
// runs, so we never want to surface an error here.
//
// Called from client forms as fire-and-forget after a successful
// insert/update. Runs on the server so the Nominatim User-Agent +
// rate-limiting posture are under our control, not the browser's.
export async function geocodeAndStampLocation(
  locationId: string,
): Promise<void> {
  if (!isUuid(locationId)) return;

  const supabase = await createClient();

  // RLS scopes this to the caller's company.
  const { data: loc, error: fetchErr } = await supabase
    .from("service_locations")
    .select("address_line_1, address_line_2, city, state, zip")
    .eq("id", locationId)
    .maybeSingle();

  if (fetchErr || !loc) {
    console.warn("[geocode] fetch failed", { locationId, fetchErr });
    return;
  }

  const result = await geocodeAddress({
    address_line_1: loc.address_line_1,
    address_line_2: loc.address_line_2,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
  });

  if (!result) {
    // Not a real error — Nominatim just didn't find it, or the network
    // failed. Leave lat/lng as null; the user can edit the address and
    // re-save to retry.
    return;
  }

  const { error: updErr } = await supabase
    .from("service_locations")
    .update({ latitude: result.lat, longitude: result.lng })
    .eq("id", locationId);

  if (updErr) {
    console.warn("[geocode] update failed", { locationId, updErr });
  }
}
