import { describe, expect, it } from "vitest";
import { emailErrorMessage } from "./errors";

describe("emailErrorMessage", () => {
  it("returns default fallback for null", () => {
    expect(emailErrorMessage(null)).toMatch(/couldn't send the email/i);
  });

  it("returns caller-supplied fallback", () => {
    expect(
      emailErrorMessage(new Error("raw"), "Couldn't send the certificate."),
    ).toBe("Couldn't send the certificate.");
  });

  it("never surfaces the raw Resend/SMTP error text", () => {
    const raw =
      "validation_error: from domain not verified; DKIM alignment failed";
    const shown = emailErrorMessage(
      { name: "validation_error", message: raw },
      "Couldn't send the email. Check the address and try again.",
    );
    expect(shown).not.toContain(raw);
    expect(shown).not.toContain("validation_error");
    expect(shown).not.toContain("DKIM");
  });
});
