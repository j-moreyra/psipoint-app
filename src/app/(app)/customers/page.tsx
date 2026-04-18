import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/db/customers";
import { CustomerList } from "./customer-list";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const rows = await listCustomers(supabase);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <Button nativeButton={false} render={<Link href="/customers/new" />}>
          <PlusIcon className="size-4" />
          New customer
        </Button>
      </div>
      <CustomerList rows={rows} />
    </div>
  );
}
