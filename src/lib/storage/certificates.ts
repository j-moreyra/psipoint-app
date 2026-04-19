import type { DbClient } from "@/lib/db/client";
import { BUCKET_CERTIFICATES, certificatePath } from "./paths";

// Signed-URL TTL for certificate downloads. 60s is short enough that a
// leaked URL expires before it gets out of the tester's browser; long
// enough to cover a tap-to-download on flaky cellular.
export const CERT_SIGNED_URL_SECONDS = 60;

export async function uploadCertificatePdf(
  db: DbClient,
  companyId: string,
  testResultId: string,
  pdf: Buffer,
): Promise<{ path: string }> {
  const path = certificatePath(companyId, testResultId);
  const { error } = await db.storage
    .from(BUCKET_CERTIFICATES)
    .upload(path, pdf, {
      contentType: "application/pdf",
      // upsert: re-generating the same test's PDF overwrites at the
      // same path. Keeps the op idempotent — retry is safe.
      upsert: true,
    });
  if (error) throw error;
  return { path };
}

export async function createCertificateSignedUrl(
  db: DbClient,
  companyId: string,
  testResultId: string,
  expiresInSec: number = CERT_SIGNED_URL_SECONDS,
): Promise<string> {
  const path = certificatePath(companyId, testResultId);
  const { data, error } = await db.storage
    .from(BUCKET_CERTIFICATES)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}
