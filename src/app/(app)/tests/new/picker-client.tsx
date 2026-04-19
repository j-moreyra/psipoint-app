"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BuildingIcon,
  ChevronRightIcon,
  Loader2Icon,
  MapPinIcon,
  PackageSearchIcon,
  PlusIcon,
  SearchIcon,
  WrenchIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DbClient } from "@/lib/db/client";
import {
  MIN_CHARS_NAME,
  MIN_CHARS_SERIAL,
  deviceSearchLocationLabel,
  unifiedSearch,
  type CustomerSearchRow,
  type DeviceSearchRow,
  type ServiceLocationSearchRow,
  type UnifiedSearchResult,
} from "@/lib/db/search";
import { customerDisplayName } from "@/lib/db/customers";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

const EMPTY: UnifiedSearchResult = {
  customers: [],
  serviceLocations: [],
  devices: [],
};

type Tab = "customer" | "serial";

// Dashboard CTA entry point. Two tabs because the common field
// workflow splits cleanly — tester either knows the customer's name
// or is already standing next to a device and can read the serial.
// The Q13 zero-result chain is wired in unit 10 via the stub below.
export function TestPickerClient() {
  const [tab, setTab] = useState<Tab>("customer");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [db] = useState<DbClient>(() => createClient() as unknown as DbClient);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const r = await unifiedSearch(db, trimmed);
        if (!cancelled) {
          setResults(r);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setResults(EMPTY);
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, db]);

  // Tab swap: clear the query so the placeholder text refreshes to
  // the new tab's guidance. Re-focus the input so mobile keyboards
  // stay up.
  function switchTab(next: Tab) {
    setTab(next);
    setQuery("");
    setResults(EMPTY);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const trimmed = query.trim();
  const isCustomerTab = tab === "customer";

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Test entry mode"
        className="grid grid-cols-2 rounded-lg border bg-muted/30 p-1 text-sm"
      >
        <TabButton
          selected={isCustomerTab}
          onClick={() => switchTab("customer")}
        >
          <BuildingIcon className="size-4" />
          Find customer
        </TabButton>
        <TabButton
          selected={!isCustomerTab}
          onClick={() => switchTab("serial")}
        >
          <PackageSearchIcon className="size-4" />
          Enter serial
        </TabButton>
      </div>

      <div className="relative">
        {loading ? (
          <Loader2Icon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : (
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isCustomerTab
              ? "Customer name, location nickname, or address..."
              : "Device serial number..."
          }
          inputMode={isCustomerTab ? "text" : "search"}
          autoComplete="off"
          autoCapitalize={isCustomerTab ? "words" : "characters"}
          aria-label={isCustomerTab ? "Customer search" : "Serial search"}
          className={cn(
            "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent pl-9 pr-3 text-base transition-colors outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "dark:bg-input/30",
          )}
        />
      </div>

      <TabHint tab={tab} query={trimmed} />

      {isCustomerTab ? (
        <CustomerTabResults results={results} query={trimmed} loading={loading} />
      ) : (
        <SerialTabResults results={results} query={trimmed} loading={loading} />
      )}
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Below-the-input guidance that flips with the tab. Especially useful
// on the serial tab where the 3-char minimum is a Q4 decision the
// tester shouldn't have to discover via silence.
function TabHint({ tab, query }: { tab: Tab; query: string }) {
  if (query.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {tab === "customer"
          ? `Type at least ${MIN_CHARS_NAME} characters to search names and addresses.`
          : `Type at least ${MIN_CHARS_SERIAL} characters — serial search uses fuzzy matching so small typos are fine.`}
      </p>
    );
  }
  const min = tab === "customer" ? MIN_CHARS_NAME : MIN_CHARS_SERIAL;
  if (query.length < min) {
    return (
      <p className="text-xs text-muted-foreground">
        {`Keep typing — ${min - query.length} more character${
          min - query.length === 1 ? "" : "s"
        } to go.`}
      </p>
    );
  }
  return null;
}

function CustomerTabResults({
  results,
  query,
  loading,
}: {
  results: UnifiedSearchResult;
  query: string;
  loading: boolean;
}) {
  if (query.length < MIN_CHARS_NAME) return null;

  const customers = results.customers;
  const locations = results.serviceLocations;
  const total = customers.length + locations.length;

  if (loading && total === 0) {
    return <LoadingCard />;
  }

  if (total === 0) {
    return (
      <EmptyCard>
        No customer or service location matches{" "}
        <strong className="font-medium text-foreground">
          {`"${query}"`}
        </strong>
        . Check spelling, or{" "}
        <Link
          href="/customers/new"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          add a new customer
        </Link>
        .
      </EmptyCard>
    );
  }

  return (
    <div className="space-y-4">
      {customers.length > 0 ? (
        <ResultSection
          title="Customers"
          icon={<BuildingIcon className="size-3.5" />}
        >
          {customers.map((c) => (
            <PickerCustomerRow key={c.id} customer={c} />
          ))}
        </ResultSection>
      ) : null}
      {locations.length > 0 ? (
        <ResultSection
          title="Service locations"
          icon={<MapPinIcon className="size-3.5" />}
        >
          {locations.map((l) => (
            <PickerLocationRow key={l.id} location={l} />
          ))}
        </ResultSection>
      ) : null}
    </div>
  );
}

function SerialTabResults({
  results,
  query,
  loading,
}: {
  results: UnifiedSearchResult;
  query: string;
  loading: boolean;
}) {
  if (query.length < MIN_CHARS_SERIAL) return null;

  const devices = results.devices;

  if (loading && devices.length === 0) {
    return <LoadingCard />;
  }

  if (devices.length === 0) {
    // Q13: zero-result stub — unit 10 replaces this CTA with the real
    // add-new-device chain (?returnTo=...&serial=<q> through the
    // existing customer + location picker to the new-device form).
    return (
      <EmptyCard>
        <div className="space-y-2">
          <p>
            No device found for{" "}
            <strong className="font-mono text-foreground">{query}</strong>.
          </p>
          <AddNewDeviceStub serial={query} />
        </div>
      </EmptyCard>
    );
  }

  return (
    <ResultSection
      title="Devices"
      icon={<WrenchIcon className="size-3.5" />}
    >
      {devices.map((d) => (
        <PickerDeviceRow key={d.device_id} device={d} />
      ))}
    </ResultSection>
  );
}

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul className="overflow-hidden rounded-lg border">{children}</ul>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
      <Loader2Icon className="size-3.5 animate-spin" />
      Searching…
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

// Unit 10 replaces this with a real chain that routes through
// customer + location selection and prefills the serial on the
// new-device form. Left here so the serial-tab zero-result state
// isn't a dead end in the unit 9 → unit 10 interval.
function AddNewDeviceStub({ serial: _serial }: { serial: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Adding a new device from this screen lands in unit 10 — meanwhile
      you can create it from the customer's service location.
    </p>
  );
}

function PickerCustomerRow({ customer }: { customer: CustomerSearchRow }) {
  const name = customerDisplayName(customer);
  const cityState = [customer.billing_city, customer.billing_state]
    .filter(Boolean)
    .join(", ");
  return (
    <li className="border-b last:border-0">
      <Link
        href={`/customers/${customer.id}`}
        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          {cityState ? (
            <div className="truncate text-xs text-muted-foreground">
              {cityState}
            </div>
          ) : null}
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function PickerLocationRow({
  location,
}: {
  location: ServiceLocationSearchRow;
}) {
  const label = location.nickname?.trim() || location.address_line_1;
  const subtitle = [location.address_line_1, location.city]
    .filter((s) => s && s !== label)
    .join(" · ");
  const parentName = customerDisplayName({
    company_name: location.customers?.company_name ?? null,
    contact_first_name: location.customers?.contact_first_name ?? null,
    contact_last_name: location.customers?.contact_last_name ?? null,
  });
  return (
    <li className="border-b last:border-0">
      <Link
        href={`/customers/${location.customer_id}/locations/${location.id}`}
        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[subtitle, parentName].filter(Boolean).join(" — ")}
          </div>
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function PickerDeviceRow({ device }: { device: DeviceSearchRow }) {
  const locationLabel = deviceSearchLocationLabel(device);
  const parentName = customerDisplayName({
    company_name: device.customer_company_name,
    contact_first_name: device.customer_contact_first_name,
    contact_last_name: device.customer_contact_last_name,
  });
  return (
    <li className="border-b last:border-0">
      <Link
        href={`/customers/${device.customer_id}/locations/${device.service_location_id}/devices/${device.device_id}/tests/new`}
        className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 truncate text-sm font-medium">
            <span className="truncate font-mono">{device.serial_number}</span>
            <span className="shrink-0 text-xs font-normal text-muted-foreground">
              {device.manufacturer} {device.model}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {[locationLabel, parentName].filter(Boolean).join(" — ")}
          </div>
        </div>
        <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
