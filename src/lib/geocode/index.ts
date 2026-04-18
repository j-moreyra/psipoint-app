import {
  geocodeViaNominatim,
  type GeocodeInput,
  type GeocodeResult,
} from "./nominatim";

// Single isolation point for address → lat/lng. Phase 2 uses Nominatim
// (free, OpenStreetMap). Swapping to Google Maps — or any paid provider
// — means changing only this one function. All callers in the app
// import geocodeAddress from here, never from nominatim.ts directly.
export async function geocodeAddress(
  addr: GeocodeInput,
): Promise<GeocodeResult | null> {
  return geocodeViaNominatim(addr);
}

export type { GeocodeInput, GeocodeResult } from "./nominatim";
