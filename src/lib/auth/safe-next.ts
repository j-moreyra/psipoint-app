// Validate a `next` path for post-auth redirects. Only allow relative paths
// that start with a single leading slash — blocks schemes ("https://..."),
// protocol-relative URLs ("//evil.com"), and anything without a leading
// slash, all of which would let an attacker round-trip our auth flow into
// sending users to their domain after login.
export function safeNextPath(
  candidate: string | null | undefined,
  fallback: string,
): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  return candidate;
}
