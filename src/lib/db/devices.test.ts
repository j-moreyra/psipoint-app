import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import { getDevice, listDevicesForLocation } from "./devices";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

describe("getDevice", () => {
  it("returns null for non-UUID id without touching the DB", async () => {
    await expect(getDevice(throwingDb, "not-a-uuid")).resolves.toBeNull();
  });
});

describe("listDevicesForLocation", () => {
  it("returns [] for non-UUID serviceLocationId without touching the DB", async () => {
    await expect(
      listDevicesForLocation(throwingDb, "not-a-uuid"),
    ).resolves.toEqual([]);
  });
});

// Status classification (deviceStatus, DUE_SOON_WINDOW_DAYS, buckets,
// etc.) tests moved to src/lib/dates/due-status.test.ts in Phase 3
// unit 6.
