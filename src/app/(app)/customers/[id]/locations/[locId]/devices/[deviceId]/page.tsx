import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon, ZapIcon } from "lucide-react";
import { BackLink } from "@/components/app/back-link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import { getDevice } from "@/lib/db/devices";
import {
  listTestsForDevice,
  testerDisplayInitials,
  type TestResultDeviceRow,
} from "@/lib/db/test-results";
import { deviceStatus, type DeviceStatus } from "@/lib/dates/due-status";
import {
  deviceTypeLabels,
  serviceTypeLabels,
  type DeviceServiceType,
  type DeviceType,
} from "@/lib/validation/devices";

export const metadata: Metadata = { title: "Device" };

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string; locId: string; deviceId: string }>;
}) {
  const { id, locId, deviceId } = await params;
  const supabase = await createClient();

  const [customer, location, device, tests] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
    getDevice(supabase, deviceId),
    listTestsForDevice(supabase, deviceId),
  ]);

  if (
    !customer ||
    !location ||
    !device ||
    location.customer_id !== customer.id ||
    device.service_location_id !== location.id
  ) {
    notFound();
  }

  const typeLabel =
    Object.prototype.hasOwnProperty.call(deviceTypeLabels, device.type)
      ? deviceTypeLabels[device.type as DeviceType]
      : device.type;

  const serviceTypeLabel =
    device.service_type &&
    Object.prototype.hasOwnProperty.call(
      serviceTypeLabels,
      device.service_type,
    )
      ? serviceTypeLabels[device.service_type as DeviceServiceType]
      : null;

  const status = deviceStatus(device);
  const effectiveDue = device.next_due_override ?? device.next_test_due_date;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink
          href={`/customers/${customer.id}/locations/${location.id}`}
          label={serviceLocationDisplayName(location)}
        />
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {device.serial_number}
          </h1>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/customers/${customer.id}/locations/${location.id}/devices/${device.id}/edit`}
              />
            }
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
        </div>
        {!device.is_active ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Deactivated
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">
          Device info
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailField label="Type">{typeLabel}</DetailField>
          <DetailField label="Service type">
            {serviceTypeLabel ?? <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Manufacturer">{device.manufacturer}</DetailField>
          <DetailField label="Model">{device.model}</DetailField>
          <DetailField label="Size">{device.size}</DetailField>
          <DetailField label="Install date">
            {device.install_date ?? <Muted>None</Muted>}
          </DetailField>
          <DetailField label="On-site location" wide>
            {device.location_description}
          </DetailField>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">
          Test status
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <StatusDot status={status} />
          <div className="flex-1 text-sm">
            <p className="font-medium">{STATUS_TEXT[status]}</p>
            <p className="text-xs text-muted-foreground">
              {device.last_tested_date
                ? `Last tested ${device.last_tested_date}${
                    device.last_test_result
                      ? ` (${device.last_test_result})`
                      : ""
                  }`
                : "No test records yet."}
              {effectiveDue ? ` · Due ${effectiveDue}` : null}
              {device.next_due_override ? " (override)" : null}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Test history
          </h2>
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/customers/${customer.id}/locations/${location.id}/devices/${device.id}/tests/new`}
              />
            }
          >
            <ZapIcon className="size-4" />
            Start a test
          </Button>
        </div>

        {tests.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            No tests yet. Hit <strong>Start a test</strong> to record the
            first one.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card shadow-sm">
            {tests.map((t) => (
              <TestHistoryRow
                key={t.id}
                test={t}
                certificateHref={`/customers/${customer.id}/locations/${location.id}/devices/${device.id}/tests/${t.id}/certificate`}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Test history row — date · pass/fail dot (post-retest effective) ·
// tester initials · notes snippet. Clicks through to the Phase-4
// certificate page. Hover still renders the full notes via `title`.
function TestHistoryRow({
  test,
  certificateHref,
}: {
  test: TestResultDeviceRow;
  certificateHref: string;
}) {
  // Same effective-result logic as the update_device_last_tested
  // trigger: retest_result wins over the initial result when set.
  const effective = (test.retest_result ?? test.result) as "pass" | "fail";
  const wasRetested = test.retest_result !== null;
  const noteSnippet =
    test.notes && test.notes.length > 90
      ? `${test.notes.slice(0, 88).trimEnd()}…`
      : test.notes;

  return (
    <li title={test.notes ?? undefined}>
      <Link
        href={certificateHref}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <ResultDot result={effective} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium">{test.test_date}</span>
            <span className="capitalize text-muted-foreground">
              {effective}
              {wasRetested && effective === "pass" && test.result === "fail"
                ? " (after retest)"
                : ""}
            </span>
          </div>
          {noteSnippet ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {noteSnippet}
            </p>
          ) : null}
        </div>
        <span
          aria-hidden
          className="shrink-0 rounded-md border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground"
        >
          {testerDisplayInitials(test.testers)}
        </span>
      </Link>
    </li>
  );
}

function ResultDot({ result }: { result: "pass" | "fail" }) {
  return (
    <span
      aria-label={result === "pass" ? "Pass" : "Fail"}
      className={`inline-block size-2.5 shrink-0 rounded-full ${
        result === "pass" ? "bg-emerald-500" : "bg-destructive"
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Status UI — mirrors the row rendering on the service-location detail page.
// ---------------------------------------------------------------------------
const STATUS_COLOR: Record<DeviceStatus, string> = {
  never_tested: "bg-muted-foreground/40",
  overdue: "bg-destructive",
  due_soon: "bg-amber-500",
  current: "bg-emerald-500",
};

const STATUS_TEXT: Record<DeviceStatus, string> = {
  never_tested: "Never tested",
  overdue: "Overdue",
  due_soon: "Due soon",
  current: "Current",
};

function StatusDot({ status }: { status: DeviceStatus }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3 shrink-0 rounded-full ${STATUS_COLOR[status]}`}
    />
  );
}

function DetailField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
