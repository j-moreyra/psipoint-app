import { describe, expect, it } from "vitest";
import { serviceLocationDisplayName } from "./service-locations";

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
