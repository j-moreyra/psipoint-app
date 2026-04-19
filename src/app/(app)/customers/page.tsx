import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import {
  AddDeviceBanner,
  buildReturnToQuery,
} from "@/components/app/add-device-banner";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/db/customers";
import { CustomerList } from "./customer-list";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; serial?: string }>;
}) {
  const supabase = await createClient();
  const rows = await listCustomers(supabase);

  const sp = await searchParams;
  // safeNextPath blocks open-redirect attempts (protocol-relative,
  // external, javascript:) same pattern as /auth/callback uses.
  const returnTo = sp.returnTo ? safeNextPath(sp.returnTo, "") : "";
  const serial = sp.serial?.trim() ?? "";
  const inAddDeviceFlow = returnTo !== "" && serial !== "";
  const forwardQuery = inAddDeviceFlow
    ? buildReturnToQuery(returnTo, serial)
    : "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <Button nativeButton={false} render={<Link href="/customers/new" />}>
          <PlusIcon className="size-4" />
          New customer
        </Button>
      </div>
      {inAddDeviceFlow ? (
        <AddDeviceBanner serial={serial} step="customer" />
      ) : null}
      <CustomerList rows={rows} linkSuffix={forwardQuery} />
    </div>
  );
}
