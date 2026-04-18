import { z } from "zod";

// Kept as strings (no transforms) so z.infer matches react-hook-form's
// default-values shape. Empty → undefined conversion for optional fields
// happens at RPC-call time via toOnboardingRpcArgs().
const required = (msg: string) => z.string().trim().min(1, msg);
const optionalText = z.string().trim();

const optionalStateCode = z.string().trim().refine(
  (v) => v === "" || /^[A-Za-z]{2}$/.test(v),
  "Use the 2-letter state code",
);

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Required");

const optionalDate = z.string().trim().refine(
  (v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v),
  "Invalid date",
);

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

export const onboardingSchema = z.object({
  // company
  company_name: required("Company name is required"),
  company_address_line_1: optionalText,
  company_address_line_2: optionalText,
  company_city: optionalText,
  company_state: optionalStateCode,
  company_zip: optionalText,
  company_phone: optionalText,
  company_website: optionalText,
  next_due_calculation_method: z.enum(dueDateMethods),
  // tester
  first_name: required("First name is required"),
  last_name: required("Last name is required"),
  tester_phone: optionalText,
  license_number: required("License number is required"),
  license_expiration: requiredDate,
  license_issuing_authority: optionalText,
  test_gauge_serial: optionalText,
  test_gauge_calibration_date: optionalDate,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Fields that belong to Step 1. Used by the form's "Next" button to
// validate only the company half before advancing.
export const STEP_1_FIELDS = [
  "company_name",
  "company_address_line_1",
  "company_address_line_2",
  "company_city",
  "company_state",
  "company_zip",
  "company_phone",
  "company_website",
  "next_due_calculation_method",
] as const satisfies readonly (keyof OnboardingInput)[];

const nonEmpty = (s: string): string | undefined =>
  s.length > 0 ? s : undefined;

// Shape the validated form values into the RPC argument object Supabase
// expects. Empty strings become undefined so Postgres applies defaults.
export function toOnboardingRpcArgs(v: OnboardingInput) {
  return {
    p_company_name: v.company_name,
    p_first_name: v.first_name,
    p_last_name: v.last_name,
    p_license_number: v.license_number,
    p_license_expiration: v.license_expiration,
    p_company_address_line_1: nonEmpty(v.company_address_line_1),
    p_company_address_line_2: nonEmpty(v.company_address_line_2),
    p_company_city: nonEmpty(v.company_city),
    p_company_state: nonEmpty(v.company_state.toUpperCase()),
    p_company_zip: nonEmpty(v.company_zip),
    p_company_phone: nonEmpty(v.company_phone),
    p_company_website: nonEmpty(v.company_website),
    p_next_due_calculation_method: v.next_due_calculation_method,
    p_tester_phone: nonEmpty(v.tester_phone),
    p_license_issuing_authority: nonEmpty(v.license_issuing_authority),
    p_test_gauge_serial: nonEmpty(v.test_gauge_serial),
    p_test_gauge_calibration_date: nonEmpty(v.test_gauge_calibration_date),
  };
}
