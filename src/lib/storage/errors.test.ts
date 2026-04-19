import { describe, expect, it } from "vitest";
import { storageErrorMessage } from "./errors";

describe("storageErrorMessage", () => {
  it("returns default fallback for null", () => {
    expect(storageErrorMessage(null)).toMatch(/couldn't save the file/i);
  });

  it("returns caller-supplied fallback", () => {
    expect(
      storageErrorMessage(new Error("raw"), "Couldn't upload the PDF."),
    ).toBe("Couldn't upload the PDF.");
  });

  it("never surfaces the raw SDK error text", () => {
    const raw = "Bucket not found: certificates-internal";
    const shown = storageErrorMessage(
      { message: raw, statusCode: 404 },
      "Couldn't save the PDF.",
    );
    expect(shown).not.toContain(raw);
    expect(shown).not.toContain("Bucket");
    expect(shown).not.toContain("certificates-internal");
  });
});
