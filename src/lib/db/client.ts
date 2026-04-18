import type { createClient } from "@/lib/supabase/server";

// The typed Supabase client returned by our server-side createClient().
// Helpers in this folder accept one of these so pages (which already
// have a live client from createClient()) can compose them cleanly, and
// tests can pass a mock.
export type DbClient = Awaited<ReturnType<typeof createClient>>;
