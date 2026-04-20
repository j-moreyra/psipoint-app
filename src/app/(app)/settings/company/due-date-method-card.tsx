"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CalendarClockIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db/errors";
import {
  dueDateMethods,
  dueDateMethodLabels,
  type DueDateMethod,
} from "@/lib/validation/onboarding";

// Per-method explainers shown under each radio. Kept short — the
// detailed "what happens when I change this" warning lives in the
// inline notice below, not inside every option's copy.
const DUE_DATE_METHOD_DESCRIPTIONS: Record<DueDateMethod, string> = {
  test_date_plus_year:
    "Each test resets the clock. Most common for commercial water purveyors.",
  anniversary:
    "Next test is always due on the anniversary of the first test, regardless of when the most recent test happened.",
  calendar_year_end:
    "All devices are due on December 31 of the test year. Useful for purveyors that bulk-submit annually.",
  custom:
    "No automatic due date — set one per device on the device detail page.",
};

export function DueDateMethodCard({
  companyId,
  initial,
}: {
  companyId: string;
  initial: DueDateMethod;
}) {
  const router = useRouter();
  const [value, setValue] = useState<DueDateMethod>(initial);
  const [saving, setSaving] = useState(false);

  const changed = value !== initial;

  async function onSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("companies")
      .update({ next_due_calculation_method: value })
      .eq("id", companyId);
    setSaving(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save the due-date rule."));
      return;
    }

    toast.success("Due-date rule saved.");
    // router.refresh pulls the new `initial` server-side, which resets
    // the dirty state without a page reload.
    router.refresh();
  }

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-1.5 text-primary">
          <CalendarClockIcon className="size-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold tracking-tight">
            Next-test-due rule
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How BackFLO calculates each device&rsquo;s next test date after a
            new test is recorded. You can override any single device
            individually from its detail page.
          </p>
        </div>
      </header>

      <fieldset
        disabled={saving}
        className="mt-4 space-y-2 border-0 p-0 m-0 min-w-0"
      >
        <div role="radiogroup" aria-label="Next-test-due rule" className="space-y-2">
          {dueDateMethods.map((m) => {
            const selected = value === m;
            return (
              <label
                key={m}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-md border bg-background px-3 py-2.5 text-sm transition-colors " +
                  (selected
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/40")
                }
              >
                <input
                  type="radio"
                  className="mt-0.5 accent-primary"
                  name="next_due_calculation_method"
                  value={m}
                  checked={selected}
                  onChange={() => setValue(m)}
                />
                <span className="flex-1">
                  <span className="block font-medium">
                    {dueDateMethodLabels[m]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {DUE_DATE_METHOD_DESCRIPTIONS[m]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {changed ? (
        <div
          role="status"
          className="mt-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            This change applies to tests recorded from now on. Existing
            devices keep their current due dates until their next test is
            entered. Devices with a custom override are unaffected either
            way.
          </span>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={onSave} disabled={!changed || saving}>
          {saving ? "Saving…" : "Save rule"}
        </Button>
      </div>
    </section>
  );
}
