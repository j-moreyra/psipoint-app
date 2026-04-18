"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db/errors";
import {
  dueDateMethodLabels,
  dueDateMethods,
  onboardingSchema,
  STEP_1_FIELDS,
  toOnboardingRpcArgs,
  type OnboardingInput,
} from "@/lib/validation/onboarding";

function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    mode: "onTouched",
    defaultValues: {
      company_name: "",
      company_address_line_1: "",
      company_address_line_2: "",
      company_city: "",
      company_state: "",
      company_zip: "",
      company_phone: "",
      company_website: "",
      next_due_calculation_method: "test_date_plus_year",
      first_name: "",
      last_name: "",
      tester_phone: "",
      license_number: "",
      license_expiration: "",
      license_issuing_authority: "",
      test_gauge_serial: "",
      test_gauge_calibration_date: "",
    },
  });

  async function onNext() {
    const ok = await trigger(STEP_1_FIELDS as unknown as (keyof OnboardingInput)[]);
    if (ok) setStep(1);
  }

  async function onSubmit(values: OnboardingInput) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc(
      "create_company_and_first_tester",
      toOnboardingRpcArgs(values),
    );
    setSubmitting(false);

    if (error) {
      toast.error(
        dbErrorMessage(error, "Couldn't finish setup. Please try again."),
      );
      return;
    }

    toast.success("You're all set. Welcome to BackFLO.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/30 py-6">
      <div className="mx-auto w-full max-w-2xl px-4">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <span className="font-mono text-2xl font-bold tracking-tight">
            BackFLO
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Let&apos;s set up your account
          </span>
        </div>

        <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className={step === 0 ? "font-medium text-foreground" : ""}>
            1. Your company
          </span>
          <span>·</span>
          <span className={step === 1 ? "font-medium text-foreground" : ""}>
            2. Your profile
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-lg border bg-card p-6 shadow-sm"
          noValidate
        >
          <fieldset disabled={submitting} className="contents">
          {/* Step 1 — stays mounted so react-hook-form state persists on back nav. */}
          <div className={step === 0 ? "space-y-4" : "hidden"}>
            <h2 className="text-lg font-semibold">About your company</h2>
            <Field
              id="company_name"
              label="Company name"
              required
              error={errors.company_name?.message}
            >
              <Input
                id="company_name"
                autoComplete="organization"
                {...register("company_name")}
                aria-invalid={errors.company_name ? "true" : undefined}
              />
            </Field>

            <Field
              id="company_address_line_1"
              label="Street address"
              error={errors.company_address_line_1?.message}
            >
              <Input
                id="company_address_line_1"
                autoComplete="street-address"
                {...register("company_address_line_1")}
              />
            </Field>

            <Field
              id="company_address_line_2"
              label="Suite / unit"
              error={errors.company_address_line_2?.message}
            >
              <Input
                id="company_address_line_2"
                autoComplete="address-line2"
                {...register("company_address_line_2")}
              />
            </Field>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-6 sm:col-span-3">
                <Field
                  id="company_city"
                  label="City"
                  error={errors.company_city?.message}
                >
                  <Input
                    id="company_city"
                    autoComplete="address-level2"
                    {...register("company_city")}
                  />
                </Field>
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Field
                  id="company_state"
                  label="State"
                  error={errors.company_state?.message}
                  hint="2-letter code"
                >
                  <Input
                    id="company_state"
                    autoComplete="address-level1"
                    maxLength={2}
                    className="uppercase"
                    {...register("company_state")}
                    aria-invalid={errors.company_state ? "true" : undefined}
                  />
                </Field>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Field
                  id="company_zip"
                  label="ZIP"
                  error={errors.company_zip?.message}
                >
                  <Input
                    id="company_zip"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    {...register("company_zip")}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="company_phone"
                label="Phone"
                error={errors.company_phone?.message}
              >
                <Input
                  id="company_phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  {...register("company_phone")}
                />
              </Field>
              <Field
                id="company_website"
                label="Website"
                error={errors.company_website?.message}
              >
                <Input
                  id="company_website"
                  type="url"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://"
                  {...register("company_website")}
                />
              </Field>
            </div>

            <Field
              id="next_due_calculation_method"
              label="Next-test-due rule"
              error={errors.next_due_calculation_method?.message}
              hint="Change later in Settings. Most testers keep the default."
            >
              <select
                id="next_due_calculation_method"
                className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                {...register("next_due_calculation_method")}
              >
                {dueDateMethods.map((m) => (
                  <option key={m} value={m}>
                    {dueDateMethodLabels[m]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Step 2 */}
          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <h2 className="text-lg font-semibold">About you</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field
                id="first_name"
                label="First name"
                required
                error={errors.first_name?.message}
              >
                <Input
                  id="first_name"
                  autoComplete="given-name"
                  {...register("first_name")}
                  aria-invalid={errors.first_name ? "true" : undefined}
                />
              </Field>
              <Field
                id="last_name"
                label="Last name"
                required
                error={errors.last_name?.message}
              >
                <Input
                  id="last_name"
                  autoComplete="family-name"
                  {...register("last_name")}
                  aria-invalid={errors.last_name ? "true" : undefined}
                />
              </Field>
            </div>

            <Field
              id="tester_phone"
              label="Personal phone"
              error={errors.tester_phone?.message}
              hint="Optional — used when a customer needs to reach you directly."
            >
              <Input
                id="tester_phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                {...register("tester_phone")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="license_number"
                label="License number"
                required
                error={errors.license_number?.message}
              >
                <Input
                  id="license_number"
                  {...register("license_number")}
                  aria-invalid={errors.license_number ? "true" : undefined}
                />
              </Field>
              <Field
                id="license_expiration"
                label="License expires"
                required
                error={errors.license_expiration?.message}
              >
                <Input
                  id="license_expiration"
                  type="date"
                  {...register("license_expiration")}
                  aria-invalid={errors.license_expiration ? "true" : undefined}
                />
              </Field>
            </div>

            <Field
              id="license_issuing_authority"
              label="Issuing authority"
              error={errors.license_issuing_authority?.message}
              hint="State or jurisdiction that issued your license."
            >
              <Input
                id="license_issuing_authority"
                {...register("license_issuing_authority")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="test_gauge_serial"
                label="Test gauge serial"
                error={errors.test_gauge_serial?.message}
                hint="Pre-fills on every test form."
              >
                <Input
                  id="test_gauge_serial"
                  {...register("test_gauge_serial")}
                />
              </Field>
              <Field
                id="test_gauge_calibration_date"
                label="Gauge calibrated"
                error={errors.test_gauge_calibration_date?.message}
              >
                <Input
                  id="test_gauge_calibration_date"
                  type="date"
                  {...register("test_gauge_calibration_date")}
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            {step === 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(0)}
                disabled={submitting}
              >
                Back
              </Button>
            ) : (
              <span />
            )}
            {step === 0 ? (
              <Button type="button" onClick={onNext}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={submitting}>
                {submitting ? "Finishing…" : "Finish setup"}
              </Button>
            )}
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
