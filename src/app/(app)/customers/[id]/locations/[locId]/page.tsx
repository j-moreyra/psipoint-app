import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";
import { BackLink } from "@/components/app/back-link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, getCustomer } from "@/lib/db/customers";
import {
  getServiceLocation,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import {
  deviceStatus,
  listDevicesForLocation,
  type DeviceListRow,
  type DeviceStatus,
} from "@/lib/db/devices";
import {
  hazardTypeLabels,
  locationTypeLabels,
  type HazardType,
  type LocationType,
} from "@/lib/validation/service-locations";
import {
  deviceTypeLabels,
  type DeviceType,
} from "@/lib/validation/devices";

export const metadata: Metadata = { title: "Service location" };

export default async function ServiceLocationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locId: string }>;
}) {
  const { id, locId } = await params;
  const supabase = await createClient();

  const [customer, location, devices] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
    listDevicesForLocation(supabase, locId),
  ]);

  if (!customer || !location || location.customer_id !== customer.id) {
    notFound();
  }

  const displayName = serviceLocationDisplayName(location);
  const addressLines = [
    location.address_line_1,
    location.address_line_2,
    [location.city, location.state, location.zip].filter(Boolean).join(", "),
  ].filter((l): l is string => Boolean(l && l.trim() !== ""));

  const contactName = [
    location.on_site_contact_first_name,
    location.on_site_contact_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const locationTypeLabel =
    location.location_type &&
    Object.prototype.hasOwnProperty.call(
      locationTypeLabels,
      location.location_type,
    )
      ? locationTypeLabels[location.location_type as LocationType]
      : null;

  const hazardTypeLabel =
    location.hazard_type &&
    Object.prototype.hasOwnProperty.call(
      hazardTypeLabels,
      location.hazard_type,
    )
      ? hazardTypeLabels[location.hazard_type as HazardType]
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink
          href={`/customers/${customer.id}`}
          label={customerDisplayName(customer)}
        />
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayName}
          </h1>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/customers/${customer.id}/locations/${location.id}/edit`}
              />
            }
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
        </div>
        {!location.is_active ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Deactivated
          </p>
        ) : null}
      </div>

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">
          Location info
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailField label="Address" wide>
            {addressLines.length > 0 ? (
              <span className="whitespace-pre-line">
                {addressLines.join("\n")}
              </span>
            ) : (
              <Muted>None</Muted>
            )}
          </DetailField>
          <DetailField label="Type">
            {locationTypeLabel ?? <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Hazard">
            {hazardTypeLabel ?? <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Water district">
            {location.water_district || <Muted>None</Muted>}
          </DetailField>
          <DetailField label="On-site contact">
            {contactName ? (
              <span>
                {contactName}
                {location.on_site_contact_phone ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {location.on_site_contact_phone}
                  </span>
                ) : null}
              </span>
            ) : (
              <Muted>None</Muted>
            )}
          </DetailField>
          {location.on_site_contact_email ? (
            <DetailField label="Contact email">
              {location.on_site_contact_email}
            </DetailField>
          ) : null}
          {location.access_notes ? (
            <DetailField label="Access notes" wide>
              <span className="whitespace-pre-wrap">
                {location.access_notes}
              </span>
            </DetailField>
          ) : null}
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Devices</h2>
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`/customers/${customer.id}/locations/${location.id}/devices/new`}
              />
            }
          >
            <PlusIcon className="size-4" />
            Add device
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            No devices yet.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card shadow-sm">
            {devices.map((d) => (
              <DeviceRow
                key={d.id}
                device={d}
                href={`/customers/${customer.id}/locations/${location.id}/devices/${d.id}`}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------
function DeviceRow({
  device,
  href,
}: {
  device: DeviceListRow;
  href: string;
}) {
  const status = deviceStatus(device);
  const typeLabel =
    Object.prototype.hasOwnProperty.call(deviceTypeLabels, device.type)
      ? deviceTypeLabels[device.type as DeviceType].split(" — ")[0]
      : device.type;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
      >
        <StatusDot status={status} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {device.serial_number}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[typeLabel, device.manufacturer, device.model, device.size]
              .filter(Boolean)
              .join(" · ")}
            {device.location_description
              ? ` — ${device.location_description}`
              : ""}
          </span>
        </span>
        <StatusLabel status={status} dueDate={effectiveDueDate(device)} />
      </Link>
    </li>
  );
}

function effectiveDueDate(d: DeviceListRow): string | null {
  return d.next_due_override ?? d.next_test_due_date;
}

// ---------------------------------------------------------------------------
// Status UI bits
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
      className={`inline-block size-2 shrink-0 rounded-full ${STATUS_COLOR[status]}`}
    />
  );
}

function StatusLabel({
  status,
  dueDate,
}: {
  status: DeviceStatus;
  dueDate: string | null;
}) {
  return (
    <span className="shrink-0 text-right text-xs text-muted-foreground">
      <span className="block">{STATUS_TEXT[status]}</span>
      {dueDate ? (
        <span className="block">Due {dueDate}</span>
      ) : null}
    </span>
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
