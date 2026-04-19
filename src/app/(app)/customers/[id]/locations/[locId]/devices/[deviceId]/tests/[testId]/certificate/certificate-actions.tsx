"use client";

import { useState } from "react";
import { DownloadIcon, FileTextIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { cn } from "@/lib/utils";
import {
  isValidRecipientEmail,
  type CertificateRecipientOption,
} from "@/lib/email/recipients";
import {
  generateCertificate,
  refreshCertificateDownloadUrl,
  sendCertificate,
} from "./actions";
import { generateErrorCopy, sendErrorCopy } from "./error-copy";

type CertificateActionsProps = {
  testResultId: string;
  initialGenerated: boolean;
  initialEmailedAt: string | null;
  initialEmailedTo: string | null;
  recipientOptions: CertificateRecipientOption[];
};

export function CertificateActions({
  testResultId,
  initialGenerated,
  initialEmailedAt,
  initialEmailedTo,
  recipientOptions,
}: CertificateActionsProps) {
  const [generated, setGenerated] = useState(initialGenerated);
  const [emailedAt, setEmailedAt] = useState(initialEmailedAt);
  const [emailedTo, setEmailedTo] = useState(initialEmailedTo);

  const [gBusy, setGBusy] = useState(false);
  const [dBusy, setDBusy] = useState(false);
  const [sBusy, setSBusy] = useState(false);

  // Default to the first non-custom option when available.
  const firstConcrete = recipientOptions.find(
    (o): o is Exclude<CertificateRecipientOption, { kind: "custom" }> =>
      o.kind !== "custom",
  );
  const [pickerChoice, setPickerChoice] = useState<
    "billing" | "on_site" | "custom"
  >(firstConcrete?.kind ?? "custom");
  const [customEmail, setCustomEmail] = useState("");

  async function onGenerate() {
    setGBusy(true);
    const res = await generateCertificate(testResultId);
    setGBusy(false);
    if (!res.ok) {
      toast.error(generateErrorCopy(res.stage));
      return;
    }
    setGenerated(true);
    window.open(res.signedUrl, "_blank", "noopener");
    toast.success("Certificate generated.");
  }

  async function onDownload() {
    setDBusy(true);
    const res = await refreshCertificateDownloadUrl(testResultId);
    setDBusy(false);
    if (!res.ok) {
      toast.error("Couldn't open the certificate. Try regenerating.");
      return;
    }
    window.open(res.signedUrl, "_blank", "noopener");
  }

  async function onSend() {
    const email = resolveRecipient(pickerChoice, recipientOptions, customEmail);
    if (!email) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSBusy(true);
    const res = await sendCertificate(testResultId, email);
    setSBusy(false);
    if (!res.ok) {
      toast.error(sendErrorCopy(res.stage));
      return;
    }
    setEmailedAt(new Date().toISOString());
    setEmailedTo(email);
    toast.success(`Sent to ${email}.`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Certificate PDF</h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {generated
            ? "Ready. Download or email below."
            : "Not yet generated."}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={generated ? "outline" : "default"}
            size="sm"
            onClick={onGenerate}
            disabled={gBusy || dBusy || sBusy}
          >
            {gBusy
              ? generated
                ? "Regenerating…"
                : "Generating…"
              : generated
                ? "Regenerate"
                : "Generate PDF"}
          </Button>
          {generated ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onDownload}
              disabled={gBusy || dBusy || sBusy}
            >
              <DownloadIcon className="size-4" />
              {dBusy ? "Opening…" : "Download"}
            </Button>
          ) : null}
        </div>
      </section>

      <section
        className={cn(
          "rounded-lg border bg-card p-5 shadow-sm",
          !generated && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2">
          <MailIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Email certificate</h2>
        </div>
        {!generated ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Generate the PDF first.
          </p>
        ) : emailedAt ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last sent to{" "}
            <span className="font-medium">{emailedTo}</span> on{" "}
            {formatTs(emailedAt)}. Sending again overwrites the record.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick a recipient. The attached PDF matches the latest
            generated certificate.
          </p>
        )}

        <fieldset
          className="mt-4 space-y-3 border-0 p-0 m-0 min-w-0"
          disabled={!generated || sBusy}
        >
          <div
            role="radiogroup"
            aria-label="Recipient"
            className="space-y-2"
          >
            {recipientOptions.map((opt) => (
              <label
                key={opt.kind}
                className="flex cursor-pointer items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  className="mt-0.5 accent-primary"
                  name="recipient"
                  value={opt.kind}
                  checked={pickerChoice === opt.kind}
                  onChange={() => setPickerChoice(opt.kind)}
                />
                <span className="flex-1 text-sm">
                  {opt.kind === "custom"
                    ? "Another email address"
                    : opt.label}
                </span>
              </label>
            ))}
          </div>

          {pickerChoice === "custom" ? (
            <Field id="custom_email" label="Email address">
              <Input
                id="custom_email"
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
              />
            </Field>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              size="sm"
              onClick={onSend}
              disabled={!generated || sBusy}
            >
              {sBusy ? "Sending…" : "Send email"}
            </Button>
          </div>
        </fieldset>
      </section>
    </div>
  );
}

function resolveRecipient(
  choice: "billing" | "on_site" | "custom",
  options: CertificateRecipientOption[],
  customEmail: string,
): string | null {
  if (choice === "custom") {
    const trimmed = customEmail.trim();
    return isValidRecipientEmail(trimmed) ? trimmed : null;
  }
  const match = options.find((o) => o.kind === choice);
  if (match && match.kind !== "custom") return match.email;
  return null;
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
