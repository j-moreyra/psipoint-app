import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  getServiceLocation,
  listLocationsForCustomer,
  serviceLocationDisplayName,
} from "./service-locations";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

describe("getServiceLocation", () => {
  it("returns null for non-UUID id without touching the DB", async () => {
    await expect(
      getServiceLocation(throwingDb, "not-a-uuid"),
    ).resolves.toBeNull();
  });
});

describe("listLocationsForCustomer", () => {
  it("returns [] for non-UUID customerId without touching the DB", async () => {
    await expect(
      listLocationsForCustomer(throwingDb, "not-a-uuid"),
    ).resolves.toEqual([]);
  });
});

describe("serviceLocationDisplayName", () => {
  it("prefers nickname", () => {
    expect(
      serviceLocationDisplayName({
        nickname: "Acme Tower",
        address_line_1: "123 Main St",
      }),
    ).toBe("Acme Tower");
  });

  it("falls back to address_line_1 when nickname is null", () => {
    expect(
      serviceLocationDisplayName({
        nickname: null,
        address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });

  it("falls back when nickname is whitespace only", () => {
    expect(
      serviceLocationDisplayName({
        nickname: "   ",
        address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });
});
