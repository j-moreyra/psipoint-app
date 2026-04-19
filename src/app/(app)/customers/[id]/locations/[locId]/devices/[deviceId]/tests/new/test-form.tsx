"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { cn } from "@/lib/utils";
import {
  testResultFormDefaults,
  testResultSchema,
  testResultValueLabels,
  testResultValues,
  type TestResultInput,
  type TestResultValue,
} from "@/lib/validation/test-results";
import type { DeviceType } from "@/lib/validation/devices";
import type { MostRecentTesterTest } from "@/lib/db/test-results";

type TestFormProps = {
  deviceId: string;
  deviceType: DeviceType;
  companyId: string;
  customerId: string;
  serviceLocationId: string;
  testerId: string;
  backHref: string;
  smartDefaults: {
    testDate: string;
    gaugeSerial: string;
    gaugeCalibrationDate: string;
  };
  // Loaded by the page for the Q11 gauge-change soft notice — wired
  // into the form body in unit 12. Included in unit 11's prop shape
  // so the wiring lands without another round of plumbing.
  lastTest: MostRecentTesterTest | null;
};

// Shared textarea classes — no Textarea primitive in @/components/ui/
// yet, so we match the Input primitive's look by hand.
const textareaClass = cn(
  "flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
);

export function TestForm(props: TestFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const defaultValues = testResultFormDefaults(
    props.deviceType,
    props.smartDefaults,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TestResultInput>({
    resolver: zodResolver(testResultSchema),
    defaultValues,
    mode: "onTouched",
  });

  async function onSubmit(_values: TestResultInput) {
    // Unit 14 wires this to createTestResult() + toast + router.push
    // to the device detail page. Stubbed now so unit 11 ships a
    // navigable route without a half-live submit path.
    setSubmitting(true);
    toast.info("Test submit lands in unit 14.");
    setTimeout(() => setSubmitting(false), 400);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border bg-card p-6 shadow-sm"
      noValidate
    >
      <fieldset
        disabled={submitting}
        className="block space-y-5 border-0 p-0 m-0 min-w-0"
      >
        {/* device_type is a form-only discriminator (stripped at
            submit time); carries through via a hidden input so the
            Zod discriminated union narrows correctly. */}
        <input
          type="hidden"
          value={props.deviceType}
          {...register("device_type")}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="test_date"
            label="Test date"
            required
            error={errors.test_date?.message}
          >
            <Input id="test_date" type="date" {...register("test_date")} />
          </Field>

          <Field
            id="test_gauge_serial"
            label="Gauge serial"
            required
            error={errors.test_gauge_serial?.message}
            hint={
              props.smartDefaults.gaugeSerial
                ? "Prefilled from your profile."
                : "Set a default gauge in /settings/profile to skip this."
            }
          >
            <Input id="test_gauge_serial" {...register("test_gauge_serial")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="test_gauge_calibration_date"
            label="Gauge calibration date"
            error={errors.test_gauge_calibration_date?.message}
          >
            <Input
              id="test_gauge_calibration_date"
              type="date"
              {...register("test_gauge_calibration_date")}
            />
          </Field>

          <Field
            id="water_supply_pressure"
            label="Water supply pressure (PSI)"
            error={errors.water_supply_pressure?.message}
            hint="Line pressure at test start."
          >
            <Input
              id="water_supply_pressure"
              inputMode="decimal"
              {...register("water_supply_pressure")}
            />
          </Field>
        </div>

        {/* Per-type readings (RP/DC/PVB/SVB/AVB-specific fields)
            land in unit 12. AVBs are inspection-only so even then
            they render without readings. */}
        <PerTypeReadingsStub deviceType={props.deviceType} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="shutoff_valve_1_condition"
            label="Shutoff valve #1"
            error={errors.shutoff_valve_1_condition?.message}
            hint="Closed tight, leaking, won't close…"
          >
            <Input
              id="shutoff_valve_1_condition"
              {...register("shutoff_valve_1_condition")}
            />
          </Field>
          <Field
            id="shutoff_valve_2_condition"
            label="Shutoff valve #2"
            error={errors.shutoff_valve_2_condition?.message}
          >
            <Input
              id="shutoff_valve_2_condition"
              {...register("shutoff_valve_2_condition")}
            />
          </Field>
        </div>

        <ResultRadios register={register} />

        <Field id="notes" label="Notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={4}
            className={textareaClass}
            {...register("notes")}
          />
        </Field>

        {/* Fail → retest conditional block lands in unit 13. */}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save test"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

// Pass/fail picker as two side-by-side radio cards. Clear tap target
// on mobile; less hidden than a dropdown for the load-bearing
// pass/fail decision.
function ResultRadios({
  register,
}: {
  register: ReturnType<typeof useForm<TestResultInput>>["register"];
}) {
  return (
    <div>
      <p
        id="result-label"
        className="mb-1.5 text-sm font-medium text-foreground"
      >
        Result <span className="text-destructive">*</span>
      </p>
      <div
        role="radiogroup"
        aria-labelledby="result-label"
        className="grid grid-cols-2 gap-2"
      >
        {testResultValues.map((v: TestResultValue) => (
          <label
            key={v}
            className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              className="accent-primary"
              value={v}
              {...register("result")}
            />
            {testResultValueLabels[v]}
          </label>
        ))}
      </div>
    </div>
  );
}

function PerTypeReadingsStub({ deviceType }: { deviceType: DeviceType }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
      Per-type readings for <strong>{deviceType}</strong> devices land in
      unit 12.
    </div>
  );
}
