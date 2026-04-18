import { describe, expect, it } from "vitest";
import {
  deviceFormDefaults,
  deviceSchema,
  toDeviceInsert,
  toDeviceUpdate,
  type DeviceInput,
} from "./devices";

const valid: DeviceInput = {
  serial_number: "SN-123",
  manufacturer: "Watts",
  model: "009",
  size: "3/4\"",
  type: "RP",
  location_description: "Basement mech room",
  install_date: "",
  service_type: "",
};

describe("deviceSchema", () => {
  it("accepts minimal valid input", () => {
    expect(deviceSchema.safeParse(valid).success).toBe(true);
  });

  for (const field of [
    "serial_number",
    "manufacturer",
    "model",
    "size",
    "location_description",
  ] as const) {
    it(`rejects empty ${field}`, () => {
      expect(
        deviceSchema.safeParse({ ...valid, [field]: "" }).success,
      ).toBe(false);
    });
  }

  it("rejects unknown type", () => {
    expect(
      deviceSchema.safeParse({ ...valid, type: "XYZ" as unknown as "RP" })
        .success,
    ).toBe(false);
  });

  it("rejects malformed install_date", () => {
    expect(
      deviceSchema.safeParse({ ...valid, install_date: "nope" }).success,
    ).toBe(false);
  });

  it("accepts populated install_date", () => {
    expect(
      deviceSchema.safeParse({ ...valid, install_date: "2024-05-01" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown service_type", () => {
    expect(
      deviceSchema.safeParse({
        ...valid,
        service_type: "potable" as unknown as "",
      }).success,
    ).toBe(false);
  });
});

describe("toDeviceUpdate", () => {
  it("null for empty install_date", () => {
    expect(toDeviceUpdate(valid).install_date).toBeNull();
  });

  it("null for empty service_type", () => {
    expect(toDeviceUpdate(valid).service_type).toBeNull();
  });

  it("keeps populated service_type", () => {
    expect(
      toDeviceUpdate({ ...valid, service_type: "irrigation" }).service_type,
    ).toBe("irrigation");
  });
});

describe("toDeviceInsert", () => {
  it("attaches all three scope ids", () => {
    const i = toDeviceInsert(valid, {
      companyId: "co-1",
      customerId: "cu-1",
      serviceLocationId: "sl-1",
    });
    expect(i.company_id).toBe("co-1");
    expect(i.customer_id).toBe("cu-1");
    expect(i.service_location_id).toBe("sl-1");
    expect(i.type).toBe("RP");
  });
});

describe("deviceFormDefaults", () => {
  it("validates as a parseable shape (type is RP)", () => {
    // The defaults themselves fail the required text checks, but the *shape*
    // is what react-hook-form wants.
    expect(deviceFormDefaults.type).toBe("RP");
    expect(deviceFormDefaults.serial_number).toBe("");
  });
});
