// Generic error translator for storage operations. Mirrors db/errors
// in philosophy: never leak SDK error text to end users — Supabase
// storage errors can include bucket names, signed-URL internals, and
// other implementation detail.
export function storageErrorMessage(
  _error: unknown,
  fallback = "Couldn't save the file. Please try again.",
): string {
  return fallback;
}
