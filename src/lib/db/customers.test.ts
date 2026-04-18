import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import { customerDisplayName, getCustomer } from "./customers";

// Stub that throws if any method is accessed. Used to prove guards
// short-circuit before hitting the DB.
const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

describe("getCustomer", () => {
  it("returns null for non-UUID id without touching the DB", async () => {
    await expect(getCustomer(throwingDb, "not-a-uuid")).resolves.toBeNull();
  });

  it("returns null for an empty id without touching the DB", async () => {
    await expect(getCustomer(throwingDb, "")).resolves.toBeNull();
  });
});

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
