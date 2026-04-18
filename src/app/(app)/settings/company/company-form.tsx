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
  companySchema,
  toCompanyUpdate,
  type CompanyInput,
} from "@/lib/validation/settings";
import {
  dueDateMethods,
  dueDateMethodLabels,
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

export function CompanyForm({
  companyId,
  defaults,
}: {
  companyId: string;
  defaults: CompanyInput;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  async function onSubmit(values: CompanyInput) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("companies")
      .update(toCompanyUpdate(values))
      .eq("id", companyId);
    setSubmitting(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save company details."));
      return;
    }

    toast.success("Company saved.");
    reset(values);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-lg border bg-card p-6 shadow-sm"
      noValidate
    >
      <fieldset disabled={submitting} className="block space-y-4 border-0 p-0 m-0 min-w-0">
      <Field
        id="name"
        label="Company name"
        required
        error={errors.name?.message}
      >
        <Input id="name" autoComplete="organization" {...register("name")} />
      </Field>

      <Field
        id="address_line_1"
        label="Street address"
        error={errors.address_line_1?.message}
      >
        <Input
          id="address_line_1"
          autoComplete="street-address"
          {...register("address_line_1")}
        />
      </Field>

      <Field
        id="address_line_2"
        label="Suite / unit"
        error={errors.address_line_2?.message}
      >
        <Input
          id="address_line_2"
          autoComplete="address-line2"
          {...register("address_line_2")}
        />
      </Field>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-6 sm:col-span-3">
          <Field id="city" label="City" error={errors.city?.message}>
            <Input
              id="city"
              autoComplete="address-level2"
              {...register("city")}
            />
          </Field>
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Field
            id="state"
            label="State"
            error={errors.state?.message}
            hint="2-letter"
          >
            <Input
              id="state"
              autoComplete="address-level1"
              maxLength={2}
              className="uppercase"
              {...register("state")}
            />
          </Field>
        </div>
        <div className="col-span-3 sm:col-span-2">
          <Field id="zip" label="ZIP" error={errors.zip?.message}>
            <Input
              id="zip"
              autoComplete="postal-code"
              inputMode="numeric"
              {...register("zip")}
            />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id="phone" label="Phone" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            {...register("phone")}
          />
        </Field>
        <Field id="website" label="Website" error={errors.website?.message}>
          <Input
            id="website"
            type="url"
            autoComplete="url"
            inputMode="url"
            placeholder="https://"
            {...register("website")}
          />
        </Field>
      </div>

      <Field
        id="next_due_calculation_method"
        label="Next-test-due rule"
        error={errors.next_due_calculation_method?.message}
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

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!isDirty || submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
