import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/db/client";
import { TestPickerClient } from "./picker-client";

export const metadata: Metadata = { title: "Start a test" };

type SearchParams = {
  customer?: string;
  location?: string;
  // Resolved from the new-device form after the Q13 add-device chain
  // completes. Looked up server-side to get the canonical URL's
  // customer + location context.
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
  // Q13 return leg: the new-device form redirects to /tests/new?device=X
  // after creating a device from the zero-result chain. We resolve that
  // into the canonical test-form URL by looking up customer +
  // service-location IDs for the new device. RLS keeps this scoped to
  // the caller's company — a forged device id from another tenant just
  // falls through to the picker.
  if (p.device && isUuid(p.device)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("devices")
      .select("customer_id, service_location_id")
      .eq("id", p.device)
      .maybeSingle();
    if (data) {
      redirect(
        `/customers/${data.customer_id}/locations/${data.service_location_id}/devices/${p.device}/tests/new`,
      );
    }
  }

  if (p.customer && isUuid(p.customer) && p.location && isUuid(p.location)) {
    redirect(`/customers/${p.customer}/locations/${p.location}`);
  }
  if (p.customer && isUuid(p.customer)) {
    redirect(`/customers/${p.customer}`);
  }

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
