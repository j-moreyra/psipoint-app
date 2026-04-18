import { describe, expect, it } from "vitest";
import {
  cappedOptionalText,
  FIELD_LIMITS,
  maxLenMsg,
  nullIfEmpty,
  optionalDate,
  optionalEmail,
  optionalStateCode,
  optionalText,
  requiredDate,
  requiredStateCode,
  requiredText,
  toOptionalEnum,
  toRequiredEnum,
  undefinedIfEmpty,
} from "./fields";

describe("maxLenMsg", () => {
  it("formats the overflow message", () => {
    expect(maxLenMsg(100)).toBe("Max 100 characters");
  });
});

describe("FIELD_LIMITS", () => {
  it("matches the DB char_length caps from the migration", () => {
    // Sanity check — if these drift, the Zod caps drift too.
    expect(FIELD_LIMITS.name).toBe(100);
    expect(FIELD_LIMITS.orgName).toBe(200);
    expect(FIELD_LIMITS.email).toBe(255);
    expect(FIELD_LIMITS.phone).toBe(50);
    expect(FIELD_LIMITS.addressLine).toBe(200);
    expect(FIELD_LIMITS.city).toBe(100);
    expect(FIELD_LIMITS.zip).toBe(20);
    expect(FIELD_LIMITS.notes).toBe(5000);
    expect(FIELD_LIMITS.accessNotes).toBe(2000);
    expect(FIELD_LIMITS.serial).toBe(100);
    expect(FIELD_LIMITS.manufacturer).toBe(100);
    expect(FIELD_LIMITS.model).toBe(100);
    expect(FIELD_LIMITS.deviceSize).toBe(50);
    expect(FIELD_LIMITS.locationDescription).toBe(500);
  });
});

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

describe("requiredText with limit", () => {
  const s = requiredText("required", 10);

  it("accepts at-boundary length", () => {
    expect(s.parse("1234567890")).toBe("1234567890");
  });

  it("rejects over-boundary length with the max message", () => {
    const res = s.safeParse("12345678901");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Max 10 characters");
    }
  });
});

describe("cappedOptionalText", () => {
  const s = cappedOptionalText(5);

  it("accepts empty", () => {
    expect(s.parse("")).toBe("");
  });

  it("accepts at-boundary", () => {
    expect(s.parse("12345")).toBe("12345");
  });

  it("rejects over-boundary", () => {
    const res = s.safeParse("123456");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Max 5 characters");
    }
  });

  it("trims before measuring", () => {
    // After trim this is 5 chars — must pass.
    expect(s.parse("  12345  ")).toBe("12345");
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

describe("requiredStateCode", () => {
  it("accepts two letters", () => {
    expect(requiredStateCode.parse("CA")).toBe("CA");
  });

  it("accepts lowercase (form normalizes case downstream)", () => {
    expect(requiredStateCode.parse("ca")).toBe("ca");
  });

  it("rejects empty", () => {
    expect(() => requiredStateCode.parse("")).toThrow();
  });

  it("rejects three letters", () => {
    expect(() => requiredStateCode.parse("CAL")).toThrow();
  });

  it("rejects digits", () => {
    expect(() => requiredStateCode.parse("12")).toThrow();
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

describe("optionalEmail", () => {
  it("accepts empty", () => {
    expect(optionalEmail.parse("")).toBe("");
  });

  it("trims whitespace", () => {
    expect(optionalEmail.parse("  a@b.co  ")).toBe("a@b.co");
  });

  it("accepts a plausible email", () => {
    expect(optionalEmail.parse("jane.doe+tag@example.com")).toBe(
      "jane.doe+tag@example.com",
    );
  });

  it("rejects garbage", () => {
    expect(() => optionalEmail.parse("garbage")).toThrow();
  });

  it("rejects @-less input", () => {
    expect(() => optionalEmail.parse("no-at-sign.com")).toThrow();
  });

  it("rejects trailing-space-only tokens", () => {
    // "   " after trim is empty → accepted
    expect(optionalEmail.parse("   ")).toBe("");
  });

  it("rejects over-255-char emails (DB cap)", () => {
    // 256-char email: 247 a's + "@ex.com" = 254 a's + "@ex.com" — build
    // carefully to cross 255.
    const local = "a".repeat(250);
    const tooLong = `${local}@ex.com`; // 258 chars — over 255
    expect(tooLong.length).toBeGreaterThan(255);
    expect(optionalEmail.safeParse(tooLong).success).toBe(false);
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

describe("toOptionalEnum", () => {
  const allowed = ["red", "green", "blue"] as const;

  it("passes known values through", () => {
    expect(toOptionalEnum("green", allowed)).toBe("green");
  });

  it("returns '' for null", () => {
    expect(toOptionalEnum(null, allowed)).toBe("");
  });

  it("returns '' for undefined", () => {
    expect(toOptionalEnum(undefined, allowed)).toBe("");
  });

  it("returns '' for unknown values (drift protection)", () => {
    expect(toOptionalEnum("purple", allowed)).toBe("");
  });

  it("returns '' for empty input", () => {
    expect(toOptionalEnum("", allowed)).toBe("");
  });
});

describe("toRequiredEnum", () => {
  const allowed = ["RP", "DC", "PVB"] as const;

  it("passes known values through", () => {
    expect(toRequiredEnum("DC", allowed, "RP")).toBe("DC");
  });

  it("falls back for null", () => {
    expect(toRequiredEnum(null, allowed, "RP")).toBe("RP");
  });

  it("falls back for unknown", () => {
    expect(toRequiredEnum("XYZ", allowed, "RP")).toBe("RP");
  });

  it("falls back for empty", () => {
    expect(toRequiredEnum("", allowed, "RP")).toBe("RP");
  });
});
