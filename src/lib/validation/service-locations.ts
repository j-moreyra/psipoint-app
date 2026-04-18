import { z } from "zod";
import {
  nullIfEmpty,
  optionalEmail,
  optionalText,
  requiredStateCode,
  requiredText,
} from "@/lib/validation/fields";

export const locationTypes = [
  "commercial",
  "residential",
  "industrial",
  "irrigation",
  "fire_line",
  "other",
] as const;

export type LocationType = (typeof locationTypes)[number];

export const locationTypeLabels: Record<LocationType, string> = {
  commercial: "Commercial",
  residential: "Residential",
  industrial: "Industrial",
  irrigation: "Irrigation",
  fire_line: "Fire line",
  other: "Other",
};

export const hazardTypes = ["low", "high", "unknown"] as const;
export type HazardType = (typeof hazardTypes)[number];

export const hazardTypeLabels: Record<HazardType, string> = {
  low: "Low",
  high: "High",
  unknown: "Unknown",
};

// Form state represents an unselected enum as "". On submit we turn that
// into null so the nullable enum columns stay clean.
const optionalLocationType = z.union([
  z.literal(""),
  z.enum(locationTypes),
]);
const optionalHazardType = z.union([z.literal(""), z.enum(hazardTypes)]);

// Address fields are NOT NULL at the DB level; enforce required here.
export const serviceLocationSchema = z.object({
  nickname: optionalText,
  address_line_1: requiredText("Street address is required"),
  address_line_2: optionalText,
  city: requiredText("City is required"),
  state: requiredStateCode,
  zip: requiredText("ZIP is required"),
  location_type: optionalLocationType,
  on_site_contact_first_name: optionalText,
  on_site_contact_last_name: optionalText,
  on_site_contact_phone: optionalText,
  on_site_contact_email: optionalEmail,
  water_district: optionalText,
  access_notes: optionalText,
  hazard_type: optionalHazardType,
});

export type ServiceLocationInput = z.infer<typeof serviceLocationSchema>;

// Shared helper — `null` for empty optionals, uppercase state.
function toPayload(v: ServiceLocationInput) {
  return {
    nickname: nullIfEmpty(v.nickname),
    address_line_1: v.address_line_1,
    address_line_2: nullIfEmpty(v.address_line_2),
    city: v.city,
    state: v.state.toUpperCase(),
    zip: v.zip,
    location_type: v.location_type === "" ? null : v.location_type,
    on_site_contact_first_name: nullIfEmpty(v.on_site_contact_first_name),
    on_site_contact_last_name: nullIfEmpty(v.on_site_contact_last_name),
    on_site_contact_phone: nullIfEmpty(v.on_site_contact_phone),
    on_site_contact_email: nullIfEmpty(v.on_site_contact_email),
    water_district: nullIfEmpty(v.water_district),
    access_notes: nullIfEmpty(v.access_notes),
    hazard_type: v.hazard_type === "" ? null : v.hazard_type,
  };
}

export function toServiceLocationUpdate(v: ServiceLocationInput) {
  return toPayload(v);
}

export function toServiceLocationInsert(
  v: ServiceLocationInput,
  ids: { companyId: string; customerId: string },
) {
  return {
    ...toPayload(v),
    company_id: ids.companyId,
    customer_id: ids.customerId,
  };
}
