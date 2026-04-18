import { describe, expect, it } from "vitest";
import {
  serviceLocationSchema,
  toServiceLocationInsert,
  toServiceLocationUpdate,
  type ServiceLocationInput,
} from "./service-locations";

const valid: ServiceLocationInput = {
  nickname: "",
  address_line_1: "123 Main St",
  address_line_2: "",
  city: "Austin",
  state: "TX",
  zip: "78701",
  location_type: "",
  on_site_contact_first_name: "",
  on_site_contact_last_name: "",
  on_site_contact_phone: "",
  on_site_contact_email: "",
  water_district: "",
  access_notes: "",
  hazard_type: "",
};

describe("serviceLocationSchema", () => {
  it("accepts minimal valid input", () => {
    expect(serviceLocationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty address_line_1", () => {
    expect(
      serviceLocationSchema.safeParse({ ...valid, address_line_1: "" })
        .success,
    ).toBe(false);
  });

  it("rejects empty state", () => {
    expect(
      serviceLocationSchema.safeParse({ ...valid, state: "" }).success,
    ).toBe(false);
  });

  it("rejects non-2-letter state", () => {
    expect(
      serviceLocationSchema.safeParse({ ...valid, state: "CAL" }).success,
    ).toBe(false);
  });

  it("rejects unknown location_type", () => {
    expect(
      serviceLocationSchema.safeParse({
        ...valid,
        location_type: "warehouse" as unknown as "",
      }).success,
    ).toBe(false);
  });

  it("accepts a known location_type", () => {
    expect(
      serviceLocationSchema.safeParse({ ...valid, location_type: "commercial" })
        .success,
    ).toBe(true);
  });

  it("accepts a known hazard_type", () => {
    expect(
      serviceLocationSchema.safeParse({ ...valid, hazard_type: "high" })
        .success,
    ).toBe(true);
  });

  it("accepts a valid on_site_contact_email", () => {
    expect(
      serviceLocationSchema.safeParse({
        ...valid,
        on_site_contact_email: "onsite@example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects garbage in on_site_contact_email", () => {
    expect(
      serviceLocationSchema.safeParse({
        ...valid,
        on_site_contact_email: "garbage",
      }).success,
    ).toBe(false);
  });
});

describe("toServiceLocationUpdate", () => {
  it("null for empty optionals, passes required as-is, uppercases state", () => {
    const u = toServiceLocationUpdate({ ...valid, state: "tx" });
    expect(u.nickname).toBeNull();
    expect(u.access_notes).toBeNull();
    expect(u.address_line_1).toBe("123 Main St");
    expect(u.state).toBe("TX");
  });

  it("converts empty enum strings to null", () => {
    const u = toServiceLocationUpdate(valid);
    expect(u.location_type).toBeNull();
    expect(u.hazard_type).toBeNull();
  });

  it("keeps populated enum values", () => {
    const u = toServiceLocationUpdate({
      ...valid,
      location_type: "commercial",
      hazard_type: "low",
    });
    expect(u.location_type).toBe("commercial");
    expect(u.hazard_type).toBe("low");
  });
});

describe("toServiceLocationInsert", () => {
  it("attaches company_id and customer_id", () => {
    const i = toServiceLocationInsert(valid, {
      companyId: "co-1",
      customerId: "cu-1",
    });
    expect(i.company_id).toBe("co-1");
    expect(i.customer_id).toBe("cu-1");
    expect(i.address_line_1).toBe("123 Main St");
  });
});
