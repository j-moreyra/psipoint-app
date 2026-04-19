import { z } from "zod";
import {
  cappedOptionalText,
  FIELD_LIMITS,
  normalizePhoneUs,
  nullIfEmpty,
  optionalEmail,
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
// Length caps mirror the DB char_length CHECKs (see FIELD_LIMITS).
export const serviceLocationSchema = z.object({
  nickname: cappedOptionalText(FIELD_LIMITS.orgName),
  address_line_1: requiredText(
    "Street address is required",
    FIELD_LIMITS.addressLine,
  ),
  address_line_2: cappedOptionalText(FIELD_LIMITS.addressLine),
  city: requiredText("City is required", FIELD_LIMITS.city),
  state: requiredStateCode,
  zip: requiredText("ZIP is required", FIELD_LIMITS.zip),
  location_type: optionalLocationType,
  on_site_contact_first_name: cappedOptionalText(FIELD_LIMITS.name),
  on_site_contact_last_name: cappedOptionalText(FIELD_LIMITS.name),
  on_site_contact_phone: cappedOptionalText(FIELD_LIMITS.phone),
  on_site_contact_email: optionalEmail,
  water_district: cappedOptionalText(FIELD_LIMITS.orgName),
  access_notes: cappedOptionalText(FIELD_LIMITS.accessNotes),
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
    on_site_contact_phone: nullIfEmpty(normalizePhoneUs(v.on_site_contact_phone)),
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
