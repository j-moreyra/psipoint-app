import { z } from "zod";
import {
  nullIfEmpty,
  optionalStateCode,
  optionalText,
} from "@/lib/validation/fields";

// Customer is the billing entity. Every field is optional at the type
// level; the DB enforces "at least one of company_name / contact names"
// via the `customers_name_required` CHECK, and we mirror that here for a
// friendly UX before the round-trip.
const customerBase = z.object({
  contact_first_name: optionalText,
  contact_last_name: optionalText,
  company_name: optionalText,
  email: optionalText,
  phone: optionalText,
  billing_address_line_1: optionalText,
  billing_address_line_2: optionalText,
  billing_city: optionalText,
  billing_state: optionalStateCode,
  billing_zip: optionalText,
  notes: optionalText,
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
    phone: nullIfEmpty(v.phone),
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
    service_location_nickname: optionalText,
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
