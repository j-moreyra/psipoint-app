import { z } from "zod";
import { dueDateMethods } from "@/lib/validation/onboarding";

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

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------
export const companySchema = z.object({
  name: required("Company name is required"),
  address_line_1: optionalText,
  address_line_2: optionalText,
  city: optionalText,
  state: optionalStateCode,
  zip: optionalText,
  phone: optionalText,
  website: optionalText,
  next_due_calculation_method: z.enum(dueDateMethods),
});

export type CompanyInput = z.infer<typeof companySchema>;

const nonEmpty = (s: string): string | null => (s.length > 0 ? s : null);

export function toCompanyUpdate(v: CompanyInput) {
  return {
    name: v.name,
    address_line_1: nonEmpty(v.address_line_1),
    address_line_2: nonEmpty(v.address_line_2),
    city: nonEmpty(v.city),
    state: nonEmpty(v.state.toUpperCase()),
    zip: nonEmpty(v.zip),
    phone: nonEmpty(v.phone),
    website: nonEmpty(v.website),
    next_due_calculation_method: v.next_due_calculation_method,
  };
}

// ---------------------------------------------------------------------------
// Tester profile settings
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  first_name: required("First name is required"),
  last_name: required("Last name is required"),
  phone: optionalText,
  license_number: required("License number is required"),
  license_expiration: requiredDate,
  license_issuing_authority: optionalText,
  test_gauge_serial: optionalText,
  test_gauge_calibration_date: optionalDate,
});

export type ProfileInput = z.infer<typeof profileSchema>;

export function toProfileUpdate(v: ProfileInput) {
  return {
    first_name: v.first_name,
    last_name: v.last_name,
    phone: nonEmpty(v.phone),
    license_number: v.license_number,
    license_expiration: v.license_expiration,
    license_issuing_authority: nonEmpty(v.license_issuing_authority),
    test_gauge_serial: nonEmpty(v.test_gauge_serial),
    test_gauge_calibration_date: nonEmpty(v.test_gauge_calibration_date),
  };
}
