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
  profileSchema,
  toProfileUpdate,
  type ProfileInput,
} from "@/lib/validation/settings";

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

export function ProfileForm({
  email,
  defaults,
}: {
  email: string;
  defaults: ProfileInput;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  async function onSubmit(values: ProfileInput) {
    setSubmitting(true);
    const supabase = createClient();
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      toast.error("Your session expired. Please sign in again.");
      setSubmitting(false);
      router.replace("/login");
      return;
    }

    const { error } = await supabase
      .from("testers")
      .update(toProfileUpdate(values))
      .eq("id", userId);

    setSubmitting(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save your profile."));
      return;
    }

    toast.success("Profile saved.");
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
      <Field id="email" label="Email">
        <Input id="email" value={email} disabled readOnly />
      </Field>
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
          />
        </Field>
      </div>

      <Field id="phone" label="Phone" error={errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          {...register("phone")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="license_number"
          label="License number"
          required
          error={errors.license_number?.message}
        >
          <Input id="license_number" {...register("license_number")} />
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
          />
        </Field>
      </div>

      <Field
        id="license_issuing_authority"
        label="Issuing authority"
        error={errors.license_issuing_authority?.message}
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
          <Input id="test_gauge_serial" {...register("test_gauge_serial")} />
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

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!isDirty || submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}
