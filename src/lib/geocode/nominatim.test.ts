import { describe, expect, it } from "vitest";
import {
  buildNominatimUrl,
  parseNominatimResponse,
} from "./nominatim";

describe("buildNominatimUrl", () => {
  it("puts structured params on the URL", () => {
    const u = new URL(
      buildNominatimUrl({
        address_line_1: "123 Main St",
        address_line_2: null,
        city: "Austin",
        state: "TX",
        zip: "78701",
      }),
    );
    expect(u.hostname).toBe("nominatim.openstreetmap.org");
    expect(u.pathname).toBe("/search");
    expect(u.searchParams.get("format")).toBe("json");
    expect(u.searchParams.get("limit")).toBe("1");
    expect(u.searchParams.get("street")).toBe("123 Main St");
    expect(u.searchParams.get("city")).toBe("Austin");
    expect(u.searchParams.get("state")).toBe("TX");
    expect(u.searchParams.get("postalcode")).toBe("78701");
    expect(u.searchParams.get("country")).toBe("US");
  });

  it("joins address_line_1 and address_line_2 into a single street", () => {
    const u = new URL(
      buildNominatimUrl({
        address_line_1: "123 Main St",
        address_line_2: "Suite 400",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }),
    );
    expect(u.searchParams.get("street")).toBe("123 Main St Suite 400");
  });

  it("ignores empty address_line_2", () => {
    const u = new URL(
      buildNominatimUrl({
        address_line_1: "123 Main St",
        address_line_2: "",
        city: "Austin",
        state: "TX",
        zip: "78701",
      }),
    );
    expect(u.searchParams.get("street")).toBe("123 Main St");
  });
});

describe("parseNominatimResponse", () => {
  it("parses a valid first-result array", () => {
    const out = parseNominatimResponse([
      { lat: "30.2672", lon: "-97.7431", display_name: "Austin, TX" },
    ]);
    expect(out).toEqual({ lat: 30.2672, lng: -97.7431 });
  });

  it("returns null on empty array", () => {
    expect(parseNominatimResponse([])).toBeNull();
  });

  it("returns null on non-array", () => {
    expect(parseNominatimResponse({})).toBeNull();
    expect(parseNominatimResponse(null)).toBeNull();
    expect(parseNominatimResponse("nope")).toBeNull();
  });

  it("returns null when lat/lon aren't numeric strings", () => {
    expect(
      parseNominatimResponse([{ lat: "not-a-number", lon: "-97.7" }]),
    ).toBeNull();
    expect(parseNominatimResponse([{ lat: "30", lon: null }])).toBeNull();
  });

  it("returns null on out-of-range lat/lon", () => {
    expect(
      parseNominatimResponse([{ lat: "91.0", lon: "-97.7" }]),
    ).toBeNull();
    expect(
      parseNominatimResponse([{ lat: "30.0", lon: "-181.0" }]),
    ).toBeNull();
  });
});
