"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/db/errors";
import {
  customerSchema,
  toCustomerUpdate,
  type CustomerInput,
} from "@/lib/validation/customers";

// Edit-mode only. The create flow lives in NewCustomerForm so the
// optional "billing = service" toggle path can use newCustomerSchema
// without making this form's types more complex than they need to be.
export function CustomerForm({
  customerId,
  defaults,
}: {
  customerId: string;
  defaults: CustomerInput;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaults,
    mode: "onTouched",
  });

  async function onSubmit(values: CustomerInput) {
    setSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("customers")
      .update(toCustomerUpdate(values))
      .eq("id", customerId);
    setSubmitting(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save the customer."));
      return;
    }

    toast.success("Customer saved.");
    reset(values);
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
        className="block space-y-4 border-0 p-0 m-0 min-w-0"
      >
        <Field
          id="company_name"
          label="Company name"
          error={errors.company_name?.message}
          hint="Enter a company name, a contact name, or both."
        >
          <Input
            id="company_name"
            autoComplete="organization"
            {...register("company_name")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="contact_first_name"
            label="Contact first name"
            error={errors.contact_first_name?.message}
          >
            <Input
              id="contact_first_name"
              autoComplete="given-name"
              {...register("contact_first_name")}
            />
          </Field>
          <Field
            id="contact_last_name"
            label="Contact last name"
            error={errors.contact_last_name?.message}
          >
            <Input
              id="contact_last_name"
              autoComplete="family-name"
              {...register("contact_last_name")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              {...register("email")}
            />
          </Field>
          <Field id="phone" label="Phone" error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...register("phone")}
            />
          </Field>
        </div>

        <div className="pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Billing address
          </h2>
        </div>

        <Field
          id="billing_address_line_1"
          label="Street"
          error={errors.billing_address_line_1?.message}
        >
          <Input
            id="billing_address_line_1"
            autoComplete="street-address"
            {...register("billing_address_line_1")}
          />
        </Field>

        <Field
          id="billing_address_line_2"
          label="Suite / unit"
          error={errors.billing_address_line_2?.message}
        >
          <Input
            id="billing_address_line_2"
            autoComplete="address-line2"
            {...register("billing_address_line_2")}
          />
        </Field>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-6 sm:col-span-3">
            <Field
              id="billing_city"
              label="City"
              error={errors.billing_city?.message}
            >
              <Input
                id="billing_city"
                autoComplete="address-level2"
                {...register("billing_city")}
              />
            </Field>
          </div>
          <div className="col-span-3 sm:col-span-1">
            <Field
              id="billing_state"
              label="State"
              error={errors.billing_state?.message}
              hint="2-letter"
            >
              <Input
                id="billing_state"
                autoComplete="address-level1"
                maxLength={2}
                className="uppercase"
                {...register("billing_state")}
              />
            </Field>
          </div>
          <div className="col-span-3 sm:col-span-2">
            <Field
              id="billing_zip"
              label="ZIP"
              error={errors.billing_zip?.message}
            >
              <Input
                id="billing_zip"
                autoComplete="postal-code"
                inputMode="numeric"
                {...register("billing_zip")}
              />
            </Field>
          </div>
        </div>

        <Field id="notes" label="Notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={3}
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            {...register("notes")}
          />
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
