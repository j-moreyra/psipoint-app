import { ZapIcon } from "lucide-react";

// Shown on customer list, customer detail, and location detail when
// the tester is mid-flow from the /tests/new serial-search zero-result
// CTA (Q13). Keeps the intent visible so the navigation doesn't feel
// arbitrary — user remembers they're adding a specific serial to a
// specific location to get back to test entry.
export function AddDeviceBanner({
  serial,
  step,
}: {
  serial: string;
  step: "customer" | "location" | "add-device";
}) {
  const prompt =
    step === "customer"
      ? "Pick the customer who owns this device."
      : step === "location"
        ? "Pick the service location where this device lives."
        : "Add it to this location to finish starting the test.";
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <ZapIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <p className="font-medium">
          New device — serial{" "}
          <span className="font-mono">{serial}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{prompt}</p>
      </div>
    </div>
  );
}

// Build a "?returnTo=&serial=" suffix for forwarded URLs. Callers
// compose this onto hrefs so deep clicks through the customer →
// location → new-device flow stay in-context. Returns empty string
// when neither param is set.
export function buildReturnToQuery(
  returnTo: string | undefined,
  serial: string | undefined,
): string {
  const params = new URLSearchParams();
  if (returnTo) params.set("returnTo", returnTo);
  if (serial) params.set("serial", serial);
  const s = params.toString();
  return s ? `?${s}` : "";
}
