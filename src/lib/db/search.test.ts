import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  LIMIT_CUSTOMERS,
  LIMIT_DEVICES,
  LIMIT_LOCATIONS,
  MIN_CHARS_NAME,
  MIN_CHARS_SERIAL,
  SERIAL_SIMILARITY_THRESHOLD,
  deviceSearchLocationLabel,
  unifiedSearch,
} from "./search";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

describe("min-char and threshold constants", () => {
  it("names at 2+ chars, serials at 3+ chars (Q4)", () => {
    expect(MIN_CHARS_NAME).toBe(2);
    expect(MIN_CHARS_SERIAL).toBe(3);
  });

  it("serial similarity defaults to 0.3 (Q3)", () => {
    expect(SERIAL_SIMILARITY_THRESHOLD).toBe(0.3);
  });

  it("per-type limits match blueprint §4 pseudocode", () => {
    expect(LIMIT_CUSTOMERS).toBe(5);
    expect(LIMIT_LOCATIONS).toBe(10);
    expect(LIMIT_DEVICES).toBe(10);
  });
});

describe("unifiedSearch — short-circuits", () => {
  it("empty query returns empty, no DB calls", async () => {
    const r = await unifiedSearch(throwingDb, "");
    expect(r.customers).toEqual([]);
    expect(r.serviceLocations).toEqual([]);
    expect(r.devices).toEqual([]);
  });

  it("whitespace-only query returns empty (trim)", async () => {
    await expect(unifiedSearch(throwingDb, "    ")).resolves.toEqual({
      customers: [],
      serviceLocations: [],
      devices: [],
    });
  });

  it("1-char query is below both thresholds → empty", async () => {
    await expect(unifiedSearch(throwingDb, "a")).resolves.toEqual({
      customers: [],
      serviceLocations: [],
      devices: [],
    });
  });
});

describe("deviceSearchLocationLabel", () => {
  it("prefers nickname when set", () => {
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: "Acme Tower",
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("Acme Tower");
  });

  it("falls back to address when nickname is null", () => {
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: null,
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });

  it("falls back when nickname is empty string", () => {
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: "",
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });

  it("falls back when nickname is whitespace only", () => {
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: "   ",
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });
});
