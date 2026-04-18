import { z } from "zod";

// Shared Zod primitives used across forms. Keep the input type a plain
// string (no transforms) so react-hook-form default values stay simple;
// normalization to null/undefined happens at submit time via the helpers
// below.

// Mirror of the DB `char_length` CHECK constraints from
// supabase/migrations/20260417130000_length_constraints.sql. Keeping
// these in sync means overflow bumps into a friendly Zod "Max N
// characters" inline error instead of a DB 23514 → generic toast.
export const FIELD_LIMITS = {
  name: 100,               // *_first_name, *_last_name, contact_*_name
  orgName: 200,             // company_name, nickname, water_district
  email: 255,
  phone: 50,
  addressLine: 200,         // address_line_1/2 everywhere
  city: 100,
  zip: 20,
  notes: 5000,              // customers.notes
  accessNotes: 2000,        // service_locations.access_notes
  serial: 100,              // devices.serial_number, test_results.test_gauge_serial
  manufacturer: 100,        // devices.manufacturer
  model: 100,               // devices.model
  deviceSize: 50,           // devices.size
  locationDescription: 500, // devices.location_description
  shutoffCondition: 200,    // test_results.shutoff_valve_{1,2}_condition
  repairs: 5000,            // test_results.repairs_made
} as const;

export const maxLenMsg = (n: number) => `Max ${n} characters`;

// `requiredText(msg)` — unchanged behavior. `requiredText(msg, limit)`
// also caps to the DB's char_length limit so paste-overflow surfaces
// as a field-level error, not a generic DB-rejection toast.
export const requiredText = (msg: string, limit?: number) => {
  const base = z.string().trim().min(1, msg);
  return typeof limit === "number"
    ? base.max(limit, maxLenMsg(limit))
    : base;
};

export const optionalText = z.string().trim();

// Factory for a length-capped optionalText. Composing at the schema
// site keeps the cap visible where the column is validated.
export const cappedOptionalText = (limit: number) =>
  optionalText.max(limit, maxLenMsg(limit));

export const optionalStateCode = z.string().trim().refine(
  (v) => v === "" || /^[A-Za-z]{2}$/.test(v),
  "Use the 2-letter state code",
);

export const requiredStateCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Use the 2-letter state code");

// Lenient email accepting an empty string. We don't want to block form
// submit on someone who hasn't captured an email yet, but we do want to
// catch obvious typos before Phase 4's Resend send-time failure. Uses
// zod 4's top-level z.email(). Caps at the DB email length.
export const optionalEmail = z
  .string()
  .trim()
  .max(FIELD_LIMITS.email, maxLenMsg(FIELD_LIMITS.email))
  .refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email");

export const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Required");

export const optionalDate = z.string().trim().refine(
  (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
  "Invalid date",
);

// Optional PSI reading. DB columns are numeric(4,1) → max 999.9 with one
// decimal place. Empty string allowed for "no reading captured" (e.g. a
// catastrophic failure that prevented taking a reading).
export const optionalPsi = z.string().trim().refine(
  (v) => v === "" || /^\d{1,3}(\.\d)?$/.test(v),
  "PSI must be 0–999.9",
);

// Postgres expects NULL for "unset"; use this for .update({...}) payloads.
export const nullIfEmpty = (s: string): string | null =>
  s.length > 0 ? s : null;

// Supabase-generated RPC Args types use `field?: string` (optional,
// defaulted in SQL). Use this for .rpc() payloads so undefined gets
// stripped by JSON.stringify and Postgres applies the default.
export const undefinedIfEmpty = (s: string): string | undefined =>
  s.length > 0 ? s : undefined;

// Coerce a nullable DB enum column back into the "" | enum shape that
// the form's <select> expects. Unknown values fall back to "" rather
// than crashing — protects the edit page if a column value drifts past
// the runtime allowed set.
export function toOptionalEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T | "" {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return "";
}

// Same idea for a required enum field — coerces to `fallback` on
// unknown input.
export function toRequiredEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}
