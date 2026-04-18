import type { DbClient } from "@/lib/db/client";

// Returns the caller's company_id via the public.user_company_id() RPC.
// Used by create flows that need to stamp company_id on an insert
// (RLS WITH CHECK will enforce the same value, but company_id is NOT NULL
// so the client has to provide it).
export async function getCurrentCompanyId(db: DbClient): Promise<string> {
  const { data, error } = await db.rpc("user_company_id");
  if (error) throw error;
  if (!data) throw new Error("No company_id for current user");
  return data;
}
