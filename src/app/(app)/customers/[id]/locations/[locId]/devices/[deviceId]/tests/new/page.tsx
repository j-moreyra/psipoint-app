import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { getCustomer, customerDisplayName } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import { getDevice } from "@/lib/db/devices";
import { getMostRecentTesterTest } from "@/lib/db/test-results";
import {
  deviceTypeLabels,
  deviceTypes,
  type DeviceType,
} from "@/lib/validation/devices";
import { TestForm } from "./test-form";

export const metadata: Metadata = { title: "New test" };

// Format today as "YYYY-MM-DD" against the server's local wall clock
// so the default test_date lines up with how a tester thinks about
// the date even if they're a few timezones east or west of the
// server. Phase 5 can move this client-side to get the tester's own
// wall clock exactly.
function todayYmdServerLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NewTestPage({
  params,
}: {
  params: Promise<{ id: string; locId: string; deviceId: string }>;
}) {
  const { id, locId, deviceId } = await params;
  const supabase = await createClient();

  const { data: authUser } = await supabase.auth.getUser();
  // Middleware blocks unauthed access to (app)/*, so authUser is set —
  // guard anyway so tsc can narrow.
  if (!authUser.user) redirect("/login");

  const [customer, location, device, testerRes] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
    getDevice(supabase, deviceId),
    supabase
      .from("testers")
      .select(
        "id, first_name, last_name, license_number, license_expiration, test_gauge_serial, test_gauge_calibration_date",
      )
      .eq("id", authUser.user.id)
      .maybeSingle(),
  ]);

  // Defense-in-depth chain: search/QR/stale URL can land here with a
  // device that belongs to a different customer+location. Same pattern
  // as the Phase-2 detail pages.
  if (
    !customer ||
    !location ||
    !device ||
    location.customer_id !== customer.id ||
    device.service_location_id !== location.id
  ) {
    notFound();
  }

  const tester = testerRes.data;
  if (!tester) notFound();

  // Per Phase-2 convention the DB's enum is text; narrow to the
  // app-level DeviceType union. Falls through to RP on unexpected
  // values — the form still renders rather than crashing.
  const deviceType: DeviceType = (
    deviceTypes as readonly string[]
  ).includes(device.type)
    ? (device.type as DeviceType)
    : "RP";

  // Q11: load the tester's most recent submitted test so the form can
  // flag "Last test used gauge X. Still correct?" and the stale-cal
  // hint when the current selection differs. Null when they've never
  // submitted — form just skips the soft notices.
  const lastTest = await getMostRecentTesterTest(supabase, tester.id);

  const locationLabel = serviceLocationDisplayName(location);
  const customerLabel = customerDisplayName(customer);

  const backHref = `/customers/${customer.id}/locations/${location.id}/devices/${device.id}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href={backHref} label={device.serial_number} />
        <h1 className="text-2xl font-semibold tracking-tight">New test</h1>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Testing
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
          <ContextField label="Customer">{customerLabel}</ContextField>
          <ContextField label="Location">{locationLabel}</ContextField>
          <ContextField label="Device">
            <span className="font-mono">{device.serial_number}</span>
            <span className="block text-xs text-muted-foreground">
              {deviceTypeLabels[deviceType]}
            </span>
            <span className="block text-xs text-muted-foreground">
              {device.manufacturer} {device.model} · {device.size}
              {device.location_description
                ? ` · ${device.location_description}`
                : ""}
            </span>
          </ContextField>
          <ContextField label="Tester" wide>
            {tester.first_name} {tester.last_name}
            <span className="text-muted-foreground">
              {` · License `}
              {tester.license_number}
            </span>
          </ContextField>
        </dl>
      </section>

      <TestForm
        deviceId={device.id}
        deviceType={deviceType}
        companyId={device.company_id}
        customerId={customer.id}
        serviceLocationId={location.id}
        testerId={tester.id}
        backHref={backHref}
        smartDefaults={{
          testDate: todayYmdServerLocal(),
          gaugeSerial: tester.test_gauge_serial ?? "",
          gaugeCalibrationDate: tester.test_gauge_calibration_date ?? "",
        }}
        lastTest={lastTest}
      />
    </div>
  );
}

function ContextField({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-3" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
