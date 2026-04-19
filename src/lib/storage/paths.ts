import { isUuid } from "@/lib/db/client";

// Storage path builders for Phase 4 buckets. Leading path segment is
// always the caller's company_id — matches the RLS policy that gates
// storage.objects on (storage.foldername(name))[1] = user_company_id().

export const BUCKET_CERTIFICATES = "certificates";
export const BUCKET_COMPANY_LOGOS = "company-logos";

// Extensions the UI accepts for logo upload. Matches what
// @react-pdf/renderer's <Image> renders natively.
export const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;
export type LogoExtension = (typeof LOGO_EXTENSIONS)[number];

export function isLogoExtension(s: string): s is LogoExtension {
  return (LOGO_EXTENSIONS as readonly string[]).includes(s);
}

// Mime type for a given extension. PDF and storage expect matching
// Content-Type headers so the file serves cleanly via signed URL.
export const LOGO_CONTENT_TYPES: Record<LogoExtension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function certificatePath(
  companyId: string,
  testResultId: string,
): string {
  if (!isUuid(companyId)) throw new Error("certificatePath: bad companyId");
  if (!isUuid(testResultId))
    throw new Error("certificatePath: bad testResultId");
  return `${companyId}/${testResultId}.pdf`;
}

export function logoPath(companyId: string, ext: string): string {
  if (!isUuid(companyId)) throw new Error("logoPath: bad companyId");
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!isLogoExtension(e))
    throw new Error(`logoPath: unsupported extension "${ext}"`);
  return `${companyId}/logo.${e}`;
}

// Extract the extension from a stored logo path, e.g. "<uuid>/logo.png"
// → "png". Returns null when the path doesn't match the expected shape.
// Used when converting a stored logo back to a data URL for the PDF —
// we need the ext to set the correct data-URL mime type.
export function extractLogoExtension(path: string): LogoExtension | null {
  const m = path.match(/\/logo\.([a-z0-9]+)$/i);
  if (!m) return null;
  const e = m[1].toLowerCase();
  return isLogoExtension(e) ? e : null;
}
