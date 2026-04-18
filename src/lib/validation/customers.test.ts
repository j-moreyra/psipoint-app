import { describe, expect, it } from "vitest";
import {
  customerSchema,
  newCustomerSchema,
  toCreateCustomerWithLocationArgs,
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

describe("toCreateCustomerWithLocationArgs", () => {
  const populated: NewCustomerInput = {
    ...validNewBase,
    create_service_location: true,
    company_name: "Acme",
    email: "a@b.co",
    phone: "555-1234",
    billing_address_line_1: "123 Main",
    billing_city: "Austin",
    billing_state: "tx",
    billing_zip: "78701",
    service_location_nickname: "HQ",
  };

  it("undefined for empty optional fields", () => {
    const a = toCreateCustomerWithLocationArgs(validNewBase);
    // validNewBase inherits company_name="Acme Property Mgmt" from the
    // customer base fixture — everything else is empty.
    expect(a.p_contact_first_name).toBeUndefined();
    expect(a.p_billing_address_line_1).toBeUndefined();
    expect(a.p_location_nickname).toBeUndefined();
    expect(a.p_company_name).toBe("Acme Property Mgmt");
  });

  it("passes populated fields through", () => {
    const a = toCreateCustomerWithLocationArgs(populated);
    expect(a.p_company_name).toBe("Acme");
    expect(a.p_email).toBe("a@b.co");
    expect(a.p_billing_address_line_1).toBe("123 Main");
    expect(a.p_billing_city).toBe("Austin");
    expect(a.p_billing_zip).toBe("78701");
    expect(a.p_location_nickname).toBe("HQ");
  });

  it("uppercases billing_state", () => {
    const a = toCreateCustomerWithLocationArgs(populated);
    expect(a.p_billing_state).toBe("TX");
  });
});
