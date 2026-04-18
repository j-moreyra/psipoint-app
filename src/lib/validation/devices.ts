import { z } from "zod";
import {
  nullIfEmpty,
  optionalDate,
  optionalText,
  requiredText,
} from "@/lib/validation/fields";

export const deviceTypes = ["RP", "DC", "PVB", "SVB", "AVB"] as const;
export type DeviceType = (typeof deviceTypes)[number];

export const deviceTypeLabels: Record<DeviceType, string> = {
  RP: "RP — Reduced Pressure",
  DC: "DC — Double Check",
  PVB: "PVB — Pressure Vacuum Breaker",
  SVB: "SVB — Spill-resistant Vacuum Breaker",
  AVB: "AVB — Atmospheric Vacuum Breaker",
};

export const serviceTypes = [
  "domestic",
  "irrigation",
  "fire_line",
  "process_water",
  "other",
] as const;

export type DeviceServiceType = (typeof serviceTypes)[number];

export const serviceTypeLabels: Record<DeviceServiceType, string> = {
  domestic: "Domestic",
  irrigation: "Irrigation",
  fire_line: "Fire line",
  process_water: "Process water",
  other: "Other",
};

const optionalServiceType = z.union([
  z.literal(""),
  z.enum(serviceTypes),
]);

export const deviceSchema = z.object({
  serial_number: requiredText("Serial number is required"),
  manufacturer: requiredText("Manufacturer is required"),
  model: requiredText("Model is required"),
  size: requiredText("Size is required"),
  type: z.enum(deviceTypes),
  location_description: requiredText("On-site location is required"),
  install_date: optionalDate,
  service_type: optionalServiceType,
});

export type DeviceInput = z.infer<typeof deviceSchema>;

function toPayload(v: DeviceInput) {
  return {
    serial_number: v.serial_number,
    manufacturer: v.manufacturer,
    model: v.model,
    size: v.size,
    type: v.type,
    location_description: v.location_description,
    install_date: nullIfEmpty(v.install_date),
    service_type: v.service_type === "" ? null : v.service_type,
  };
}

export function toDeviceUpdate(v: DeviceInput) {
  return toPayload(v);
}

export function toDeviceInsert(
  v: DeviceInput,
  ids: {
    companyId: string;
    customerId: string;
    serviceLocationId: string;
  },
) {
  return {
    ...toPayload(v),
    company_id: ids.companyId,
    customer_id: ids.customerId,
    service_location_id: ids.serviceLocationId,
  };
}

// Default form values — the `type` field has no empty-string option,
// so we seed it to RP (most common). UI can swap.
export const deviceFormDefaults: DeviceInput = {
  serial_number: "",
  manufacturer: "",
  model: "",
  size: "",
  type: "RP",
  location_description: "",
  install_date: "",
  service_type: "",
};
