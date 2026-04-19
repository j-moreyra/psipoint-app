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
  isSearchableUuid,
  unifiedSearch,
  type CustomerSearchRow,
  type DeviceSearchRow,
  type ServiceLocationSearchRow,
} from "./search";

const throwingDb = new Proxy({}, {
  get() {
    throw new Error("DB should not be called");
  },
}) as unknown as DbClient;

// Thin thenable mock — each `.from(...)` branch in search.ts chains
// select().eq().textSearch().limit() and then awaits, so every method
// returns `self` and `then` resolves to the canned response.
type Resp<T> = { data: T | null; error: { message: string } | null };

type Capture = {
  tables: string[];
  rpcCalls: Array<{ name: string; args: unknown }>;
  textSearchArgs: Array<{
    col: string;
    q: string;
    opts: { type: string } | undefined;
  }>;
  eqArgs: Array<{ col: string; val: unknown }>;
  limitArgs: number[];
  selectArgs: string[];
};

function makeThenable<T>(resp: Resp<T>, cap: Capture) {
  const self: {
    select: (cols: string) => typeof self;
    eq: (col: string, val: unknown) => typeof self;
    textSearch: (
      col: string,
      q: string,
      opts?: { type: string },
    ) => typeof self;
    limit: (n: number) => typeof self;
    then: (fn: (v: Resp<T>) => unknown) => Promise<unknown>;
  } = {
    select(cols) {
      cap.selectArgs.push(cols);
      return self;
    },
    eq(col, val) {
      cap.eqArgs.push({ col, val });
      return self;
    },
    textSearch(col, q, opts) {
      cap.textSearchArgs.push({ col, q, opts });
      return self;
    },
    limit(n) {
      cap.limitArgs.push(n);
      return self;
    },
    then(fn) {
      return Promise.resolve(resp).then(fn);
    },
  };
  return self;
}

function makeMockDb({
  customers = { data: [], error: null },
  locations = { data: [], error: null },
  devices = { data: [], error: null },
}: {
  customers?: Resp<CustomerSearchRow[]>;
  locations?: Resp<ServiceLocationSearchRow[]>;
  devices?: Resp<DeviceSearchRow[]>;
} = {}) {
  const cap: Capture = {
    tables: [],
    rpcCalls: [],
    textSearchArgs: [],
    eqArgs: [],
    limitArgs: [],
    selectArgs: [],
  };
  const db = {
    from(table: string) {
      cap.tables.push(table);
      if (table === "customers") return makeThenable(customers, cap);
      if (table === "service_locations") return makeThenable(locations, cap);
      throw new Error(`unexpected from(${table})`);
    },
    rpc(name: string, args: unknown) {
      cap.rpcCalls.push({ name, args });
      return Promise.resolve(devices);
    },
  } as unknown as DbClient;
  return { db, cap };
}

const customerRow: CustomerSearchRow = {
  id: "c1",
  company_name: "Acme",
  contact_first_name: null,
  contact_last_name: null,
  billing_city: "Miami",
  billing_state: "FL",
};

const locationRow: ServiceLocationSearchRow = {
  id: "l1",
  nickname: "Acme Tower",
  address_line_1: "123 Main St",
  city: "Miami",
  customer_id: "c1",
  customers: {
    company_name: "Acme",
    contact_first_name: null,
    contact_last_name: null,
  },
};

const deviceRow: DeviceSearchRow = {
  device_id: "d1",
  serial_number: "BF-42",
  manufacturer: "Watts",
  model: "009",
  type: "RP",
  is_active: true,
  service_location_id: "l1",
  service_location_nickname: "Acme Tower",
  service_location_address_line_1: "123 Main St",
  service_location_city: "Miami",
  customer_id: "c1",
  customer_company_name: "Acme",
  customer_contact_first_name: null,
  customer_contact_last_name: null,
  similarity_score: 0.8,
};

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

  it("trims leading/trailing whitespace before applying thresholds", async () => {
    await expect(unifiedSearch(throwingDb, "   x   ")).resolves.toEqual({
      customers: [],
      serviceLocations: [],
      devices: [],
    });
  });

  it("tab + newline whitespace also short-circuits", async () => {
    await expect(unifiedSearch(throwingDb, "\t\n")).resolves.toEqual({
      customers: [],
      serviceLocations: [],
      devices: [],
    });
  });
});

describe("unifiedSearch — 2-char names branch (Q4)", () => {
  it("runs name queries but not the serial RPC", async () => {
    const { db, cap } = makeMockDb({
      customers: { data: [customerRow], error: null },
      locations: { data: [locationRow], error: null },
    });
    const r = await unifiedSearch(db, "ab");
    expect(r.customers).toHaveLength(1);
    expect(r.serviceLocations).toHaveLength(1);
    expect(r.devices).toEqual([]);
    expect(cap.tables).toContain("customers");
    expect(cap.tables).toContain("service_locations");
    expect(cap.rpcCalls).toHaveLength(0);
  });

  it("2-char query passes the exact trimmed text to textSearch", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "  ab  ");
    const forCustomers = cap.textSearchArgs.find(
      (a) => a.col === "search_vector" && a.q === "ab",
    );
    expect(forCustomers).toBeDefined();
    expect(forCustomers?.opts).toEqual({ type: "websearch" });
  });
});

