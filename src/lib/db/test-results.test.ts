import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  getMostRecentTesterTest,
  listTestsForDevice,
  testerDisplayInitials,
} from "./test-results";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

describe("listTestsForDevice", () => {
  it("returns [] for non-UUID deviceId without touching the DB", async () => {
    await expect(
      listTestsForDevice(throwingDb, "not-a-uuid"),
    ).resolves.toEqual([]);
  });
});

describe("getMostRecentTesterTest", () => {
  it("returns null for non-UUID testerId without touching the DB", async () => {
    await expect(
      getMostRecentTesterTest(throwingDb, "not-a-uuid"),
    ).resolves.toBeNull();
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
});
