import { describe, expect, it } from "vitest";
import {
  nullIfEmpty,
  optionalDate,
  optionalStateCode,
  optionalText,
  requiredDate,
  requiredText,
  undefinedIfEmpty,
} from "./fields";

describe("requiredText", () => {
  const s = requiredText("Name is required");

  it("accepts a normal string", () => {
    expect(s.parse("Jane")).toBe("Jane");
  });

  it("trims leading and trailing whitespace", () => {
    expect(s.parse("  Jane  ")).toBe("Jane");
  });

  it("rejects empty", () => {
    expect(() => s.parse("")).toThrow();
  });

  it("rejects whitespace-only", () => {
    expect(() => s.parse("   ")).toThrow();
  });

  it("surfaces the caller-supplied message", () => {
    const result = s.safeParse("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });
});

describe("optionalText", () => {
  it("accepts empty", () => {
    expect(optionalText.parse("")).toBe("");
  });

  it("trims", () => {
    expect(optionalText.parse("  hi  ")).toBe("hi");
  });
});

describe("optionalStateCode", () => {
  it("accepts empty", () => {
    expect(optionalStateCode.parse("")).toBe("");
  });

  it("accepts two letters", () => {
    expect(optionalStateCode.parse("CA")).toBe("CA");
  });

  it("accepts lowercase (form normalizes case downstream)", () => {
    expect(optionalStateCode.parse("ca")).toBe("ca");
  });

  it("rejects three letters", () => {
    expect(() => optionalStateCode.parse("CAL")).toThrow();
  });

  it("rejects one letter", () => {
    expect(() => optionalStateCode.parse("C")).toThrow();
  });

  it("rejects digits", () => {
    expect(() => optionalStateCode.parse("12")).toThrow();
  });
});

describe("requiredDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(requiredDate.parse("2027-05-20")).toBe("2027-05-20");
  });

  it("rejects empty", () => {
    expect(() => requiredDate.parse("")).toThrow();
  });

  it("rejects MM/DD/YYYY", () => {
    expect(() => requiredDate.parse("05/20/2027")).toThrow();
  });

  it("rejects YYYY-M-D", () => {
    expect(() => requiredDate.parse("2027-5-2")).toThrow();
  });
});

describe("optionalDate", () => {
  it("accepts empty", () => {
    expect(optionalDate.parse("")).toBe("");
  });

  it("accepts YYYY-MM-DD", () => {
    expect(optionalDate.parse("2027-05-20")).toBe("2027-05-20");
  });

  it("rejects malformed", () => {
    expect(() => optionalDate.parse("not a date")).toThrow();
  });
});

describe("nullIfEmpty", () => {
  it("returns null for empty", () => {
    expect(nullIfEmpty("")).toBeNull();
  });

  it("returns the string otherwise", () => {
    expect(nullIfEmpty("hi")).toBe("hi");
  });
});

describe("undefinedIfEmpty", () => {
  it("returns undefined for empty", () => {
    expect(undefinedIfEmpty("")).toBeUndefined();
  });

  it("returns the string otherwise", () => {
    expect(undefinedIfEmpty("hi")).toBe("hi");
  });
});
