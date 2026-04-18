"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  customerDisplayName,
  type CustomerListRow,
} from "@/lib/db/customers";

export function CustomerList({ rows }: { rows: CustomerListRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = customerDisplayName(r).toLowerCase();
      const city = (r.billing_city ?? "").toLowerCase();
      return name.includes(q) || city.includes(q);
    });
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        No customers yet.
        <br />
        <Link
          href="/customers/new"
          className="mt-2 inline-block text-foreground underline"
        >
          Add your first customer
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        type="search"
        placeholder="Filter by name or city…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Filter customers"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          No matches for &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-sm">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                href={`/customers/${r.id}/edit`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="truncate font-medium">
                  {customerDisplayName(r)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[r.billing_city, r.billing_state].filter(Boolean).join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
