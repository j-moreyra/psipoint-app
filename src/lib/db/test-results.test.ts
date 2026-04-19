import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  getMostRecentTesterTest,
  listRecentTests,
  listTestsForDevice,
  testerDisplayInitials,
} from "./test-results";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

// Minimal builder mock — chains through select/eq/order/limit/
// maybeSingle, and `then` yields the canned response. Used only to
// drive the happy-path / empty-result / error branches of the three
// helpers. The chain method set mirrors the exact calls in test-
// results.ts; unrelated methods throw to catch drift.
type Resp<T> = { data: T | null; error: { message: string } | null };

function makeBuilder<T>(resp: Resp<T>, capture?: { limits?: number[] }) {
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    order: () => self,
    limit: (n: number) => {
      capture?.limits?.push(n);
      return self;
    },
    maybeSingle: () => Promise.resolve(resp),
    then: (fn: (v: Resp<T>) => unknown) =>
      Promise.resolve(resp).then(fn),
  };
  return self;
}

function mockDb<T>(resp: Resp<T>, capture?: { limits?: number[] }) {
  return {
    from: () => makeBuilder(resp, capture),
  } as unknown as DbClient;
}

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";

describe("listTestsForDevice", () => {
  it("returns [] for non-UUID deviceId without touching the DB", async () => {
    await expect(
      listTestsForDevice(throwingDb, "not-a-uuid"),
    ).resolves.toEqual([]);
  });

  it("returns [] for empty-string deviceId without touching the DB", async () => {
    await expect(listTestsForDevice(throwingDb, "")).resolves.toEqual([]);
  });

  it("returns [] when data comes back null", async () => {
    const db = mockDb({ data: null, error: null });
    await expect(listTestsForDevice(db, UUID_A)).resolves.toEqual([]);
  });

  it("returns rows when data comes back populated", async () => {
    const rows = [
      {
        id: "t1",
        test_date: "2026-04-18",
        result: "pass",
        retest_result: null,
        notes: null,
        tester_id: "te-1",
        testers: { first_name: "Jane", last_name: "Doe" },
      },
    ];
    const db = mockDb({ data: rows, error: null });
    const r = await listTestsForDevice(db, UUID_A);
    expect(r).toEqual(rows);
  });

  it("throws when PostgREST returns an error", async () => {
    const db = mockDb({
      data: null,
      error: { message: "boom" },
    });
    await expect(listTestsForDevice(db, UUID_A)).rejects.toBeTruthy();
  });

  it("passes the limit arg through to the builder", async () => {
    const limits: number[] = [];
    const db = mockDb({ data: [], error: null }, { limits });
    await listTestsForDevice(db, UUID_A, 5);
    expect(limits).toContain(5);
  });

  it("defaults limit to 20 when not supplied (Phase 3 Q9)", async () => {
    const limits: number[] = [];
    const db = mockDb({ data: [], error: null }, { limits });
    await listTestsForDevice(db, UUID_A);
    expect(limits).toContain(20);
  });
});

describe("listRecentTests", () => {
  it("returns [] when data comes back null", async () => {
    const db = mockDb({ data: null, error: null });
    await expect(listRecentTests(db)).resolves.toEqual([]);
  });

  it("returns rows when populated", async () => {
    const rows = [
      {
        id: "t1",
        test_date: "2026-04-18",
        result: "pass",
        retest_result: null,
        device_id: "d1",
        customer_id: "c1",
        devices: {
          serial_number: "BF-001",
          manufacturer: "Watts",
          model: "009",
        },
        customers: {
          company_name: "Acme",
          contact_first_name: null,
          contact_last_name: null,
        },
      },
    ];
    const db = mockDb({ data: rows, error: null });
    const r = await listRecentTests(db);
    expect(r).toEqual(rows);
  });

  it("defaults limit to 10 (dashboard 'Recent tests' card)", async () => {
    const limits: number[] = [];
    const db = mockDb({ data: [], error: null }, { limits });
    await listRecentTests(db);
    expect(limits).toContain(10);
  });

  it("passes explicit limit through", async () => {
    const limits: number[] = [];
    const db = mockDb({ data: [], error: null }, { limits });
    await listRecentTests(db, 3);
    expect(limits).toContain(3);
  });

  it("throws when PostgREST errors", async () => {
    const db = mockDb({ data: null, error: { message: "boom" } });
    await expect(listRecentTests(db)).rejects.toBeTruthy();
  });
});

describe("getMostRecentTesterTest", () => {
  it("returns null for non-UUID testerId without touching the DB", async () => {
    await expect(
      getMostRecentTesterTest(throwingDb, "not-a-uuid"),
    ).resolves.toBeNull();
  });

  it("returns null for empty-string testerId without touching the DB", async () => {
    await expect(
      getMostRecentTesterTest(throwingDb, ""),
    ).resolves.toBeNull();
  });

  it("returns null when the tester has no prior tests", async () => {
    const db = mockDb({ data: null, error: null });
    await expect(getMostRecentTesterTest(db, UUID_A)).resolves.toBeNull();
  });

  it("returns the single row when one exists", async () => {
    const row = {
      id: "t1",
      test_date: "2026-04-18",
      test_gauge_serial: "G-1",
      test_gauge_calibration_date: null,
    };
    const db = mockDb({ data: row, error: null });
    await expect(getMostRecentTesterTest(db, UUID_A)).resolves.toEqual(row);
  });

  it("throws when PostgREST errors", async () => {
    const db = mockDb({ data: null, error: { message: "boom" } });
    await expect(getMostRecentTesterTest(db, UUID_A)).rejects.toBeTruthy();
  });
});

describe("testerDisplayInitials", () => {
  it("builds two-letter initials from first + last", () => {
    expect(
      testerDisplayInitials({ first_name: "Jane", last_name: "Doe" }),
    ).toBe("JD");
  });

  it("uppercases lowercase initials", () => {
    expect(
      testerDisplayInitials({ first_name: "jane", last_name: "doe" }),
    ).toBe("JD");
  });

  it("em-dash when tester join comes back null", () => {
    expect(testerDisplayInitials(null)).toBe("—");
  });

  it("em-dash when both names are empty strings (defense-in-depth)", () => {
    expect(testerDisplayInitials({ first_name: "", last_name: "" })).toBe("—");
  });

  it("tolerates a missing last name", () => {
    expect(
      testerDisplayInitials({ first_name: "Jane", last_name: "" }),
    ).toBe("J");
  });

  it("tolerates a missing first name", () => {
    expect(
      testerDisplayInitials({ first_name: "", last_name: "Doe" }),
    ).toBe("D");
  });

  it("uppercases non-ASCII initials", () => {
    expect(
      testerDisplayInitials({ first_name: "ángela", last_name: "örn" }),
    ).toBe("ÁÖ");
  });

  it("uses only the first character — not the full name", () => {
    expect(
      testerDisplayInitials({ first_name: "Jane", last_name: "Smith" }),
    ).toBe("JS");
  });

  it("handles single-letter names", () => {
    expect(
      testerDisplayInitials({ first_name: "J", last_name: "D" }),
    ).toBe("JD");
  });
});
