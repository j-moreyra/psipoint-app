import { z } from "zod";
import type { CertificateData } from "@/lib/pdf/certificate-data";

// The options a tester picks from when sending a certificate. "custom"
// falls through to a free-text input on the UI; the other two are
// pre-filled from the customer and service-location rows.
export type CertificateRecipientOption =
  | { kind: "billing"; email: string; label: string }
  | { kind: "on_site"; email: string; label: string }
  | { kind: "custom" };

// Zod email check — reused for the custom-email input and at the
// server boundary before calling Resend. We stay lenient (z.email())
// rather than enforcing MX records; bad sends bounce and are captured
// in Resend's logs.
const emailSchema = z.email("Enter a valid email address");

export function isValidRecipientEmail(s: string): boolean {
  return emailSchema.safeParse(s).success;
}

// Build the recipient picker options from the certificate data. Returns
// only the options that have a concrete email available; the "custom"
// option is appended unconditionally so the UI always offers a free-text
// fallback.
export function buildRecipientOptions(
  data: CertificateData,
): CertificateRecipientOption[] {
  const options: CertificateRecipientOption[] = [];

  const billing = data.customer.email?.trim();
  if (billing && isValidRecipientEmail(billing)) {
    options.push({
      kind: "billing",
      email: billing,
      label: billingLabel(data.customer.displayName, billing),
    });
  }

  const onSite = data.serviceLocation.onSiteContactEmail?.trim();
  // Don't duplicate if on-site email is the same as billing.
  if (
    onSite &&
    isValidRecipientEmail(onSite) &&
    onSite.toLowerCase() !== billing?.toLowerCase()
  ) {
    options.push({
      kind: "on_site",
      email: onSite,
      label: onSiteLabel(data.serviceLocation.onSiteContactName, onSite),
    });
  }

  options.push({ kind: "custom" });
  return options;
}

function billingLabel(customerName: string, email: string): string {
  return `Billing — ${customerName} · ${email}`;
}

function onSiteLabel(
  contactName: string | null,
  email: string,
): string {
  return contactName
    ? `On-site — ${contactName} · ${email}`
    : `On-site — ${email}`;
}
