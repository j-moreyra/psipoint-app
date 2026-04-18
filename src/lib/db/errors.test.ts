import { describe, expect, it } from "vitest";
import { dbErrorMessage } from "./errors";

describe("dbErrorMessage", () => {
  it("returns default fallback for null", () => {
    expect(dbErrorMessage(null)).toMatch(/something went wrong/i);
  });

  it("returns caller-supplied fallback", () => {
    expect(
      dbErrorMessage(new Error("raw"), "Couldn't save your profile."),
    ).toBe("Couldn't save your profile.");
  });

  it("never surfaces the raw error text", () => {
    const raw = "duplicate key value violates unique constraint";
    const shown = dbErrorMessage(
      { message: raw },
      "Couldn't save company details.",
    );
    expect(shown).not.toContain(raw);
    expect(shown).not.toContain("duplicate");
    expect(shown).not.toContain("constraint");
  });
});
