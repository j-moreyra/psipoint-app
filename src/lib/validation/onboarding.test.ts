import { describe, expect, it } from "vitest";
import {
  onboardingSchema,
  step1Fields,
  toOnboardingRpcArgs,
  type OnboardingInput,
} from "./onboarding";

const validInput: OnboardingInput = {
  company_name: "Acme Testing",
  company_address_line_1: "",
  company_address_line_2: "",
  company_city: "",
  company_state: "",
  company_zip: "",
  company_phone: "",
  company_website: "",
  next_due_calculation_method: "test_date_plus_year",
  first_name: "Jane",
  last_name: "Doe",
  tester_phone: "",
  license_number: "LIC-123",
  license_expiration: "2027-01-01",
  license_issuing_authority: "",
  test_gauge_serial: "",
  test_gauge_calibration_date: "",
};

describe("onboardingSchema", () => {
  it("passes a minimal valid input (only required fields filled)", () => {
    expect(onboardingSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects when company_name is empty", () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, company_name: "" }).success,
    ).toBe(false);
  });

  it("rejects when first_name is whitespace only", () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, first_name: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects a 3-letter state code", () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, company_state: "CAL" })
        .success,
    ).toBe(false);
  });

  it("accepts a 2-letter state code", () => {
    expect(
      onboardingSchema.safeParse({ ...validInput, company_state: "fl" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed license_expiration", () => {
    expect(
      onboardingSchema.safeParse({
        ...validInput,
        license_expiration: "not-a-date",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown due-date method", () => {
    expect(
      onboardingSchema.safeParse({
        ...validInput,
        next_due_calculation_method: "made_up" as unknown as (typeof validInput)["next_due_calculation_method"],
      }).success,
    ).toBe(false);
  });
});

describe("step1Fields", () => {
  it("contains all company-side field names and no tester fields", () => {
    expect(step1Fields).toContain("company_name");
    expect(step1Fields).toContain("next_due_calculation_method");
    expect(step1Fields).not.toContain("first_name");
    expect(step1Fields).not.toContain("license_number");
  });
});

describe("toOnboardingRpcArgs", () => {
  it("maps required fields directly", () => {
    const args = toOnboardingRpcArgs(validInput);
    expect(args.p_company_name).toBe("Acme Testing");
    expect(args.p_first_name).toBe("Jane");
    expect(args.p_license_expiration).toBe("2027-01-01");
    expect(args.p_next_due_calculation_method).toBe("test_date_plus_year");
  });

  it("drops empty optional strings to undefined so PG applies defaults", () => {
    const args = toOnboardingRpcArgs(validInput);
    expect(args.p_company_address_line_1).toBeUndefined();
    expect(args.p_tester_phone).toBeUndefined();
    expect(args.p_test_gauge_calibration_date).toBeUndefined();
  });

  it("uppercases non-empty state codes", () => {
    const args = toOnboardingRpcArgs({
      ...validInput,
      company_state: "fl",
    });
    expect(args.p_company_state).toBe("FL");
  });

  it("leaves state undefined when empty (does not send empty string)", () => {
    const args = toOnboardingRpcArgs(validInput);
    expect(args.p_company_state).toBeUndefined();
  });

  it("forwards non-empty optional strings verbatim", () => {
    const args = toOnboardingRpcArgs({
      ...validInput,
      company_city: "Miami",
      tester_phone: "555-0100",
    });
    expect(args.p_company_city).toBe("Miami");
    expect(args.p_tester_phone).toBe("555-0100");
  });
});
