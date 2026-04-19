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
  deviceFormDefaults,
  deviceSchema,
  deviceTypes,
  deviceTypeLabels,
  serviceTypes,
  serviceTypeLabels,
  toDeviceInsert,
  toDeviceUpdate,
  type DeviceInput,
  type DeviceServiceType,
  type DeviceType,
} from "@/lib/validation/devices";

type CreateProps = {
  mode: "create";
  companyId: string;
  customerId: string;
  serviceLocationId: string;
  backHref: string;
  defaults?: DeviceInput;
  // Q13: when set (validated via safeNextPath server-side), the form
  // redirects to `${returnTo}?device=<newId>` on successful create
  // instead of the usual backHref. /tests/new resolves the device id
  // into the canonical test-form URL.
  returnTo?: string;
};

type EditProps = {
  mode: "edit";
  deviceId: string;
  backHref: string;
  defaults: DeviceInput;
};

type Props = CreateProps | EditProps;

const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export function DeviceForm(props: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const defaultValues =
    props.mode === "edit" ? props.defaults : (props.defaults ?? deviceFormDefaults);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<DeviceInput>({
    resolver: zodResolver(deviceSchema),
    defaultValues,
    mode: "onTouched",
  });

  async function onSubmit(values: DeviceInput) {
    setSubmitting(true);
    const supabase = createClient();

    if (props.mode === "create") {
      const { data, error } = await supabase
        .from("devices")
        .insert(
          toDeviceInsert(values, {
            companyId: props.companyId,
            customerId: props.customerId,
            serviceLocationId: props.serviceLocationId,
          }),
        )
        .select("id")
        .single();
      setSubmitting(false);

      if (error || !data) {
        toast.error(dbErrorMessage(error, "Couldn't create the device."));
        return;
      }

      toast.success("Device created.");
      if (props.returnTo) {
        // Q13 return leg — /tests/new resolves ?device=<id> into
        // customer + service-location IDs and forwards to the
        // canonical test-form URL.
        const sep = props.returnTo.includes("?") ? "&" : "?";
        router.push(`${props.returnTo}${sep}device=${data.id}`);
      } else {
        router.push(props.backHref);
      }
      return;
    }

    const { error } = await supabase
      .from("devices")
      .update(toDeviceUpdate(values))
      .eq("id", props.deviceId);
    setSubmitting(false);

    if (error) {
      toast.error(dbErrorMessage(error, "Couldn't save the device."));
      return;
    }

    toast.success("Device saved.");
    reset(values);
    router.refresh();
  }

  const submitLabel =
    props.mode === "create"
      ? submitting
        ? "Creating…"
        : "Create device"
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
          id="serial_number"
          label="Serial number"
          required
          error={errors.serial_number?.message}
          hint="Must be unique within this location."
        >
          <Input
            id="serial_number"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            {...register("serial_number")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="manufacturer"
            label="Manufacturer"
            required
            error={errors.manufacturer?.message}
            hint="Watts, Wilkins, Febco, Apollo, Zurn…"
          >
            <Input id="manufacturer" {...register("manufacturer")} />
          </Field>
          <Field
            id="model"
            label="Model"
            required
            error={errors.model?.message}
          >
            <Input id="model" {...register("model")} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="size"
            label="Size"
            required
            error={errors.size?.message}
            hint='e.g. 3/4", 1", 2"'
          >
            <Input id="size" {...register("size")} />
          </Field>
          <Field
            id="type"
            label="Type"
            required
            error={errors.type?.message}
            hint="Assembly type (RP, DC, PVB, SVB, AVB)."
          >
            <select id="type" className={selectClass} {...register("type")}>
              {deviceTypes.map((t: DeviceType) => (
                <option key={t} value={t}>
                  {deviceTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          id="location_description"
          label="On-site location"
          required
          error={errors.location_description?.message}
          hint={'"Basement mech room", "Irrigation box south side", etc.'}
        >
          <Input
            id="location_description"
            {...register("location_description")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="service_type"
            label="Service type"
            error={errors.service_type?.message}
            hint="What the device protects."
          >
            <select
              id="service_type"
              className={selectClass}
              {...register("service_type")}
            >
              <option value="">—</option>
              {serviceTypes.map((t: DeviceServiceType) => (
                <option key={t} value={t}>
                  {serviceTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="install_date"
            label="Install date"
            error={errors.install_date?.message}
          >
            <Input
              id="install_date"
              type="date"
              {...register("install_date")}
            />
          </Field>
        </div>

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
