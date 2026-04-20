import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BuildingIcon,
  ClockIcon,
  PlusIcon,
  ZapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  listActiveDevicesForDashboard,
  type DashboardDeviceRow,
} from "@/lib/db/devices";
import {
  listRecentTests,
  type TestResultRecentRow,
} from "@/lib/db/test-results";
import { customerDisplayName } from "@/lib/db/customers";
import {
  DUE_SOON_WINDOW_DAYS,
  bucketByDueStatus,
} from "@/lib/dates/due-status";
import { licenseWarning } from "@/lib/dates/license-warning";
import { LicenseBanner } from "@/components/app/license-banner";

export const metadata: Metadata = { title: "Dashboard" };

// Max rows per due bucket + recent tests on the dashboard. Small-
// shop MVP assumption: a tester rarely has >15 overdue at once. If
// the bucket exceeds the cap, a "+N more" footer lands below — a
// real "show all" page is a Phase 5 thing.
const BUCKET_CAP = 10;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [testerRes, devices, recent] = await Promise.all([
    supabase
      .from("testers")
      .select("first_name, license_expiration, companies(name)")
      .eq("id", user!.id)
      .maybeSingle(),
    listActiveDevicesForDashboard(supabase),
    listRecentTests(supabase),
  ]);

  const tester = testerRes.data;
  const companyName =
    (tester?.companies as { name: string } | null)?.name ?? "your company";

  const buckets = bucketByDueStatus(devices);
  const license = licenseWarning(tester?.license_expiration ?? null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {tester?.first_name ?? "there"}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Running {companyName} on BackFLO.
        </p>
      </div>

      <LicenseBanner warning={license} />

      <div className="flex flex-wrap items-center gap-2">
        <Button nativeButton={false} render={<Link href="/tests/new" />}>
          <ZapIcon className="size-4" />
          Start a test
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/customers" />}
        >
          <BuildingIcon className="size-4" />
          Customers
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/customers/new" />}
        >
          <PlusIcon className="size-4" />
          New customer
        </Button>
      </div>

      <DueSection
        title="Overdue"
        icon={<AlertTriangleIcon className="size-4 text-destructive" />}
        devices={buckets.overdue}
        emptyText="Nothing overdue. Nice."
        tone="destructive"
      />

      <DueSection
        title={`Due soon — next ${DUE_SOON_WINDOW_DAYS} days`}
        icon={<ClockIcon className="size-4 text-amber-600" />}
        devices={buckets.dueSoon}
        emptyText="Clear for the next two months."
        tone="warn"
      />

      <RecentTestsSection tests={recent} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Due section (Overdue / Due Soon)
// ---------------------------------------------------------------------------

function DueSection({
  title,
  icon,
  devices,
  emptyText,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  devices: DashboardDeviceRow[];
  emptyText: string;
  tone: "destructive" | "warn";
}) {
  const rendered = devices.slice(0, BUCKET_CAP);
  const overflow = devices.length - rendered.length;
  const countBadge =
    devices.length > 0 ? (
      <span
        className={
          tone === "destructive"
            ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
            : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
        }
      >
        {devices.length}
      </span>
    ) : null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {countBadge}
      </div>
      {devices.length === 0 ? (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          {emptyText}
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-sm">
          {rendered.map((d) => (
            <DueDeviceRow key={d.id} device={d} />
          ))}
          {overflow > 0 ? (
            <li className="px-4 py-2.5 text-center text-xs text-muted-foreground">
              +{overflow} more — pagination lands in Phase 5.
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function DueDeviceRow({ device }: { device: DashboardDeviceRow }) {
  const locationLabel =
    device.service_locations?.nickname?.trim() ||
    device.service_locations?.address_line_1 ||
    "Unknown location";
  const customerLabel = device.customers
    ? customerDisplayName({
        company_name: device.customers.company_name,
        contact_first_name: device.customers.contact_first_name,
        contact_last_name: device.customers.contact_last_name,
      })
    : "Unknown customer";
  const effectiveDue = device.next_due_override ?? device.next_test_due_date;
  const href = `/customers/${device.customer_id}/locations/${device.service_location_id}/devices/${device.id}`;
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 truncate text-sm font-medium">
            <span className="truncate font-mono">{device.serial_number}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {device.manufacturer} {device.model}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[locationLabel, customerLabel].filter(Boolean).join(" — ")}
          </div>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {effectiveDue
            ? `Due ${effectiveDue}`
            : device.last_tested_date
              ? "No due date"
              : "Never tested"}
        </span>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Recent tests
// ---------------------------------------------------------------------------

function RecentTestsSection({ tests }: { tests: TestResultRecentRow[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Recent tests</h2>
      {tests.length === 0 ? (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
          No tests recorded yet. Your last ten will show up here.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-sm">
          {tests.slice(0, BUCKET_CAP).map((t) => (
            <RecentTestRow key={t.id} test={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentTestRow({ test }: { test: TestResultRecentRow }) {
  // Effective result matches the update_device_last_tested trigger:
  // retest_result wins when set.
  const effective = (test.retest_result ?? test.result) as "pass" | "fail";
  const deviceLabel = test.devices
    ? `${test.devices.serial_number} (${test.devices.manufacturer} ${test.devices.model})`
    : "Unknown device";
  const customerLabel = test.customers
    ? customerDisplayName({
        company_name: test.customers.company_name,
        contact_first_name: test.customers.contact_first_name,
        contact_last_name: test.customers.contact_last_name,
      })
    : "Unknown customer";
  const href = `/customers/${test.customer_id}/locations/${test.service_location_id}/devices/${test.device_id}/tests/${test.id}/certificate`;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
      >
        <ResultDot result={effective} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium">{test.test_date}</span>
            <span className="capitalize text-muted-foreground">
              {effective}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[deviceLabel, customerLabel].filter(Boolean).join(" — ")}
          </div>
        </div>
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
