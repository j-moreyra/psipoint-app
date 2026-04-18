import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import { getCurrentCompanyId } from "@/lib/db/context";
import { DeviceForm } from "../device-form";

export const metadata: Metadata = { title: "New device" };

export default async function NewDevicePage({
  params,
}: {
  params: Promise<{ id: string; locId: string }>;
}) {
  const { id, locId } = await params;
  const supabase = await createClient();

  const [customer, location, companyId] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
    getCurrentCompanyId(supabase),
  ]);

  if (!customer || !location || location.customer_id !== customer.id) {
    notFound();
  }

  const backHref = `/customers/${customer.id}/locations/${location.id}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href={backHref} label={serviceLocationDisplayName(location)} />
        <h1 className="text-2xl font-semibold tracking-tight">New device</h1>
      </div>
      <DeviceForm
        mode="create"
        companyId={companyId}
        customerId={customer.id}
        serviceLocationId={location.id}
        backHref={backHref}
      />
    </div>
  );
}
