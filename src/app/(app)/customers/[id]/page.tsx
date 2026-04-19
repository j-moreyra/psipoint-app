import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";
import {
  AddDeviceBanner,
  buildReturnToQuery,
} from "@/components/app/add-device-banner";
import { BackLink } from "@/components/app/back-link";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";
import { customerDisplayName, getCustomer } from "@/lib/db/customers";
import {
  listLocationsForCustomer,
  serviceLocationDisplayName,
} from "@/lib/db/service-locations";
import {
  locationTypeLabels,
  type LocationType,
} from "@/lib/validation/service-locations";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; serial?: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [customer, locations] = await Promise.all([
    getCustomer(supabase, id),
    listLocationsForCustomer(supabase, id),
  ]);

  if (!customer) notFound();

  const sp = await searchParams;
  const returnTo = sp.returnTo ? safeNextPath(sp.returnTo, "") : "";
  const serial = sp.serial?.trim() ?? "";
  const inAddDeviceFlow = returnTo !== "" && serial !== "";
  const forwardQuery = inAddDeviceFlow
    ? buildReturnToQuery(returnTo, serial)
    : "";

  const displayName = customerDisplayName(customer);
  const billingLines = [
    customer.billing_address_line_1,
    customer.billing_address_line_2,
    [customer.billing_city, customer.billing_state, customer.billing_zip]
      .filter(Boolean)
      .join(", "),
  ].filter((l): l is string => Boolean(l && l.trim() !== ""));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href="/customers" label="Customers" />
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {displayName}
          </h1>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/customers/${customer.id}/edit`} />}
          >
            <PencilIcon className="size-4" />
            Edit
          </Button>
        </div>
        {!customer.is_active ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Deactivated
          </p>
        ) : null}
      </div>

      {inAddDeviceFlow ? (
        <AddDeviceBanner serial={serial} step="location" />
      ) : null}

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-medium text-muted-foreground">
          Billing info
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <DetailField label="Contact">
            {[customer.contact_first_name, customer.contact_last_name]
              .filter(Boolean)
              .join(" ") || <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Email">
            {customer.email || <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Phone">
            {customer.phone || <Muted>None</Muted>}
          </DetailField>
          <DetailField label="Address">
            {billingLines.length > 0 ? (
              <span className="whitespace-pre-line">
                {billingLines.join("\n")}
              </span>
            ) : (
              <Muted>None</Muted>
            )}
          </DetailField>
          {customer.notes ? (
            <DetailField label="Notes" wide>
              <span className="whitespace-pre-wrap">{customer.notes}</span>
            </DetailField>
          ) : null}
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Service locations
          </h2>
          <Button
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/customers/${customer.id}/locations/new`} />
            }
          >
            <PlusIcon className="size-4" />
            Add location
          </Button>
        </div>

        {locations.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
            No service locations yet.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card shadow-sm">
            {locations.map((l) => {
              const typeLabel =
                l.location_type &&
                Object.prototype.hasOwnProperty.call(
                  locationTypeLabels,
                  l.location_type,
                )
                  ? locationTypeLabels[l.location_type as LocationType]
                  : null;
              return (
                <li key={l.id}>
                  <Link
                    href={`/customers/${customer.id}/locations/${l.id}${forwardQuery}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {serviceLocationDisplayName(l)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[l.address_line_1, l.city, l.state]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </span>
                    {typeLabel ? (
                      <span className="shrink-0 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">
                        {typeLabel}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
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
