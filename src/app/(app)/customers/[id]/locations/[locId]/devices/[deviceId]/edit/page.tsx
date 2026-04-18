import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/app/back-link";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "@/lib/db/customers";
import { getServiceLocation } from "@/lib/db/service-locations";
import { getDevice } from "@/lib/db/devices";
import { toOptionalEnum, toRequiredEnum } from "@/lib/validation/fields";
import {
  deviceTypes,
  serviceTypes,
  type DeviceInput,
  type DeviceServiceType,
  type DeviceType,
} from "@/lib/validation/devices";
import { DeviceForm } from "../../device-form";

export const metadata: Metadata = { title: "Edit device" };

export default async function EditDevicePage({
  params,
}: {
  params: Promise<{ id: string; locId: string; deviceId: string }>;
}) {
  const { id, locId, deviceId } = await params;
  const supabase = await createClient();

  const [customer, location, device] = await Promise.all([
    getCustomer(supabase, id),
    getServiceLocation(supabase, locId),
    getDevice(supabase, deviceId),
  ]);

  if (
    !customer ||
    !location ||
    !device ||
    location.customer_id !== customer.id ||
    device.service_location_id !== location.id
  ) {
    notFound();
  }

  const defaults: DeviceInput = {
    serial_number: device.serial_number,
    manufacturer: device.manufacturer,
    model: device.model,
    size: device.size,
    type: toRequiredEnum<DeviceType>(device.type, deviceTypes, "RP"),
    location_description: device.location_description,
    install_date: device.install_date ?? "",
    service_type: toOptionalEnum<DeviceServiceType>(
      device.service_type,
      serviceTypes,
    ),
  };

  const backHref = `/customers/${customer.id}/locations/${location.id}/devices/${device.id}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <BackLink href={backHref} label={device.serial_number} />
        <h1 className="text-2xl font-semibold tracking-tight">Edit device</h1>
      </div>
      <DeviceForm
        mode="edit"
        deviceId={device.id}
        backHref={backHref}
        defaults={defaults}
      />
    </div>
  );
}
