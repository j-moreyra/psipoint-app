import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, getCustomer } from "@/lib/db/customers";
import { CustomerForm } from "../../customer-form";
import type { CustomerInput } from "@/lib/validation/customers";

export const metadata: Metadata = { title: "Edit customer" };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const customer = await getCustomer(supabase, id);
  if (!customer) notFound();

  const defaults: CustomerInput = {
    contact_first_name: customer.contact_first_name ?? "",
    contact_last_name: customer.contact_last_name ?? "",
    company_name: customer.company_name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    billing_address_line_1: customer.billing_address_line_1 ?? "",
    billing_address_line_2: customer.billing_address_line_2 ?? "",
    billing_city: customer.billing_city ?? "",
    billing_state: customer.billing_state ?? "",
    billing_zip: customer.billing_zip ?? "",
    notes: customer.notes ?? "",
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href="/customers" label="Customers" />
        <h1 className="text-2xl font-semibold tracking-tight">
          {customerDisplayName(customer)}
        </h1>
      </div>
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        defaults={defaults}
      />
    </div>
  );
}
