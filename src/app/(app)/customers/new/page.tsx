import type { Metadata } from "next";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/db/context";
import { CustomerForm } from "../customer-form";

export const metadata: Metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href="/customers" label="Customers" />
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
      </div>
      <CustomerForm mode="create" companyId={companyId} />
    </div>
  );
}
