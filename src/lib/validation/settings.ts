import { z } from "zod";
import { dueDateMethods } from "@/lib/validation/onboarding";
import {
  nullIfEmpty,
  optionalDate,
  optionalStateCode,
  optionalText,
  requiredDate,
  requiredText,
} from "@/lib/validation/fields";

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------
export const companySchema = z.object({
  name: requiredText("Company name is required"),
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

export function toCompanyUpdate(v: CompanyInput) {
  return {
    name: v.name,
    address_line_1: nullIfEmpty(v.address_line_1),
    address_line_2: nullIfEmpty(v.address_line_2),
    city: nullIfEmpty(v.city),
    state: nullIfEmpty(v.state.toUpperCase()),
    zip: nullIfEmpty(v.zip),
    phone: nullIfEmpty(v.phone),
    website: nullIfEmpty(v.website),
    next_due_calculation_method: v.next_due_calculation_method,
  };
}

// ---------------------------------------------------------------------------
// Tester profile settings
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  first_name: requiredText("First name is required"),
  last_name: requiredText("Last name is required"),
  phone: optionalText,
  license_number: requiredText("License number is required"),
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
    phone: nullIfEmpty(v.phone),
    license_number: v.license_number,
    license_expiration: v.license_expiration,
    license_issuing_authority: nullIfEmpty(v.license_issuing_authority),
    test_gauge_serial: nullIfEmpty(v.test_gauge_serial),
    test_gauge_calibration_date: nullIfEmpty(v.test_gauge_calibration_date),
  };
}
