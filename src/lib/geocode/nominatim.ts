// Nominatim geocoding (OpenStreetMap). Free, permissive for small
// volumes. The ops note here matters: Nominatim requires a valid
// User-Agent and rate-limits to 1 request/second absolute max. Phase 2
// only calls it once per service-location save, so we stay well under.
//
// Isolation boundary: callers go through `geocodeAddress()` in
// src/lib/geocode/index.ts, not this module directly. Swapping to Google
// Maps later means changing that one file.

export interface GeocodeInput {
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  zip: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
}

// Nominatim-recommended identifier pattern. Production URL is
// informational only — Nominatim admins use it to reach operators if a
// client misbehaves.
export const NOMINATIM_USER_AGENT =
  "BackFLO/0.1 (+https://backflo-app.netlify.app)";

export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

// Build a search URL from a structured address. Uses Nominatim's
// "structured" query params (street=, city=, state=, postalcode=) which
// yield better hit rates than a free-text `q=` for US addresses.
export function buildNominatimUrl(addr: GeocodeInput): string {
  const street = [addr.address_line_1, addr.address_line_2 ?? ""]
    .filter((s) => s && s.trim() !== "")
    .join(" ");
  const u = new URL(NOMINATIM_ENDPOINT);
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", "1");
  u.searchParams.set("addressdetails", "0");
  u.searchParams.set("street", street);
  u.searchParams.set("city", addr.city);
  u.searchParams.set("state", addr.state);
  u.searchParams.set("postalcode", addr.zip);
  u.searchParams.set("country", "US");
  return u.toString();
}

// Parse the JSON array Nominatim returns. First item wins (we set
// limit=1). Returns null on empty, malformed, or unparseable numeric
// lat/lon values — geocoding is best-effort, callers must handle null.
export function parseNominatimResponse(body: unknown): GeocodeResult | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const first = body[0] as { lat?: unknown; lon?: unknown };
  const lat = typeof first.lat === "string" ? Number(first.lat) : NaN;
  const lng = typeof first.lon === "string" ? Number(first.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Hit Nominatim and return the first result. Never throws — returns null
// on network failure, non-2xx, or parse failure. Intentionally no retry
// loop: Nominatim abuse is a real concern and a transient failure is
// better than a retry storm.
export async function geocodeViaNominatim(
  addr: GeocodeInput,
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(buildNominatimUrl(addr), {
      headers: { "User-Agent": NOMINATIM_USER_AGENT },
      // Keep this short — the save flow is waiting on us.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return parseNominatimResponse(body);
  } catch {
    return null;
  }
}
