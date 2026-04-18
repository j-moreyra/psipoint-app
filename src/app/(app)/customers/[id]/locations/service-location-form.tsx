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
import { geocodeAndStampLocation } from "./actions";
import {
  hazardTypes,
  hazardTypeLabels,
  locationTypes,
  locationTypeLabels,
  serviceLocationSchema,
  toServiceLocationInsert,
  toServiceLocationUpdate,
  type HazardType,
  type LocationType,
  type ServiceLocationInput,
} from "@/lib/validation/service-locations";

type CreateProps = {
  mode: "create";
  companyId: string;
  customerId: string;
  defaults?: ServiceLocationInput;
};

type EditProps = {
  mode: "edit";
  customerId: string;
  locationId: string;
  defaults: ServiceLocationInput;
};

type Props = CreateProps | EditProps;

const emptyDefaults: ServiceLocationInput = {
  nickname: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zip: "",
  location_type: "",
  on_site_contact_first_name: "",
  on_site_contact_last_name: "",
  on_site_contact_phone: "",
  on_site_contact_email: "",
  water_district: "",
  access_notes: "",
  hazard_type: "",
};

// Tailwind class blob reused for <select> and <textarea> — matches the
// shadcn Input shape. Kept inline because no Textarea/Select primitive
// exists in this project yet (see review nit N-5).
const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
const textareaClass =
  "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function ServiceLocationForm(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues =
    props.mode === "edit" ? props.defaults : (props.defaults ?? emptyDefaults);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ServiceLocationInput>({
    resolver: zodResolver(serviceLocationSchema),
    defaultValues,
    mode: "onTouched",
  });

  async function onSubmit(values: ServiceLocationInput) {
    setSubmitting(true);
    const supabase = createClient();

    if (props.mode === "create") {
      const { data, error } = await supabase
        .from("service_locations")
        .insert(
          toServiceLocationInsert(values, {
            companyId: props.companyId,
            customerId: props.customerId,
          }),
        )
        .select("id")
        .single();
      setSubmitting(false);

      if (error || !data) {
        toast.error(dbErrorMessage(error, "Couldn't create the location."));
        return;
      }

      toast.success("Location created.");
      // Fire-and-forget: geocode in the background, don't block nav. The
      // user sees success immediately; lat/lng lands on the row when the
      // action finishes (saved via a separate round-trip from the server).
      void geocodeAndStampLocation(data.id);
      router.push(`/customers/${props.customerId}`);
      return;
    }

    const { error } = await supabase
      .from("service_locations")
      .update(toServiceLocationUpdate(values))
      .eq("id", props.locationId);
    setSubmitting(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save the location."));
      return;
    }

    toast.success("Location saved.");
    reset(values);
    // Re-geocode on edit in case the address changed. Server action
    // checks the current row's address from scratch so we don't need to
    // diff client-side.
    void geocodeAndStampLocation(props.locationId);
    router.refresh();
  }

  const submitLabel =
    props.mode === "create"
      ? submitting
        ? "Creating…"
        : "Create location"
      : submitting
        ? "Saving…"
        : "Save changes";

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
          id="nickname"
          label="Nickname"
          error={errors.nickname?.message}
          hint="Optional. Easier to recognize than an address."
        >
          <Input id="nickname" {...register("nickname")} />
        </Field>

        <Field
          id="address_line_1"
          label="Street"
          required
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
            <Field
              id="city"
              label="City"
              required
              error={errors.city?.message}
            >
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
              required
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
            <Field id="zip" label="ZIP" required error={errors.zip?.message}>
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
          <Field
            id="location_type"
            label="Type"
            error={errors.location_type?.message}
          >
            <select
              id="location_type"
              className={selectClass}
              {...register("location_type")}
            >
              <option value="">—</option>
              {locationTypes.map((t: LocationType) => (
                <option key={t} value={t}>
                  {locationTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="hazard_type"
            label="Hazard"
            error={errors.hazard_type?.message}
          >
            <select
              id="hazard_type"
              className={selectClass}
              {...register("hazard_type")}
            >
              <option value="">—</option>
              {hazardTypes.map((t: HazardType) => (
                <option key={t} value={t}>
                  {hazardTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          id="water_district"
          label="Water district"
          error={errors.water_district?.message}
          hint="Which utility serves this property."
        >
          <Input id="water_district" {...register("water_district")} />
        </Field>

        <div className="pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            On-site contact
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="on_site_contact_first_name"
            label="First name"
            error={errors.on_site_contact_first_name?.message}
          >
            <Input
              id="on_site_contact_first_name"
              autoComplete="given-name"
              {...register("on_site_contact_first_name")}
            />
          </Field>
          <Field
            id="on_site_contact_last_name"
            label="Last name"
            error={errors.on_site_contact_last_name?.message}
          >
            <Input
              id="on_site_contact_last_name"
              autoComplete="family-name"
              {...register("on_site_contact_last_name")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="on_site_contact_phone"
            label="Phone"
            error={errors.on_site_contact_phone?.message}
          >
            <Input
              id="on_site_contact_phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              {...register("on_site_contact_phone")}
            />
          </Field>
          <Field
            id="on_site_contact_email"
            label="Email"
            error={errors.on_site_contact_email?.message}
          >
            <Input
              id="on_site_contact_email"
              type="email"
              autoComplete="email"
              inputMode="email"
              {...register("on_site_contact_email")}
            />
          </Field>
        </div>

        <Field
          id="access_notes"
          label="Access notes"
          error={errors.access_notes?.message}
          hint="Gate codes, call-ahead requirements, parking…"
        >
          <textarea
            id="access_notes"
            rows={3}
            className={textareaClass}
            {...register("access_notes")}
          />
        </Field>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={(props.mode === "edit" && !isDirty) || submitting}
          >
            {submitLabel}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
