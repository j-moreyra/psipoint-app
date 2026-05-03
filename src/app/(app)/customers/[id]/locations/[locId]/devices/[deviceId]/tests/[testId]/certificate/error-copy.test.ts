import { describe, expect, it } from "vitest";
import { generateErrorCopy, sendErrorCopy } from "./error-copy";

// The stage-discriminated result types coming back from the server
// actions are the load-bearing contract for these copy helpers. Pin
// the exact stages here so a change to the server-action union
// forces a corresponding copy update (and vice-versa).
const GENERATE_STAGES = ["fetch", "pdf", "storage", "db"] as const;
const SEND_STAGES = [
  "fetch",
  "not_ready",
  "bad_email",
  "download",
  "email",
  "db",
  "not_configured",
] as const;

describe("generateErrorCopy", () => {
  it("returns distinct, non-empty copy for every failure stage", () => {
    const messages = GENERATE_STAGES.map((s) => generateErrorCopy(s));
    for (const m of messages) {
      expect(m.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("fetch copy points the user at a refresh (data-load failure)", () => {
    expect(generateErrorCopy("fetch")).toMatch(/refresh/i);
  });

  it("pdf copy calls out the PDF stage (separate from storage or DB)", () => {
    expect(generateErrorCopy("pdf")).toMatch(/pdf/i);
  });

  it("storage copy mentions saving (distinguishes upload failure from render)", () => {
    expect(generateErrorCopy("storage")).toMatch(/save|saving|upload/i);
  });

  it("db copy mentions recording / the certificate record", () => {
    expect(generateErrorCopy("db")).toMatch(/record/i);
  });

  it("never returns a generic 'something went wrong' — stage-specific copy required", () => {
    for (const s of GENERATE_STAGES) {
      expect(generateErrorCopy(s)).not.toMatch(/something went wrong/i);
    }
  });
});

describe("sendErrorCopy", () => {
  it("returns distinct, non-empty copy for every failure stage", () => {
    const messages = SEND_STAGES.map((s) => sendErrorCopy(s));
    for (const m of messages) {
      expect(m.length).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("not_ready copy tells the user to generate first", () => {
    expect(sendErrorCopy("not_ready")).toMatch(/generate/i);
  });

  it("bad_email copy asks for a valid email", () => {
    expect(sendErrorCopy("bad_email")).toMatch(/email/i);
  });

  it("email copy mentions the send failing — distinct from upload/db", () => {
    expect(sendErrorCopy("email")).toMatch(/send/i);
  });

  it("download copy mentions regenerating (stored PDF unreadable)", () => {
    expect(sendErrorCopy("download")).toMatch(/regenerat/i);
  });

  it("db copy acknowledges the email went out even though recording failed", () => {
    expect(sendErrorCopy("db")).toMatch(/sent/i);
  });

  it("not_configured copy explains the env isn't set up — distinct from bad_email", () => {
    const msg = sendErrorCopy("not_configured");
    expect(msg).toMatch(/set up|configured/i);
    expect(msg).not.toBe(sendErrorCopy("bad_email"));
    expect(msg).not.toBe(sendErrorCopy("email"));
  });

  it("never returns a generic 'something went wrong'", () => {
    for (const s of SEND_STAGES) {
      expect(sendErrorCopy(s)).not.toMatch(/something went wrong/i);
    }
  });
});
