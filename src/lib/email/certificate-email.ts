import { render } from "@react-email/render";
import type { CertificateData } from "@/lib/pdf/certificate-data";
import {
  CertificateReadyEmail,
  certificateReadyPlainText,
} from "./templates/certificate-ready";

// Renders the certificate email into the shape Resend wants. Kept
// separate from the Resend client wrapper so tests can assert the
// payload without mocking the SDK.
//
// `from` is taken from the RESEND_FROM_EMAIL env at send time; this
// function only produces the content.

export type CertificateEmailPayload = {
  subject: string;
  to: string;
  html: string;
  text: string;
  attachment: {
    filename: string;
    content: Buffer;
  };
};

export type BuildEmailInput = {
  data: CertificateData;
  recipientEmail: string;
  pdfBuffer: Buffer;
};

export function certificateEmailSubject(data: CertificateData): string {
  const outcome = data.test.effectiveResult === "pass" ? "passed" : "failed";
  return `Backflow test ${outcome} — ${data.device.serialNumber} · ${data.test.date}`;
}

export function certificateAttachmentFilename(
  data: CertificateData,
): string {
  // No slashes or path separators — filename only. Serial can carry
  // characters that some mail clients misinterpret (e.g. "#"), so
  // normalize to a conservative set.
  const safeSerial = data.device.serialNumber.replace(/[^\w.-]/g, "_");
  return `backflow-test-${safeSerial}-${data.test.date}.pdf`;
}

export async function buildCertificateEmailPayload(
  input: BuildEmailInput,
): Promise<CertificateEmailPayload> {
  const { data, recipientEmail, pdfBuffer } = input;
  const html = await render(CertificateReadyEmail({ data }));
  const textBody = certificateReadyPlainText(data);

  return {
    subject: certificateEmailSubject(data),
    to: recipientEmail,
    html,
    text: textBody,
    attachment: {
      filename: certificateAttachmentFilename(data),
      content: pdfBuffer,
    },
  };
}
