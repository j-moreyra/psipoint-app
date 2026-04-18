import type { createClient } from "@/lib/supabase/server";

// The typed Supabase client returned by our server-side createClient().
// Helpers in this folder accept one of these so pages (which already
// have a live client from createClient()) can compose them cleanly, and
// tests can pass a mock.
export type DbClient = Awaited<ReturnType<typeof createClient>>;

// UUID v4-ish shape check. Pages pass user-supplied [id] route params
// straight into .eq("id", ...); PostgREST returns HTTP 400 for non-UUID
// input, which would bubble up as a generic 500 via (app)/error.tsx.
// Detail-fetch helpers use this to short-circuit to null (→ notFound())
// before touching the DB.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
