// Generic error translator for client-side database operations.
// We intentionally ignore the raw Postgres error so we never surface
// constraint names, schema detail, or row counts to end users. Callers
// pass a context-specific fallback (e.g. "Couldn't save your profile.").
// If we later need to surface specific errors (unique violations, check
// constraint names), add a PG-code → message mapping here.
export function dbErrorMessage(
  _error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return fallback;
}
