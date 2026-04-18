import { z } from "zod";
import {
  optionalDate,
  optionalStateCode,
  optionalText,
  requiredDate,
  requiredText,
  undefinedIfEmpty,
} from "@/lib/validation/fields";

export const dueDateMethods = [
  "test_date_plus_year",
  "anniversary",
  "calendar_year_end",
  "custom",
] as const;

export type DueDateMethod = (typeof dueDateMethods)[number];

export const dueDateMethodLabels: Record<DueDateMethod, string> = {
  test_date_plus_year: "One year from each test date",
  anniversary: "Anniversary of first test",
  calendar_year_end: "End of calendar year",
  custom: "Custom (set per-device)",
};

// next_due_calculation_method is NOT collected during onboarding — new
// companies get the Postgres default ('test_date_plus_year'). Testers
// who need a different rule can change it later in /settings/company.
export const onboardingSchema = z.object({
  // company
  company_name: requiredText("Company name is required"),
  company_address_line_1: optionalText,
  company_address_line_2: optionalText,
  company_city: optionalText,
  company_state: optionalStateCode,
  company_zip: optionalText,
  company_phone: optionalText,
  company_website: optionalText,
  // tester
  first_name: requiredText("First name is required"),
  last_name: requiredText("Last name is required"),
  tester_phone: optionalText,
  license_number: requiredText("License number is required"),
  license_expiration: requiredDate,
  license_issuing_authority: optionalText,
  test_gauge_serial: optionalText,
  test_gauge_calibration_date: optionalDate,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Fields that belong to Step 1. Used by the form's "Next" button to
// validate only the company half before advancing.
export const step1Fields = [
  "company_name",
  "company_address_line_1",
  "company_address_line_2",
  "company_city",
  "company_state",
  "company_zip",
  "company_phone",
  "company_website",
] as const satisfies readonly (keyof OnboardingInput)[];

// Shape the validated form values into the RPC argument object Supabase
// expects. Empty strings become undefined so Postgres applies the param
// defaults (including next_due_calculation_method, which onboarding
// doesn't collect).
export function toOnboardingRpcArgs(v: OnboardingInput) {
  return {
    p_company_name: v.company_name,
    p_first_name: v.first_name,
    p_last_name: v.last_name,
    p_license_number: v.license_number,
    p_license_expiration: v.license_expiration,
    p_company_address_line_1: undefinedIfEmpty(v.company_address_line_1),
    p_company_address_line_2: undefinedIfEmpty(v.company_address_line_2),
    p_company_city: undefinedIfEmpty(v.company_city),
    p_company_state: undefinedIfEmpty(v.company_state.toUpperCase()),
    p_company_zip: undefinedIfEmpty(v.company_zip),
    p_company_phone: undefinedIfEmpty(v.company_phone),
    p_company_website: undefinedIfEmpty(v.company_website),
    p_tester_phone: undefinedIfEmpty(v.tester_phone),
    p_license_issuing_authority: undefinedIfEmpty(v.license_issuing_authority),
    p_test_gauge_serial: undefinedIfEmpty(v.test_gauge_serial),
    p_test_gauge_calibration_date: undefinedIfEmpty(
      v.test_gauge_calibration_date,
    ),
  };
}
