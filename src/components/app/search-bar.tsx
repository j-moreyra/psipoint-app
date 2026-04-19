"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BuildingIcon,
  ChevronRightIcon,
  Loader2Icon,
  MapPinIcon,
  SearchIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deviceSearchLocationLabel,
  unifiedSearch,
  type CustomerSearchRow,
  type DeviceSearchRow,
  type ServiceLocationSearchRow,
  type UnifiedSearchResult,
} from "@/lib/db/search";
import { customerDisplayName } from "@/lib/db/customers";
import type { DbClient } from "@/lib/db/client";
import { cn } from "@/lib/utils";

// 200ms (Q4) balances responsive typing against the three-parallel-query
// cost. Stale responses get discarded via the `cancelled` flag so a fast
// typist's earlier queries can't clobber the latest result.
const DEBOUNCE_MS = 200;

const EMPTY: UnifiedSearchResult = {
  customers: [],
  serviceLocations: [],
  devices: [],
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // One client per mount (not per keystroke). createClient() reads
  // env + wires cookies, not cheap enough to redo on every query.
  const [db] = useState<DbClient>(() => createClient() as unknown as DbClient);

  // Cmd/Ctrl-K focuses the search input (desktop keyboard shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Debounced fetch. Each keystroke resets the timer; stale responses
  // get dropped. Old results stay visible while a new fetch is in
  // flight — matches common search-bar UX (GitHub, VS Code command
  // palette) and avoids the mid-typing blank flash.
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
        // Surface-level: silent-fail to empty. Full observability
        // (Sentry) lands in a later phase per HANDOFF "Open items".
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

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setQuery(next);
    setOpen(next.trim().length > 0);
  }

  function handleFocus() {
    if (query.trim().length > 0) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function closePanel() {
    setOpen(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[220px] sm:max-w-xs md:max-w-sm"
    >
      {loading ? (
        <Loader2Icon
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />
      ) : (
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      )}
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Search customers, locations, serials..."
        aria-label="Search customers, service locations, and device serials"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent pl-8 pr-2.5 py-1 text-base transition-colors outline-none",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "md:text-sm dark:bg-input/30",
        )}
      />
      {open ? (
        <div
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          <SearchPanel
            query={query}
            results={results}
            loading={loading}
            onNavigate={closePanel}
          />
        </div>
      ) : null}
    </div>
  );
}

function SearchPanel({
  query,
  results,
  loading,
  onNavigate,
}: {
  query: string;
  results: UnifiedSearchResult;
  loading: boolean;
  onNavigate: () => void;
}) {
  const total =
    results.customers.length +
    results.serviceLocations.length +
    results.devices.length;

  // First-time search with nothing yet — show the searching state so
  // the panel doesn't render as empty while the 200ms debounce + fetch
  // land.
  if (loading && total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        Searching…
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="px-3 py-4 text-sm text-muted-foreground">
        No results for{" "}
        <span className="font-medium text-foreground">
          {`"${query.trim()}"`}
        </span>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto py-1">
      {results.customers.length > 0 ? (
        <Section
          title="Customers"
          icon={<BuildingIcon className="size-3.5" />}
        >
          {results.customers.map((c) => (
            <CustomerRow key={c.id} customer={c} onNavigate={onNavigate} />
          ))}
        </Section>
      ) : null}
      {results.serviceLocations.length > 0 ? (
        <Section
          title="Service locations"
          icon={<MapPinIcon className="size-3.5" />}
        >
          {results.serviceLocations.map((l) => (
            <LocationRow
              key={l.id}
              location={l}
              onNavigate={onNavigate}
            />
          ))}
        </Section>
      ) : null}
      {results.devices.length > 0 ? (
        <Section
          title="Devices"
          icon={<WrenchIcon className="size-3.5" />}
        >
          {results.devices.map((d) => (
            <DeviceRow
              key={d.device_id}
              device={d}
              onNavigate={onNavigate}
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="first:pt-0">
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul>{children}</ul>
    </div>
  );
}

// Shared row layout — primary link on the left (navigates to the
// detail page), "Start Test" button on the right (jumps to the
// test-entry flow per Q8). Rendered as sibling <Link>s inside the
// <li> because nesting anchor tags produces invalid HTML.
function Row({
  detailHref,
  startTestHref,
  onNavigate,
  children,
}: {
  detailHref: string;
  startTestHref: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-accent">
      <Link
        href={detailHref}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">{children}</div>
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
      <Link
        href={startTestHref}
        onClick={onNavigate}
        aria-label="Start test"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ZapIcon className="size-3.5" />
        <span className="hidden sm:inline">Test</span>
      </Link>
    </li>
  );
}

function CustomerRow({
  customer,
  onNavigate,
}: {
  customer: CustomerSearchRow;
  onNavigate: () => void;
}) {
  const name = customerDisplayName(customer);
  const cityState = [customer.billing_city, customer.billing_state]
    .filter(Boolean)
    .join(", ");
  return (
    <Row
      detailHref={`/customers/${customer.id}`}
      startTestHref={`/tests/new?customer=${customer.id}`}
      onNavigate={onNavigate}
    >
      <div className="truncate text-sm font-medium">{name}</div>
      {cityState ? (
        <div className="truncate text-xs text-muted-foreground">{cityState}</div>
      ) : null}
    </Row>
  );
}

function LocationRow({
  location,
  onNavigate,
}: {
  location: ServiceLocationSearchRow;
  onNavigate: () => void;
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
    <Row
      detailHref={`/customers/${location.customer_id}/locations/${location.id}`}
      startTestHref={`/tests/new?customer=${location.customer_id}&location=${location.id}`}
      onNavigate={onNavigate}
    >
      <div className="truncate text-sm font-medium">{label}</div>
      <div className="truncate text-xs text-muted-foreground">
        {[subtitle, parentName].filter(Boolean).join(" — ")}
      </div>
    </Row>
  );
}

function DeviceRow({
  device,
  onNavigate,
}: {
  device: DeviceSearchRow;
  onNavigate: () => void;
}) {
  const locationLabel = deviceSearchLocationLabel(device);
  const parentName = customerDisplayName({
    company_name: device.customer_company_name,
    contact_first_name: device.customer_contact_first_name,
    contact_last_name: device.customer_contact_last_name,
  });
  return (
    <Row
      detailHref={`/customers/${device.customer_id}/locations/${device.service_location_id}/devices/${device.device_id}`}
      startTestHref={`/customers/${device.customer_id}/locations/${device.service_location_id}/devices/${device.device_id}/tests/new`}
      onNavigate={onNavigate}
    >
      <div className="flex items-baseline gap-2 truncate text-sm font-medium">
        <span className="truncate">{device.serial_number}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {device.manufacturer} {device.model}
        </span>
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {[locationLabel, parentName].filter(Boolean).join(" — ")}
      </div>
    </Row>
  );
}
