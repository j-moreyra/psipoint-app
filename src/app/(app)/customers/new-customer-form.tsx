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
import { geocodeAndStampLocation } from "./[id]/locations/actions";
import {
  newCustomerSchema,
  toCreateCustomerWithLocationArgs,
  toCustomerInsert,
  type NewCustomerInput,
} from "@/lib/validation/customers";

const emptyDefaults: NewCustomerInput = {
  contact_first_name: "",
  contact_last_name: "",
  company_name: "",
  email: "",
  phone: "",
  billing_address_line_1: "",
  billing_address_line_2: "",
  billing_city: "",
  billing_state: "",
  billing_zip: "",
  notes: "",
  create_service_location: false,
  service_location_nickname: "",
};

export function NewCustomerForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<NewCustomerInput>({
    resolver: zodResolver(newCustomerSchema),
    defaultValues: emptyDefaults,
    mode: "onTouched",
  });

  const createLocation = watch("create_service_location");

  async function onSubmit(values: NewCustomerInput) {
    setSubmitting(true);
    const supabase = createClient();

    let customerId: string | null = null;

    if (values.create_service_location) {
      // Atomic two-row insert via create_customer_with_location RPC.
      const { data, error } = await supabase.rpc(
        "create_customer_with_location",
        toCreateCustomerWithLocationArgs(values),
      );
      if (error || !data) {
        setSubmitting(false);
        toast.error(dbErrorMessage(error, "Couldn't create the customer."));
        return;
      }
      customerId = data;

      // Geocode the just-created service location. The RPC doesn't
      // return the location id (returns customer_id only), so we look
      // it up — a newly-created customer has exactly one location from
      // this path, so .single() is safe. Fire-and-forget.
      const { data: loc } = await supabase
        .from("service_locations")
        .select("id")
        .eq("customer_id", customerId)
        .single();
      if (loc?.id) {
        void geocodeAndStampLocation(loc.id);
      }
    } else {
      // Plain customer insert; service location gets added later from the
      // customer detail page.
      // NOTE: toCustomerInsert expects a CustomerInput shape, but
      // NewCustomerInput is a superset of it, so the call is safe.
      const { data, error } = await supabase
        .from("customers")
        .insert(toCustomerInsert(values, companyId))
        .select("id")
        .single();
      if (error || !data) {
        setSubmitting(false);
        toast.error(dbErrorMessage(error, "Couldn't create the customer."));
        return;
      }
      customerId = data.id;
    }

    setSubmitting(false);
    toast.success(
      values.create_service_location
        ? "Customer and location created."
        : "Customer created.",
    );
    router.push(`/customers/${customerId}`);
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
          required={createLocation}
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
              required={createLocation}
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
              required={createLocation}
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
              required={createLocation}
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

        <div className="rounded-md border bg-muted/30 p-4">
          <label
            htmlFor="create_service_location"
            className="flex cursor-pointer items-start gap-3"
          >
            <input
              id="create_service_location"
              type="checkbox"
              className="mt-0.5 size-4 cursor-pointer rounded border-input"
              {...register("create_service_location")}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                Billing address is also the service address
              </span>
              <span className="block text-xs text-muted-foreground">
                We&rsquo;ll create a service location at the billing address so
                you can add devices right away. Skip this for property
                managers with multiple buildings.
              </span>
            </span>
          </label>

          {createLocation ? (
            <div className="mt-3">
              <Field
                id="service_location_nickname"
                label="Location nickname"
                error={errors.service_location_nickname?.message}
                hint="Optional. e.g. “Main office”."
              >
                <Input
                  id="service_location_nickname"
                  {...register("service_location_nickname")}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create customer"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
