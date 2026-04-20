"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { cn } from "@/lib/utils";
import {
  isCalibrationStale,
  isGaugeChanged,
} from "@/lib/dates/gauge-notice";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db/errors";
import { testDraftKey } from "@/lib/forms/draft-keys";
import { useFormDraft } from "@/lib/forms/use-form-draft";
import {
  testResultFormDefaults,
  testResultSchema,
  testResultValueLabels,
  testResultValues,
  toTestResultInsert,
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
  lastTest: MostRecentTesterTest | null;
};

// Register type loose enough to cover the discriminated union's
// per-variant keys. react-hook-form's Path<T> on a discriminated
// union narrows to the intersection of keys by default, which
// strips the per-type PSID fields — casting register to a path-by-
// string signature is the standard escape hatch for this.
type LooseRegister = UseFormRegister<TestResultInput>;

// Shared textarea classes — no Textarea primitive in @/components/ui/.
const textareaClass = cn(
  "flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
);

export function TestForm(props: TestFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues = useMemo(
    () => testResultFormDefaults(props.deviceType, props.smartDefaults),
    [props.deviceType, props.smartDefaults],
  );

  const form = useForm<TestResultInput>({
    resolver: zodResolver(testResultSchema),
    defaultValues,
    mode: "onTouched",
  });
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = form;

  // Persist form values to localStorage so a tab kill, phone sleep, or
  // connection blip doesn't cost a half-filled test. Keyed by device
  // id — one draft per device, TTL 7 days. On mount, if a fresh draft
  // exists, it overrides the server-side smart defaults. `clear()` runs
  // on successful save and on explicit discard.
  const draftKey = testDraftKey(props.deviceId);
  const draft = useFormDraft({ key: draftKey, form });

  function onDiscardDraft() {
    draft.clear();
    reset(defaultValues);
  }

  // Watch the gauge fields so the Q11 soft notices re-render live
  // while the tester types. `watch` here is scoped — doesn't force
  // a re-render of the rest of the form.
  const currentGauge = watch("test_gauge_serial");
  const currentCal = watch("test_gauge_calibration_date");
  const currentResult = watch("result");
  const gaugeChanged = isGaugeChanged(
    currentGauge ?? "",
    props.lastTest?.test_gauge_serial,
  );
  const calStale = isCalibrationStale(currentCal ?? "");
  const showRetestBlock = currentResult === "fail";

  // Errors on per-type readings (check_valve_*, relief, air_inlet)
  // aren't part of every variant in TestResultInput, so react-hook-
  // form's errors type strips them. Cast to a loose shape for the
  // per-type body. Cast is safe because PerTypeReadings only reads
  // the error objects relevant to the current deviceType, which
  // matches the runtime variant.
  const looseErrors = errors as Record<string, { message?: string } | undefined>;

  async function onSubmit(values: TestResultInput) {
    setSubmitting(true);
    const supabase = createClient();

    const payload = toTestResultInsert(values, {
      companyId: props.companyId,
      customerId: props.customerId,
      serviceLocationId: props.serviceLocationId,
      deviceId: props.deviceId,
      testerId: props.testerId,
    });

    // Inline insert follows the Phase-2 device-form pattern — no
    // dedicated createTestResult helper. The existing
    // update_device_last_tested trigger handles device denorm
    // (last_tested_date, last_test_result, next_test_due_date)
    // server-side. `.select("id").single()` returns the new row so we
    // can deep-link to its certificate page.
    const { data: inserted, error } = await supabase
      .from("test_results")
      .insert(payload)
      .select("id")
      .single();
    setSubmitting(false);

    if (error || !inserted) {
      toast.error(dbErrorMessage(error, "Couldn't save the test."));
      return;
    }

    draft.clear();
    toast.success("Test saved.");
    // Land the tester on the new test's certificate page — generating
    // and emailing the cert is the natural next action. They can
    // back-link to the device or jump elsewhere from there.
    router.push(`${props.backHref}/tests/${inserted.id}/certificate`);
    router.refresh();
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
        <input
          type="hidden"
          value={props.deviceType}
          {...register("device_type")}
        />

        {draft.restored ? (
          <div
            role="status"
            className="-mt-1 flex items-start gap-2 rounded-md border border-blue-300/60 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-700/40 dark:bg-blue-950/40 dark:text-blue-100"
          >
            <RotateCcwIcon className="mt-0.5 size-3.5 shrink-0" />
            <span className="flex-1">
              Draft restored from a previous session on this device.
            </span>
            <button
              type="button"
              onClick={onDiscardDraft}
              className="font-medium underline underline-offset-2 hover:no-underline"
            >
              Discard
            </button>
          </div>
        ) : null}

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
            {gaugeChanged ? (
              <SoftNotice>
                Last test used gauge{" "}
                <span className="font-mono">
                  {props.lastTest?.test_gauge_serial}
                </span>
                . Still correct?
              </SoftNotice>
            ) : null}
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
            {calStale ? (
              <SoftNotice>
                Calibrated over 12 months ago — re-verify before certifying.
              </SoftNotice>
            ) : null}
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

        <PerTypeReadings
          deviceType={props.deviceType}
          register={register}
          errors={looseErrors}
        />

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

        {showRetestBlock ? (
          <FailRetestBlock
            deviceType={props.deviceType}
            register={register}
            errors={looseErrors}
          />
        ) : null}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save test"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

// Q11 soft callout. Amber background, alert icon, non-blocking copy.
// Placed inline under the relevant Field so the hint sits next to
// what it's commenting on.
function SoftNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Type-aware reading fields. Rendered in a grid whose column count
// matches what the variant needs. AVB has no readings — returns an
// inspection-only hint instead (still non-empty so the form layout
// stays rhythmic).
function PerTypeReadings({
  deviceType,
  register,
  errors,
}: {
  deviceType: DeviceType;
  register: LooseRegister;
  errors: Record<string, { message?: string } | undefined>;
}) {
  if (deviceType === "AVB") {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
        AVBs are inspection-only — record the result + shutoff condition
        + any notes. No PSID readings required.
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        Initial test readings
      </p>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          deviceType === "RP" ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {(deviceType === "RP" ||
          deviceType === "DC" ||
          deviceType === "PVB" ||
          deviceType === "SVB") && (
          <Field
            id="check_valve_1_psid"
            label={deviceType === "PVB" || deviceType === "SVB" ? "Check valve PSID" : "Check valve #1 PSID"}
            error={errors.check_valve_1_psid?.message}
            hint="0–999.9"
          >
            <Input
              id="check_valve_1_psid"
              inputMode="decimal"
              {...register("check_valve_1_psid")}
            />
          </Field>
        )}

        {(deviceType === "RP" || deviceType === "DC") && (
          <Field
            id="check_valve_2_psid"
            label="Check valve #2 PSID"
            error={errors.check_valve_2_psid?.message}
            hint="0–999.9"
          >
            <Input
              id="check_valve_2_psid"
              inputMode="decimal"
              {...register("check_valve_2_psid")}
            />
          </Field>
        )}

        {deviceType === "RP" && (
          <Field
            id="relief_valve_opening"
            label="Relief valve opening"
            error={errors.relief_valve_opening?.message}
            hint="PSID at which RV opens."
          >
            <Input
              id="relief_valve_opening"
              inputMode="decimal"
              {...register("relief_valve_opening")}
            />
          </Field>
        )}

        {(deviceType === "PVB" || deviceType === "SVB") && (
          <Field
            id="air_inlet_opening"
            label="Air inlet opening"
            error={errors.air_inlet_opening?.message}
            hint="PSID at which AI opens."
          >
            <Input
              id="air_inlet_opening"
              inputMode="decimal"
              {...register("air_inlet_opening")}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

// Repairs + retest block — only rendered when initial result = fail.
// Schema keeps every field optional even in this state: a device can
// fail so badly a retest isn't possible, and the tester should still
// be able to record what they found. The UX just reveals the fields;
// it doesn't force completion. Per-type retest readings match the
// blueprint's test_results columns — no retest_air_inlet_opening is
// provisioned, so PVB/SVB retests only capture the check valve.
function FailRetestBlock({
  deviceType,
  register,
  errors,
}: {
  deviceType: DeviceType;
  register: LooseRegister;
  errors: Record<string, { message?: string } | undefined>;
}) {
  const hasRetestReadings = deviceType !== "AVB";
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Repairs & retest
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Record what was found, what was done, and — if you retested —
          the new reading. Leave blank if a retest wasn&rsquo;t possible.
        </p>
      </div>

      <Field
        id="repairs_made"
        label="Repairs made"
        error={errors.repairs_made?.message}
      >
        <textarea
          id="repairs_made"
          rows={3}
          className={textareaClass}
          {...register("repairs_made")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="retest_date"
          label="Retest date"
          error={errors.retest_date?.message}
        >
          <Input
            id="retest_date"
            type="date"
            {...register("retest_date")}
          />
        </Field>
        <RetestResultRadios register={register} />
      </div>

      {hasRetestReadings ? (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Retest readings
          </p>
          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              deviceType === "RP" ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            <Field
              id="retest_check_valve_1_psid"
              label={
                deviceType === "PVB" || deviceType === "SVB"
                  ? "Check valve PSID"
                  : "Check valve #1 PSID"
              }
              error={errors.retest_check_valve_1_psid?.message}
              hint="0–999.9"
            >
              <Input
                id="retest_check_valve_1_psid"
                inputMode="decimal"
                {...register("retest_check_valve_1_psid")}
              />
            </Field>

            {(deviceType === "RP" || deviceType === "DC") && (
              <Field
                id="retest_check_valve_2_psid"
                label="Check valve #2 PSID"
                error={errors.retest_check_valve_2_psid?.message}
                hint="0–999.9"
              >
                <Input
                  id="retest_check_valve_2_psid"
                  inputMode="decimal"
                  {...register("retest_check_valve_2_psid")}
                />
              </Field>
            )}

            {deviceType === "RP" && (
              <Field
                id="retest_relief_valve_opening"
                label="Relief valve opening"
                error={errors.retest_relief_valve_opening?.message}
                hint="PSID at which RV opens."
              >
                <Input
                  id="retest_relief_valve_opening"
                  inputMode="decimal"
                  {...register("retest_relief_valve_opening")}
                />
              </Field>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Three-option retest result: not retested (the empty default),
// retested & passed, retested & failed. Explicit "not retested" radio
// so testers can snap back to the no-retest state after clicking Pass/
// Fail by mistake — no clear button needed.
function RetestResultRadios({ register }: { register: LooseRegister }) {
  const options: Array<{ value: "" | "pass" | "fail"; label: string }> = [
    { value: "", label: "Not retested" },
    { value: "pass", label: "Retested — Pass" },
    { value: "fail", label: "Retested — Fail" },
  ];
  return (
    <div>
      <p
        id="retest-result-label"
        className="mb-1.5 text-sm font-medium text-foreground"
      >
        Retest result
      </p>
      <div
        role="radiogroup"
        aria-labelledby="retest-result-label"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {options.map((o) => (
          <label
            key={o.value || "none"}
            className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              className="accent-primary"
              value={o.value}
              {...register("retest_result")}
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// Pass/fail picker — two side-by-side radio cards. Clear tap target;
// the pass/fail decision is load-bearing enough to deserve a
// deliberate pick, not a default-buried dropdown.
function ResultRadios({ register }: { register: LooseRegister }) {
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
