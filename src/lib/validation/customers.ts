import { z } from "zod";
import {
  cappedOptionalText,
  FIELD_LIMITS,
  normalizePhoneUs,
  nullIfEmpty,
  optionalEmail,
  optionalStateCode,
  undefinedIfEmpty,
} from "@/lib/validation/fields";

// Customer is the billing entity. Every field is optional at the type
// level; the DB enforces "at least one of company_name / contact names"
// via the `customers_name_required` CHECK, and we mirror that here for a
// friendly UX before the round-trip.
const customerBase = z.object({
  contact_first_name: cappedOptionalText(FIELD_LIMITS.name),
  contact_last_name: cappedOptionalText(FIELD_LIMITS.name),
  company_name: cappedOptionalText(FIELD_LIMITS.orgName),
  email: optionalEmail,
  phone: cappedOptionalText(FIELD_LIMITS.phone),
  billing_address_line_1: cappedOptionalText(FIELD_LIMITS.addressLine),
  billing_address_line_2: cappedOptionalText(FIELD_LIMITS.addressLine),
  billing_city: cappedOptionalText(FIELD_LIMITS.city),
  billing_state: optionalStateCode,
  billing_zip: cappedOptionalText(FIELD_LIMITS.zip),
  notes: cappedOptionalText(FIELD_LIMITS.notes),
});

function requireAName(
  v: z.infer<typeof customerBase>,
  ctx: z.RefinementCtx,
) {
  if (!v.company_name && !v.contact_first_name && !v.contact_last_name) {
    ctx.addIssue({
      code: "custom",
      path: ["company_name"],
      message: "Enter a contact name or company name",
    });
  }
}

export const customerSchema = customerBase.superRefine(requireAName);

export type CustomerInput = z.infer<typeof customerSchema>;

// For edit — sends NULL for empty optional fields so Postgres "unsets" them.
export function toCustomerUpdate(v: CustomerInput) {
  return {
    contact_first_name: nullIfEmpty(v.contact_first_name),
    contact_last_name: nullIfEmpty(v.contact_last_name),
    company_name: nullIfEmpty(v.company_name),
    email: nullIfEmpty(v.email),
    phone: nullIfEmpty(normalizePhoneUs(v.phone)),
    billing_address_line_1: nullIfEmpty(v.billing_address_line_1),
    billing_address_line_2: nullIfEmpty(v.billing_address_line_2),
    billing_city: nullIfEmpty(v.billing_city),
    billing_state: nullIfEmpty(v.billing_state.toUpperCase()),
    billing_zip: nullIfEmpty(v.billing_zip),
    notes: nullIfEmpty(v.notes),
  };
}

// For insert — adds company_id on top of the update payload.
export function toCustomerInsert(v: CustomerInput, companyId: string) {
  return { ...toCustomerUpdate(v), company_id: companyId };
}

// ---------------------------------------------------------------------------
// New-customer form: optional inline service-location creation.
// ---------------------------------------------------------------------------
// Toggle on → treat the billing address as the service address and create
// a service_location in the same round-trip. Billing address fields
// become required at validation time when the toggle is on.
export const newCustomerSchema = customerBase
  .extend({
    create_service_location: z.boolean(),
    service_location_nickname: cappedOptionalText(FIELD_LIMITS.orgName),
  })
  .superRefine((v, ctx) => {
    requireAName(v, ctx);
    if (!v.create_service_location) return;
    const req = (k: keyof typeof v, msg: string) => {
      if (!v[k]) {
        ctx.addIssue({ code: "custom", path: [k], message: msg });
      }
    };
    req("billing_address_line_1", "Required to create a service location");
    req("billing_city", "Required");
    req("billing_state", "Required");
    req("billing_zip", "Required");
  });

export type NewCustomerInput = z.infer<typeof newCustomerSchema>;

// Arg object for the create_customer_with_location RPC. Empty strings
// become undefined so Postgres parameter defaults kick in (matching the
// pattern established by toOnboardingRpcArgs).
export function toCreateCustomerWithLocationArgs(v: NewCustomerInput) {
  return {
    p_contact_first_name: undefinedIfEmpty(v.contact_first_name),
    p_contact_last_name: undefinedIfEmpty(v.contact_last_name),
    p_company_name: undefinedIfEmpty(v.company_name),
    p_email: undefinedIfEmpty(v.email),
    p_phone: undefinedIfEmpty(normalizePhoneUs(v.phone)),
    p_billing_address_line_1: undefinedIfEmpty(v.billing_address_line_1),
    p_billing_address_line_2: undefinedIfEmpty(v.billing_address_line_2),
    p_billing_city: undefinedIfEmpty(v.billing_city),
    p_billing_state: undefinedIfEmpty(v.billing_state.toUpperCase()),
    p_billing_zip: undefinedIfEmpty(v.billing_zip),
    p_notes: undefinedIfEmpty(v.notes),
    p_location_nickname: undefinedIfEmpty(v.service_location_nickname),
  };
}
