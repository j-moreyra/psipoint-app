import { describe, expect, it } from "vitest";
import type { DbClient } from "./client";
import {
  getCertificateContext,
  getMostRecentTesterTest,
  listRecentTests,
  listTestsForDevice,
  matchesCertificateChain,
  testerDisplayInitials,
  type CertificateContext,
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

// -----------------------------------------------------------------------------
// getCertificateContext — nested-join fetch for the cert page + actions
// -----------------------------------------------------------------------------

const UUID_CUST = "11111111-aaaa-bbbb-cccc-111111111111";
const UUID_LOC = "22222222-aaaa-bbbb-cccc-222222222222";
const UUID_DEV = "33333333-aaaa-bbbb-cccc-333333333333";
const UUID_TEST = "44444444-aaaa-bbbb-cccc-444444444444";

// A full row shape matching the CERT_CONTEXT_COLUMNS SELECT — all nested
// objects present. Tests mutate individual fields via the `overrides`
// arg. Keys mirror the DB columns so it doubles as a fixture schema.
function certRow(overrides?: Record<string, unknown>) {
  return {
    id: UUID_TEST,
    test_date: "2026-04-19",
    result: "pass",
    check_valve_1_psid: 4.5,
    check_valve_2_psid: 3.2,
    relief_valve_opening: 2.0,
    air_inlet_opening: null,
    shutoff_valve_1_condition: null,
    shutoff_valve_2_condition: null,
    test_gauge_serial: "G-1",
    test_gauge_calibration_date: null,
    water_supply_pressure: 65,
    repairs_made: null,
    retest_result: null,
    retest_check_valve_1_psid: null,
    retest_check_valve_2_psid: null,
    retest_relief_valve_opening: null,
    retest_date: null,
    notes: null,
    pdf_url: null,
    emailed_at: null,
    emailed_to: null,
    device_id: UUID_DEV,
    service_location_id: UUID_LOC,
    customer_id: UUID_CUST,
    tester_id: "t",
    company_id: "co",
    device: {
      id: UUID_DEV,
      serial_number: "BF-1",
      manufacturer: "Watts",
      model: "009",
      size: "3/4",
      type: "RP",
      location_description: "Mech",
      install_date: null,
      service_type: null,
    },
    service_location: {
      id: UUID_LOC,
      nickname: null,
      address_line_1: "1 Main",
      address_line_2: null,
      city: "Miami",
      state: "FL",
      zip: "33101",
      on_site_contact_first_name: null,
      on_site_contact_last_name: null,
      on_site_contact_phone: null,
      on_site_contact_email: null,
      water_district: null,
      hazard_type: null,
    },
    customer: {
      id: UUID_CUST,
      company_name: "Acme",
      contact_first_name: null,
      contact_last_name: null,
      email: null,
      phone: null,
      billing_address_line_1: null,
      billing_address_line_2: null,
      billing_city: null,
      billing_state: null,
      billing_zip: null,
    },
    tester: {
      id: "t",
      first_name: "Pat",
      last_name: "Tester",
      license_number: "FL-1",
      license_expiration: "2027-01-01",
      license_issuing_authority: null,
    },
    company: {
      id: "co",
      name: "BackFLO",
      address_line_1: null,
      address_line_2: null,
      city: null,
      state: null,
      zip: null,
      phone: null,
      website: null,
      logo_url: null,
      default_pdf_footer: null,
    },
    ...overrides,
  };
}

describe("getCertificateContext", () => {
  it("returns null for a non-UUID id without touching the DB", async () => {
    await expect(
      getCertificateContext(throwingDb, "not-a-uuid"),
    ).resolves.toBeNull();
  });

  it("returns null for an empty id without touching the DB", async () => {
    await expect(getCertificateContext(throwingDb, "")).resolves.toBeNull();
  });

  it("returns null when the row is missing (maybeSingle → null)", async () => {
    const db = mockDb({ data: null, error: null });
    await expect(
      getCertificateContext(db, UUID_TEST),
    ).resolves.toBeNull();
  });

  it("throws when PostgREST returns an error", async () => {
    const db = mockDb({ data: null, error: { message: "boom" } });
    await expect(
      getCertificateContext(db, UUID_TEST),
    ).rejects.toBeTruthy();
  });

  it("returns null when any required nested join comes back null", async () => {
    for (const key of [
      "device",
      "service_location",
      "customer",
      "tester",
      "company",
    ] as const) {
      const db = mockDb({ data: certRow({ [key]: null }), error: null });
      const r = await getCertificateContext(db, UUID_TEST);
      expect(r, `null when ${key} is missing`).toBeNull();
    }
  });

  it("shapes the row into the BuildCertificateDataInput bundle + pdfUrl/emailedAt/emailedTo", async () => {
    const row = certRow({
      pdf_url: "certificates/co/44444444-aaaa-bbbb-cccc-444444444444.pdf",
      emailed_at: "2026-04-19T10:00:00Z",
      emailed_to: "jane@example.com",
    });
    const db = mockDb({ data: row, error: null });
    const r = await getCertificateContext(db, UUID_TEST);
    expect(r).not.toBeNull();
    if (!r) return;

    // The bundle fields expected by buildCertificateData.
    expect(r.testResult.id).toBe(UUID_TEST);
    expect(r.device.serial_number).toBe("BF-1");
    expect(r.serviceLocation.address_line_1).toBe("1 Main");
    expect(r.customer.company_name).toBe("Acme");
    expect(r.tester.license_number).toBe("FL-1");
    expect(r.company.name).toBe("BackFLO");

    // The three extra UI-only fields pulled out onto the top level.
    expect(r.pdfUrl).toBe(
      "certificates/co/44444444-aaaa-bbbb-cccc-444444444444.pdf",
    );
    expect(r.emailedAt).toBe("2026-04-19T10:00:00Z");
    expect(r.emailedTo).toBe("jane@example.com");
  });

  it("preserves parent-chain FK columns on testResult (ground truth for URL check)", async () => {
    const db = mockDb({ data: certRow(), error: null });
    const r = await getCertificateContext(db, UUID_TEST);
    expect(r?.testResult.customer_id).toBe(UUID_CUST);
    expect(r?.testResult.service_location_id).toBe(UUID_LOC);
    expect(r?.testResult.device_id).toBe(UUID_DEV);
  });
});

describe("matchesCertificateChain", () => {
  function ctx(overrides?: Partial<{
    customer_id: string;
    service_location_id: string;
    device_id: string;
  }>): Pick<CertificateContext, "testResult"> {
    return {
      testResult: {
        customer_id: UUID_CUST,
        service_location_id: UUID_LOC,
        device_id: UUID_DEV,
        ...overrides,
      } as CertificateContext["testResult"],
    };
  }

  const params = {
    customerId: UUID_CUST,
    locationId: UUID_LOC,
    deviceId: UUID_DEV,
  };

  it("matches when all three FKs equal the route params", () => {
    expect(matchesCertificateChain(ctx(), params)).toBe(true);
  });

  it("rejects when customer id mismatches", () => {
    expect(
      matchesCertificateChain(ctx({ customer_id: "other" }), params),
    ).toBe(false);
  });

  it("rejects when service location id mismatches", () => {
    expect(
      matchesCertificateChain(ctx({ service_location_id: "other" }), params),
    ).toBe(false);
  });

  it("rejects when device id mismatches", () => {
    expect(
      matchesCertificateChain(ctx({ device_id: "other" }), params),
    ).toBe(false);
  });

  it("is case-sensitive on UUID comparison (no tolerant match)", () => {
    expect(
      matchesCertificateChain(ctx(), {
        ...params,
        customerId: UUID_CUST.toUpperCase(),
      }),
    ).toBe(false);
  });

  it("rejects when the route param is an empty string — no accidental match on empty FKs", () => {
    expect(
      matchesCertificateChain(ctx(), { ...params, customerId: "" }),
    ).toBe(false);
  });
});
