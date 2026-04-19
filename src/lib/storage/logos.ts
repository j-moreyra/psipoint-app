import type { DbClient } from "@/lib/db/client";
import {
  BUCKET_COMPANY_LOGOS,
  extractLogoExtension,
  LOGO_CONTENT_TYPES,
  logoPath,
  type LogoExtension,
} from "./paths";

export async function uploadCompanyLogo(
  db: DbClient,
  companyId: string,
  ext: LogoExtension,
  bytes: Buffer | Blob,
): Promise<{ path: string }> {
  const path = logoPath(companyId, ext);
  const { error } = await db.storage
    .from(BUCKET_COMPANY_LOGOS)
    .upload(path, bytes, {
      contentType: LOGO_CONTENT_TYPES[ext],
      upsert: true,
    });
  if (error) throw error;
  return { path };
}

// Downloads the logo, converts to a data URL suitable for
// @react-pdf/renderer's <Image src>. Certificate rendering happens
// server-side with a short-lived tester session, so we don't need to
// sign anything — just download via the same RLS boundary.
export async function fetchCompanyLogoDataUrl(
  db: DbClient,
  storagePath: string,
): Promise<string | null> {
  const ext = extractLogoExtension(storagePath);
  if (!ext) return null;
  const { data, error } = await db.storage
    .from(BUCKET_COMPANY_LOGOS)
    .download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${LOGO_CONTENT_TYPES[ext]};base64,${buf.toString("base64")}`;
}

export async function deleteCompanyLogo(
  db: DbClient,
  storagePath: string,
): Promise<void> {
  const { error } = await db.storage
    .from(BUCKET_COMPANY_LOGOS)
    .remove([storagePath]);
  if (error) throw error;
}

// Signed URL for preview rendering in the UI. Private bucket + RLS
// means direct `<img src="...">` against the raw path won't work.
// 5-minute TTL — long enough that re-renders on the settings page
// don't re-fetch constantly; short enough that a leaked link is
// low-value.
export const LOGO_PREVIEW_URL_SECONDS = 300;

export async function createLogoPreviewUrl(
  db: DbClient,
  storagePath: string,
  expiresInSec: number = LOGO_PREVIEW_URL_SECONDS,
): Promise<string | null> {
  const { data, error } = await db.storage
    .from(BUCKET_COMPANY_LOGOS)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) return null;
  return data.signedUrl;
}
