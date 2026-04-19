import "server-only";
import { Resend } from "resend";

// Lazy-init Resend client. Env lookup happens on first send rather than
// at module load so a missing key doesn't crash unrelated imports
// during dev. Throws with a friendly-enough message if the env is
// misconfigured — wrapper above maps this to a user-facing toast.

let _client: Resend | null = null;

function getResendClient(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  _client = new Resend(key);
  return _client;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not set");
  }
  return from;
}

export type SendCertificateEmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: { filename: string; content: Buffer };
};

// One-shot send wrapper. Callers (server actions) catch any throw and
// map to emailErrorMessage() — we don't swallow here because the
// caller also needs to know whether to stamp emailed_at.
export async function sendCertificateEmail(
  args: SendCertificateEmailArgs,
): Promise<{ id: string | null }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: [
      {
        filename: args.attachment.filename,
        content: args.attachment.content,
      },
    ],
  });
  if (error) {
    throw error;
  }
  return { id: data?.id ?? null };
}
