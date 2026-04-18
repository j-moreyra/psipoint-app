import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  deviceStatus,
  getDevice,
  listDevicesForLocation,
} from "./devices";

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

// Anchor "today" so these assertions stay stable across time zones + CI.
const TODAY = new Date("2026-04-18T12:00:00");

describe("deviceStatus", () => {
  it("never_tested when last_tested_date is null", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: null,
          next_test_due_date: null,
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("never_tested");
  });

  it("overdue when due date is in the past", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-01",
          next_test_due_date: "2026-04-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("overdue");
  });

  it("due_soon when due within 30 days", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-05-01",
          next_test_due_date: "2026-05-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("current when due > 30 days out", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-08-01",
          next_test_due_date: "2026-08-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  it("next_due_override wins over next_test_due_date", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2026-01-01",
          next_test_due_date: "2026-12-01", // would be 'current'
          next_due_override: "2026-04-01", // past — overdue
        },
        TODAY,
      ),
    ).toBe("overdue");
  });

  it("tested but no due date → treat as current", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2026-01-01",
          next_test_due_date: null,
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  // Boundary checks around the 30-day due-soon window. TODAY is
  // 2026-04-18; dates expressed relative to that.
  it("boundary: due exactly today → due_soon", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-18",
          next_test_due_date: "2026-04-18",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("boundary: due in exactly 30 days → due_soon", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-05-18",
          next_test_due_date: "2026-05-18",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("boundary: due in 31 days → current", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-05-19",
          next_test_due_date: "2026-05-19",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  it("boundary: due yesterday → overdue", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-17",
          next_test_due_date: "2026-04-17",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("overdue");
  });
});
