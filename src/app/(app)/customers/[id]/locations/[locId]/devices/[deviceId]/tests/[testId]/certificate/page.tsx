import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { getCertificateContext } from "@/lib/db/test-results";
import { buildCertificateData } from "@/lib/pdf/certificate-data";
import { buildRecipientOptions } from "@/lib/email/recipients";
import { CertificateActions } from "./certificate-actions";

export const metadata: Metadata = { title: "Certificate" };

export default async function CertificatePage({
  params,
}: {
  params: Promise<{
    id: string;
    locId: string;
    deviceId: string;
    testId: string;
  }>;
}) {
  const { id, locId, deviceId, testId } = await params;
  const supabase = await createClient();
  const ctx = await getCertificateContext(supabase, testId);

  // Defense-in-depth chain: a user could hand-type a URL with a
  // valid test id but wrong parents. Same pattern as the canonical
  // test-form page and the other detail pages.
  if (
    !ctx ||
    ctx.testResult.customer_id !== id ||
    ctx.testResult.service_location_id !== locId ||
    ctx.testResult.device_id !== deviceId
  ) {
    notFound();
  }

  const data = buildCertificateData(ctx);
  const recipientOptions = buildRecipientOptions(data);

  const backHref = `/customers/${id}/locations/${locId}/devices/${deviceId}`;
  const effectivePassed = data.test.effectiveResult === "pass";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href={backHref} label={data.device.serialNumber} />
        <h1 className="text-2xl font-semibold tracking-tight">
          Test certificate
        </h1>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {data.customer.displayName}
            </p>
            <p className="text-lg font-semibold">
              {data.device.serialNumber}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {data.device.typeLabel}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Tested {data.test.date} by {data.tester.fullName}
            </p>
          </div>
          <ResultBadge
            effectivePassed={effectivePassed}
            afterRetest={data.retest !== null}
          />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Meta label="Certificate #" mono>
            {data.certificateNumber}
          </Meta>
          <Meta label="Gauge">{data.gauge.serial}</Meta>
          <Meta label="Water pressure">
            {data.test.waterSupplyPressure !== null
              ? `${data.test.waterSupplyPressure.toFixed(1)} PSI`
              : "—"}
          </Meta>
        </dl>
      </section>

      <CertificateActions
        testResultId={data.testResultId}
        initialGenerated={ctx.pdfUrl !== null}
        initialEmailedAt={ctx.emailedAt}
        initialEmailedTo={ctx.emailedTo}
        recipientOptions={recipientOptions}
      />
    </div>
  );
}

function ResultBadge({
  effectivePassed,
  afterRetest,
}: {
  effectivePassed: boolean;
  afterRetest: boolean;
}) {
  const color = effectivePassed
    ? "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
    : "border-destructive/50 bg-destructive/10 text-destructive";
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`rounded-md border px-2.5 py-1 text-sm font-semibold uppercase tracking-wide ${color}`}
      >
        {effectivePassed ? "Pass" : "Fail"}
      </span>
      {afterRetest ? (
        <span className="text-[10px] text-muted-foreground">
          (after retest)
        </span>
      ) : null}
    </div>
  );
}

function Meta({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? "mt-0.5 font-mono text-sm" : "mt-0.5 text-sm"}>
        {children}
      </dd>
    </div>
  );
}
