import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("returns generic fallback when error is null", () => {
    expect(authErrorMessage(null)).toMatch(/something went wrong/i);
  });

  it("returns generic fallback when error has no code", () => {
    expect(authErrorMessage({})).toMatch(/something went wrong/i);
  });

  it("maps invalid_credentials to a friendly message", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(
      /don't match/i,
    );
  });

  it("maps user_already_exists", () => {
    expect(authErrorMessage({ code: "user_already_exists" })).toMatch(
      /already exists/i,
    );
  });

  it("maps weak_password", () => {
    expect(authErrorMessage({ code: "weak_password" })).toMatch(/too weak/i);
  });

  it("falls back to generic for unknown codes (no raw Supabase text leaks)", () => {
    expect(authErrorMessage({ code: "some_new_code_we_dont_know" })).toMatch(
      /something went wrong/i,
    );
  });
});
