import { describe, expect, it } from "vitest";
import {
  customerSchema,
  newCustomerSchema,
  toCustomerInsert,
  toCustomerUpdate,
  type CustomerInput,
  type NewCustomerInput,
} from "./customers";

const validCustomer: CustomerInput = {
  contact_first_name: "",
  contact_last_name: "",
  company_name: "Acme Property Mgmt",
  email: "",
  phone: "",
  billing_address_line_1: "",
  billing_address_line_2: "",
  billing_city: "",
  billing_state: "",
  billing_zip: "",
  notes: "",
};

describe("customerSchema", () => {
  it("accepts company_name only", () => {
    expect(customerSchema.safeParse(validCustomer).success).toBe(true);
  });

  it("accepts contact name only", () => {
    expect(
      customerSchema.safeParse({
        ...validCustomer,
        company_name: "",
        contact_first_name: "Jane",
      }).success,
    ).toBe(true);
  });

  it("rejects when no name provided at all", () => {
    const res = customerSchema.safeParse({ ...validCustomer, company_name: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].path).toEqual(["company_name"]);
    }
  });

  it("rejects bad billing_state", () => {
    expect(
      customerSchema.safeParse({ ...validCustomer, billing_state: "ZZZ" })
        .success,
    ).toBe(false);
  });

  it("accepts a valid email", () => {
    expect(
      customerSchema.safeParse({ ...validCustomer, email: "a@b.co" }).success,
    ).toBe(true);
  });

  it("rejects garbage in email", () => {
    expect(
      customerSchema.safeParse({ ...validCustomer, email: "garbage" }).success,
    ).toBe(false);
  });
});

describe("toCustomerUpdate", () => {
  it("null for empty optional fields", () => {
    const u = toCustomerUpdate(validCustomer);
    expect(u.billing_address_line_1).toBeNull();
    expect(u.email).toBeNull();
    expect(u.billing_state).toBeNull();
  });

  it("uppercases billing_state", () => {
    const u = toCustomerUpdate({ ...validCustomer, billing_state: "fl" });
    expect(u.billing_state).toBe("FL");
  });

  it("keeps company_name as-is", () => {
    expect(toCustomerUpdate(validCustomer).company_name).toBe(
      "Acme Property Mgmt",
    );
  });
});

describe("toCustomerInsert", () => {
  it("attaches company_id", () => {
    const i = toCustomerInsert(validCustomer, "co-123");
    expect(i.company_id).toBe("co-123");
    expect(i.company_name).toBe("Acme Property Mgmt");
  });
});

// ---------------------------------------------------------------------------
// newCustomerSchema — "billing = service" toggle
// ---------------------------------------------------------------------------
const validNewBase: NewCustomerInput = {
  ...validCustomer,
  create_service_location: false,
  service_location_nickname: "",
};

describe("newCustomerSchema", () => {
  it("accepts toggle off with no address", () => {
    expect(newCustomerSchema.safeParse(validNewBase).success).toBe(true);
  });

  it("requires all address parts when toggle on", () => {
    const res = newCustomerSchema.safeParse({
      ...validNewBase,
      create_service_location: true,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(
        expect.arrayContaining([
          "billing_address_line_1",
          "billing_city",
          "billing_state",
          "billing_zip",
        ]),
      );
    }
  });

  it("accepts toggle on with full address", () => {
    const res = newCustomerSchema.safeParse({
      ...validNewBase,
      create_service_location: true,
      billing_address_line_1: "123 Main",
      billing_city: "Austin",
      billing_state: "TX",
      billing_zip: "78701",
    });
    expect(res.success).toBe(true);
  });

  it("still enforces the name requirement", () => {
    const res = newCustomerSchema.safeParse({
      ...validNewBase,
      company_name: "",
    });
    expect(res.success).toBe(false);
  });
});
