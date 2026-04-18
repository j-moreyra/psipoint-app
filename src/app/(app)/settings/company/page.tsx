import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "./company-form";
import { dueDateMethods, type DueDateMethod } from "@/lib/validation/onboarding";

export const metadata: Metadata = { title: "Company" };

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, address_line_1, address_line_2, city, state, zip, phone, website, next_due_calculation_method",
    )
    .single();

  if (!company) {
    throw new Error("Missing company record");
  }

  const method: DueDateMethod = (
    dueDateMethods as readonly string[]
  ).includes(company.next_due_calculation_method)
    ? (company.next_due_calculation_method as DueDateMethod)
    : "test_date_plus_year";

  return (
    <CompanyForm
      companyId={company.id}
      defaults={{
        name: company.name,
        address_line_1: company.address_line_1 ?? "",
        address_line_2: company.address_line_2 ?? "",
        city: company.city ?? "",
        state: company.state ?? "",
        zip: company.zip ?? "",
        phone: company.phone ?? "",
        website: company.website ?? "",
        next_due_calculation_method: method,
      }}
    />
  );
}
