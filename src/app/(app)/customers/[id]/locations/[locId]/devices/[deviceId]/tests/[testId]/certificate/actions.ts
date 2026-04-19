"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCertificateContext } from "@/lib/db/test-results";
import { buildCertificateData } from "@/lib/pdf/certificate-data";
import { renderCertificatePdf } from "@/lib/pdf/render";
import {
  createCertificateSignedUrl,
  uploadCertificatePdf,
} from "@/lib/storage/certificates";
import { fetchCompanyLogoDataUrl } from "@/lib/storage/logos";
import { certificatePath } from "@/lib/storage/paths";
import { BUCKET_CERTIFICATES } from "@/lib/storage/paths";
import {
  buildCertificateEmailPayload,
} from "@/lib/email/certificate-email";
import {
  isValidRecipientEmail,
} from "@/lib/email/recipients";
import { sendCertificateEmail } from "@/lib/email/client";

// Discriminated result types — client reads `ok` to branch on
// success/error; the stage tag tells us which toast copy to show.
export type GenerateResult =
  | { ok: true; signedUrl: string }
  | { ok: false; stage: "fetch" | "pdf" | "storage" | "db" };

export type SendResult =
  | { ok: true }
  | { ok: false; stage: "fetch" | "not_ready" | "bad_email" | "download" | "email" | "db" };

// -----------------------------------------------------------------------------
// generateCertificate
// -----------------------------------------------------------------------------

export async function generateCertificate(
  testResultId: string,
): Promise<GenerateResult> {
  const supabase = await createClient();

  // ---- 1. Fetch + shape ------------------------------------------------------
  let ctx;
  try {
    ctx = await getCertificateContext(supabase, testResultId);
  } catch {
    return { ok: false, stage: "fetch" };
  }
  if (!ctx) return { ok: false, stage: "fetch" };

  const data = buildCertificateData(ctx);

  // ---- 2. Fetch logo (best-effort) -------------------------------------------
  // Logo missing shouldn't block certificate generation — the template
  // falls back to text-only header. Fetch failures are swallowed here.
  let logoSrc: string | undefined;
  if (data.company.logoUrl) {
    try {
      const url = await fetchCompanyLogoDataUrl(supabase, data.company.logoUrl);
      if (url) logoSrc = url;
    } catch {
      // Continue without logo. Non-fatal.
    }
  }

  // ---- 3. Render PDF ---------------------------------------------------------
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderCertificatePdf({ data, logoSrc });
  } catch {
    return { ok: false, stage: "pdf" };
  }

  // ---- 4. Upload to storage --------------------------------------------------
  // Path convention: <company_id>/<test_result_id>.pdf. Upsert=true
  // makes regeneration idempotent — same key, overwritten bytes.
  try {
    await uploadCertificatePdf(
      supabase,
      data.company.id,
      data.testResultId,
      pdfBuffer,
    );
  } catch {
    return { ok: false, stage: "storage" };
  }

  // ---- 5. Stamp pdf_url on test_results --------------------------------------
  try {
    const path = certificatePath(data.company.id, data.testResultId);
    const { error } = await supabase
      .from("test_results")
      .update({ pdf_url: `${BUCKET_CERTIFICATES}/${path}` })
      .eq("id", data.testResultId);
    if (error) throw error;
  } catch {
    return { ok: false, stage: "db" };
  }

  // ---- 6. Short-lived signed URL for the immediate download --------------
  let signedUrl: string;
  try {
    signedUrl = await createCertificateSignedUrl(
      supabase,
      data.company.id,
      data.testResultId,
    );
  } catch {
    return { ok: false, stage: "storage" };
  }

  // Revalidate the page so the server component re-reads pdf_url.
  revalidatePath(
    `/customers/${data.customer.id}/locations/${data.serviceLocation.id}/devices/${data.device.id}/tests/${data.testResultId}/certificate`,
  );

  return { ok: true, signedUrl };
}

// -----------------------------------------------------------------------------
// sendCertificate — assumes the PDF has already been generated.
// -----------------------------------------------------------------------------

export async function sendCertificate(
  testResultId: string,
  recipientEmail: string,
): Promise<SendResult> {
  if (!isValidRecipientEmail(recipientEmail)) {
    return { ok: false, stage: "bad_email" };
  }

  const supabase = await createClient();

  let ctx;
  try {
    ctx = await getCertificateContext(supabase, testResultId);
  } catch {
    return { ok: false, stage: "fetch" };
  }
  if (!ctx) return { ok: false, stage: "fetch" };
  if (!ctx.pdfUrl) return { ok: false, stage: "not_ready" };

  const data = buildCertificateData(ctx);

  // ---- Download the PDF from storage ----------------------------------------
  let pdfBuffer: Buffer;
  try {
    const { data: blob, error } = await supabase.storage
      .from(BUCKET_CERTIFICATES)
      .download(certificatePath(data.company.id, data.testResultId));
    if (error || !blob) throw error ?? new Error("missing pdf");
    pdfBuffer = Buffer.from(await blob.arrayBuffer());
  } catch {
    return { ok: false, stage: "download" };
  }

  // ---- Build + send email ---------------------------------------------------
  try {
    const payload = await buildCertificateEmailPayload({
      data,
      recipientEmail,
      pdfBuffer,
    });
    await sendCertificateEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachment: payload.attachment,
    });
  } catch {
    return { ok: false, stage: "email" };
  }

  // ---- Stamp emailed_at / emailed_to ----------------------------------------
  try {
    const { error } = await supabase
      .from("test_results")
      .update({
        emailed_at: new Date().toISOString(),
        emailed_to: recipientEmail,
      })
      .eq("id", data.testResultId);
    if (error) throw error;
  } catch {
    return { ok: false, stage: "db" };
  }

  revalidatePath(
    `/customers/${data.customer.id}/locations/${data.serviceLocation.id}/devices/${data.device.id}/tests/${data.testResultId}/certificate`,
  );

  return { ok: true };
}

// -----------------------------------------------------------------------------
// Refresh the signed URL — for the "Download" button when the page has
// been open past the 60s URL TTL.
// -----------------------------------------------------------------------------

export async function refreshCertificateDownloadUrl(
  testResultId: string,
): Promise<{ ok: true; signedUrl: string } | { ok: false }> {
  const supabase = await createClient();
  let ctx;
  try {
    ctx = await getCertificateContext(supabase, testResultId);
  } catch {
    return { ok: false };
  }
  if (!ctx || !ctx.pdfUrl) return { ok: false };

  try {
    const signedUrl = await createCertificateSignedUrl(
      supabase,
      ctx.company.id,
      ctx.testResult.id,
    );
    return { ok: true, signedUrl };
  } catch {
    return { ok: false };
  }
}
