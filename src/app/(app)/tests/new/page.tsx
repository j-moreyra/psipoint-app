import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { isUuid } from "@/lib/db/client";
import { TestPickerClient } from "./picker-client";

export const metadata: Metadata = { title: "Start a test" };

type SearchParams = {
  customer?: string;
  location?: string;
  device?: string;
};

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const p = await searchParams;

  // Context-bearing URLs from the header search's Start Test shortcuts
  // (unit 8). Rather than reimplement the customer/location/device
  // drill-down here, hand off to the Phase-2 hierarchy pages — they
  // already list children + lead to the canonical test form URL. Only
  // UUIDs get redirected; anything malformed falls through to the picker.
  if (p.customer && isUuid(p.customer) && p.location && isUuid(p.location)) {
    redirect(`/customers/${p.customer}/locations/${p.location}`);
  }
  if (p.customer && isUuid(p.customer)) {
    redirect(`/customers/${p.customer}`);
  }
  // ?device= as an entry point isn't used today, but reserving the
  // decode path keeps future deep links (e.g. QR codes) clean.
  // Intentionally not handled here — the canonical form URL already
  // lives under /customers/[id]/locations/[locId]/devices/[deviceId].

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      <BackLink href="/dashboard" label="Back to dashboard" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Start a test</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find the customer or punch in a device serial — whichever's faster
          where you are.
        </p>
      </div>
      <TestPickerClient />
    </div>
  );
}
