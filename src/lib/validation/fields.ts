import { z } from "zod";

// Shared Zod primitives used across forms. Keep the input type a plain
// string (no transforms) so react-hook-form default values stay simple;
// normalization to null/undefined happens at submit time via the helpers
// below.

export const requiredText = (msg: string) =>
  z.string().trim().min(1, msg);

export const optionalText = z.string().trim();

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
// zod 4's top-level z.email().
export const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, "Invalid email");

export const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Required");

export const optionalDate = z.string().trim().refine(
  (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
  "Invalid date",
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
