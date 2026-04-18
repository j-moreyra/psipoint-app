import { describe, expect, it } from "vitest";
import {
  loginSchema,
  resetPasswordSchema,
  resetRequestSchema,
  signupSchema,
} from "./auth";

describe("loginSchema", () => {
  it("accepts valid email + password", () => {
    const ok = loginSchema.safeParse({
      email: "a@b.com",
      password: "anything",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects missing email", () => {
    const r = loginSchema.safeParse({ email: "", password: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects bad email format", () => {
    const r = loginSchema.safeParse({
      email: "not-an-email",
      password: "x",
    });
    expect(r.success).toBe(false);
  });

  it("accepts any non-empty password (intentional — don't lock out legacy users)", () => {
    const r = loginSchema.safeParse({
      email: "a@b.com",
      password: "s",
    });
    expect(r.success).toBe(true);
  });

  it("trims email", () => {
    const r = loginSchema.parse({
      email: "  a@b.com  ",
      password: "x",
    });
    expect(r.email).toBe("a@b.com");
  });
});

describe("signupSchema", () => {
  it("requires at least 8-char password", () => {
    const r = signupSchema.safeParse({
      email: "a@b.com",
      password: "1234567",
    });
    expect(r.success).toBe(false);
  });

  it("accepts 8-char password", () => {
    const r = signupSchema.safeParse({
      email: "a@b.com",
      password: "12345678",
    });
    expect(r.success).toBe(true);
  });
});

describe("resetRequestSchema", () => {
  it("accepts an email", () => {
    expect(
      resetRequestSchema.safeParse({ email: "a@b.com" }).success,
    ).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires at least 8 chars", () => {
    expect(resetPasswordSchema.safeParse({ password: "short" }).success).toBe(
      false,
    );
    expect(
      resetPasswordSchema.safeParse({ password: "longEnough" }).success,
    ).toBe(true);
  });
});
