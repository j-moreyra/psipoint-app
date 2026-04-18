import { describe, expect, it } from "vitest";
import { customerDisplayName } from "./customers";

describe("customerDisplayName", () => {
  it("prefers company_name", () => {
    expect(
      customerDisplayName({
        company_name: "Acme",
        contact_first_name: "Jane",
        contact_last_name: "Doe",
      }),
    ).toBe("Acme");
  });

  it("falls back to full name when company_name is null", () => {
    expect(
      customerDisplayName({
        company_name: null,
        contact_first_name: "Jane",
        contact_last_name: "Doe",
      }),
    ).toBe("Jane Doe");
  });

  it("handles first-name-only", () => {
    expect(
      customerDisplayName({
        company_name: null,
        contact_first_name: "Jane",
        contact_last_name: null,
      }),
    ).toBe("Jane");
  });

  it("handles last-name-only", () => {
    expect(
      customerDisplayName({
        company_name: null,
        contact_first_name: null,
        contact_last_name: "Doe",
      }),
    ).toBe("Doe");
  });

  it("final fallback label", () => {
    expect(
      customerDisplayName({
        company_name: null,
        contact_first_name: null,
        contact_last_name: null,
      }),
    ).toBe("Unnamed customer");
  });
});