describe("unifiedSearch — 3-char serials branch", () => {
  it("3-char query runs all three branches", async () => {
    const { db, cap } = makeMockDb({
      customers: { data: [customerRow], error: null },
      locations: { data: [locationRow], error: null },
      devices: { data: [deviceRow], error: null },
    });
    const r = await unifiedSearch(db, "abc");
    expect(r.customers).toHaveLength(1);
    expect(r.serviceLocations).toHaveLength(1);
    expect(r.devices).toHaveLength(1);
    expect(cap.rpcCalls).toHaveLength(1);
    expect(cap.rpcCalls[0].name).toBe("search_devices_by_serial");
  });

  it("RPC receives threshold + limit constants from this module", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "abc");
    expect(cap.rpcCalls[0].args).toEqual({
      p_query: "abc",
      p_threshold: SERIAL_SIMILARITY_THRESHOLD,
      p_limit: LIMIT_DEVICES,
    });
  });

  it("RPC gets the trimmed query, not the raw input", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "   xyz   ");
    const args = cap.rpcCalls[0].args as { p_query: string };
    expect(args.p_query).toBe("xyz");
  });
});

describe("unifiedSearch — grouped result structure", () => {
  it("groups results by type (customers / serviceLocations / devices)", async () => {
    const { db } = makeMockDb({
      customers: { data: [customerRow], error: null },
      locations: { data: [locationRow], error: null },
      devices: { data: [deviceRow], error: null },
    });
    const r = await unifiedSearch(db, "acme");
    expect(r.customers[0].id).toBe("c1");
    expect(r.serviceLocations[0].id).toBe("l1");
    expect(r.devices[0].device_id).toBe("d1");
  });

  it("empty-data branch returns empty arrays (null → [])", async () => {
    const { db } = makeMockDb({
      customers: { data: null, error: null },
      locations: { data: null, error: null },
      devices: { data: null, error: null },
    });
    const r = await unifiedSearch(db, "acme");
    expect(r).toEqual({ customers: [], serviceLocations: [], devices: [] });
  });

  it("partial hits: customers only", async () => {
    const { db } = makeMockDb({
      customers: { data: [customerRow], error: null },
    });
    const r = await unifiedSearch(db, "acme");
    expect(r.customers).toHaveLength(1);
    expect(r.serviceLocations).toEqual([]);
    expect(r.devices).toEqual([]);
  });

  it("partial hits: devices only", async () => {
    const { db } = makeMockDb({
      devices: { data: [deviceRow], error: null },
    });
    const r = await unifiedSearch(db, "bf-42");
    expect(r.devices).toHaveLength(1);
    expect(r.customers).toEqual([]);
    expect(r.serviceLocations).toEqual([]);
  });
});

describe("unifiedSearch — per-type limits + filters", () => {
  it("applies LIMIT_CUSTOMERS to the customers query", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "ab");
    // Both customers + service_locations branches call .limit(); first
    // in the ordered capture is from customers (parallel but serialized
    // on the synchronous builder entry).
    expect(cap.limitArgs).toContain(LIMIT_CUSTOMERS);
  });

  it("applies LIMIT_LOCATIONS to the service-locations query", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "ab");
    expect(cap.limitArgs).toContain(LIMIT_LOCATIONS);
  });

  it("filters inactive rows (is_active=true) on both name queries", async () => {
    const { db, cap } = makeMockDb();
    await unifiedSearch(db, "ab");
    const isActiveEqs = cap.eqArgs.filter(
      (e) => e.col === "is_active" && e.val === true,
    );
    // Two branches (customers + service_locations), each with one eq.
    expect(isActiveEqs).toHaveLength(2);
  });
});

describe("unifiedSearch — error propagation", () => {
  it("throws when the customers branch returns a PostgREST error", async () => {
    const { db } = makeMockDb({
      customers: { data: null, error: { message: "boom" } },
    });
    await expect(unifiedSearch(db, "ab")).rejects.toBeTruthy();
  });

  it("throws when the service-locations branch errors", async () => {
    const { db } = makeMockDb({
      locations: { data: null, error: { message: "boom" } },
    });
    await expect(unifiedSearch(db, "ab")).rejects.toBeTruthy();
  });

  it("throws when the devices RPC errors", async () => {
    const { db } = makeMockDb({
      devices: { data: null, error: { message: "boom" } },
    });
    await expect(unifiedSearch(db, "abc")).rejects.toBeTruthy();
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

  it("falls back when nickname is tab / newline only", () => {
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: "\t\n",
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("123 Main St");
  });

  it("returns the trimmed nickname when padded with whitespace", () => {
    // The `.trim()` is applied both as the truthiness gate and as the
    // returned value (the short-circuit returns the trim result). A
    // future refactor that split those would surface here.
    expect(
      deviceSearchLocationLabel({
        service_location_nickname: "  Acme  ",
        service_location_address_line_1: "123 Main St",
      }),
    ).toBe("Acme");
  });
});

describe("isSearchableUuid", () => {
  it("accepts a canonical UUID", () => {
    expect(isSearchableUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isSearchableUuid("not-a-uuid")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isSearchableUuid("")).toBe(false);
  });

  it("rejects a UUID with trailing whitespace (no trim — strict)", () => {
    expect(isSearchableUuid("550e8400-e29b-41d4-a716-446655440000 ")).toBe(
      false,
    );
  });
});
