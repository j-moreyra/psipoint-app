import { describe, expect, it } from "vitest";
import {
  BUCKET_CERTIFICATES,
  BUCKET_COMPANY_LOGOS,
  certificatePath,
  extractLogoExtension,
  isLogoExtension,
  logoPath,
} from "./paths";

const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("bucket constants", () => {
  it("names are the literals referenced by the storage migration", () => {
    expect(BUCKET_CERTIFICATES).toBe("certificates");
    expect(BUCKET_COMPANY_LOGOS).toBe("company-logos");
  });
});

describe("certificatePath", () => {
  it("builds <companyId>/<testResultId>.pdf", () => {
    expect(certificatePath(UUID_A, UUID_B)).toBe(
      `${UUID_A}/${UUID_B}.pdf`,
    );
  });

  it("throws on non-UUID companyId", () => {
    expect(() => certificatePath("not-a-uuid", UUID_B)).toThrow(
      /bad companyId/,
    );
  });

  it("throws on non-UUID testResultId", () => {
    expect(() => certificatePath(UUID_A, "not-a-uuid")).toThrow(
      /bad testResultId/,
    );
  });

  it("rejects path-traversal attempts in either segment", () => {
    expect(() => certificatePath("../foo", UUID_B)).toThrow();
    expect(() => certificatePath(UUID_A, "../bar")).toThrow();
  });
});

describe("logoPath", () => {
  it("builds <companyId>/logo.<ext>", () => {
    expect(logoPath(UUID_A, "png")).toBe(`${UUID_A}/logo.png`);
    expect(logoPath(UUID_A, "jpg")).toBe(`${UUID_A}/logo.jpg`);
    expect(logoPath(UUID_A, "webp")).toBe(`${UUID_A}/logo.webp`);
  });

  it("lowercases the extension", () => {
    expect(logoPath(UUID_A, "PNG")).toBe(`${UUID_A}/logo.png`);
    expect(logoPath(UUID_A, "JPEG")).toBe(`${UUID_A}/logo.jpeg`);
  });

  it("strips a leading dot", () => {
    expect(logoPath(UUID_A, ".png")).toBe(`${UUID_A}/logo.png`);
  });

  it("rejects unsupported extensions", () => {
    expect(() => logoPath(UUID_A, "gif")).toThrow(/unsupported extension/);
    expect(() => logoPath(UUID_A, "svg")).toThrow(/unsupported extension/);
    expect(() => logoPath(UUID_A, "")).toThrow(/unsupported extension/);
  });

  it("rejects non-UUID companyId", () => {
    expect(() => logoPath("not-a-uuid", "png")).toThrow(/bad companyId/);
  });
});

describe("isLogoExtension", () => {
  it("accepts the allowlist", () => {
    expect(isLogoExtension("png")).toBe(true);
    expect(isLogoExtension("jpg")).toBe(true);
    expect(isLogoExtension("jpeg")).toBe(true);
    expect(isLogoExtension("webp")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isLogoExtension("gif")).toBe(false);
    expect(isLogoExtension("svg")).toBe(false);
    expect(isLogoExtension("pdf")).toBe(false);
    expect(isLogoExtension("")).toBe(false);
  });
});

describe("extractLogoExtension", () => {
  it("reads the extension from a stored logo path", () => {
    expect(extractLogoExtension(`${UUID_A}/logo.png`)).toBe("png");
    expect(extractLogoExtension(`${UUID_A}/logo.JPG`)).toBe("jpg");
  });

  it("returns null when the path doesn't end in /logo.<ext>", () => {
    expect(extractLogoExtension(`${UUID_A}/something.png`)).toBeNull();
    expect(extractLogoExtension("random-string")).toBeNull();
  });

  it("returns null for an unsupported extension even if the shape matches", () => {
    expect(extractLogoExtension(`${UUID_A}/logo.gif`)).toBeNull();
  });
});
