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
