import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import { getCurrentCompanyId } from "@/lib/db/context";
import { deviceFormDefaults } from "@/lib/validation/devices";
import { DeviceForm } from "../device-form";

export const metadata: Metadata = { title: "New device" };

export default async function NewDevicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locId: string }>;
  searchParams: Promise<{ returnTo?: string; serial?: string }>;
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

  // Q13 add-device chain: the /tests/new picker kicks testers here
  // with ?returnTo=/tests/new&serial=<zero-result-query>. Prefill
  // the serial so they don't retype it; redirect to returnTo after
  // save (with ?device=<newId>) so /tests/new can resolve into the
  // canonical test-form URL.
  const sp = await searchParams;
  const returnTo = sp.returnTo ? safeNextPath(sp.returnTo, "") : "";
  const prefillSerial = sp.serial?.trim() ?? "";

  const defaults = prefillSerial
    ? { ...deviceFormDefaults, serial_number: prefillSerial }
    : undefined;

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
        defaults={defaults}
        returnTo={returnTo || undefined}
      />
    </div>
  );
}
