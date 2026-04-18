import { describe, expect, it } from "vitest";
import {
  companySchema,
  profileSchema,
  toCompanyUpdate,
  toProfileUpdate,
  type CompanyInput,
  type ProfileInput,
} from "./settings";

const validCompany: CompanyInput = {
  name: "Acme",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  website: "",
  next_due_calculation_method: "test_date_plus_year",
};

const validProfile: ProfileInput = {
  first_name: "Jane",
  last_name: "Doe",
  phone: "",
  license_number: "LIC-1",
  license_expiration: "2027-01-01",
  license_issuing_authority: "",
  test_gauge_serial: "",
  test_gauge_calibration_date: "",
};

describe("companySchema", () => {
  it("accepts minimal valid input", () => {
    expect(companySchema.safeParse(validCompany).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      companySchema.safeParse({ ...validCompany, name: "" }).success,
    ).toBe(false);
  });

  it("rejects bad state", () => {
    expect(
      companySchema.safeParse({ ...validCompany, state: "ZZZ" }).success,
    ).toBe(false);
  });
});

describe("toCompanyUpdate", () => {
  it("returns null for empty optional fields (Postgres 'unset')", () => {
    const u = toCompanyUpdate(validCompany);
    expect(u.address_line_1).toBeNull();
    expect(u.city).toBeNull();
    expect(u.state).toBeNull();
  });

  it("uppercases state", () => {
    const u = toCompanyUpdate({ ...validCompany, state: "ca" });
    expect(u.state).toBe("CA");
  });

  it("keeps required fields as-is", () => {
    const u = toCompanyUpdate(validCompany);
    expect(u.name).toBe("Acme");
    expect(u.next_due_calculation_method).toBe("test_date_plus_year");
  });
});

describe("profileSchema", () => {
  it("accepts minimal valid input", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });

  it("rejects empty first_name", () => {
    expect(
      profileSchema.safeParse({ ...validProfile, first_name: "" }).success,
    ).toBe(false);
  });

  it("rejects missing license_expiration", () => {
    expect(
      profileSchema.safeParse({ ...validProfile, license_expiration: "" })
        .success,
    ).toBe(false);
  });

  it("rejects malformed test_gauge_calibration_date", () => {
    expect(
      profileSchema.safeParse({
        ...validProfile,
        test_gauge_calibration_date: "nope",
      }).success,
    ).toBe(false);
  });

  it("allows empty test_gauge_calibration_date", () => {
    expect(
      profileSchema.safeParse({
        ...validProfile,
        test_gauge_calibration_date: "",
      }).success,
    ).toBe(true);
  });
});

describe("toProfileUpdate", () => {
  it("returns null for empty optional fields", () => {
    const u = toProfileUpdate(validProfile);
    expect(u.phone).toBeNull();
    expect(u.license_issuing_authority).toBeNull();
    expect(u.test_gauge_serial).toBeNull();
  });

  it("passes through required fields", () => {
    const u = toProfileUpdate(validProfile);
    expect(u.first_name).toBe("Jane");
    expect(u.license_expiration).toBe("2027-01-01");
  });
});
