import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, getCustomer } from "@/lib/db/customers";
import { getCurrentCompanyId } from "@/lib/db/context";
import { ServiceLocationForm } from "../service-location-form";

export const metadata: Metadata = { title: "New service location" };

export default async function NewServiceLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [customer, companyId] = await Promise.all([
    getCustomer(supabase, id),
    getCurrentCompanyId(supabase),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink
          href={`/customers/${customer.id}`}
          label={customerDisplayName(customer)}
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          New service location
        </h1>
      </div>
      <ServiceLocationForm
        mode="create"
        companyId={companyId}
        customerId={customer.id}
      />
    </div>
  );
}
