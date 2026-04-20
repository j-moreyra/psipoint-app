import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CompanyForm } from "./company-form";
import { DueDateMethodCard } from "./due-date-method-card";
import { LogoUpload } from "./logo-upload";
import { dueDateMethods, type DueDateMethod } from "@/lib/validation/onboarding";
import { createLogoPreviewUrl } from "@/lib/storage/logos";

export const metadata: Metadata = { title: "Company" };

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, address_line_1, address_line_2, city, state, zip, phone, website, next_due_calculation_method, logo_url",
    )
    .maybeSingle();

  if (!company) {
    throw new Error("Missing company record");
  }

  const method: DueDateMethod = (
    dueDateMethods as readonly string[]
  ).includes(company.next_due_calculation_method)
    ? (company.next_due_calculation_method as DueDateMethod)
    : "test_date_plus_year";

  const logoPreviewUrl = company.logo_url
    ? await createLogoPreviewUrl(supabase, company.logo_url)
    : null;

  return (
    <div className="space-y-6">
      <DueDateMethodCard companyId={company.id} initial={method} />
      <LogoUpload
        companyId={company.id}
        initialLogoUrl={company.logo_url}
        initialPreviewUrl={logoPreviewUrl}
      />
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
        }}
      />
    </div>
  );
}
