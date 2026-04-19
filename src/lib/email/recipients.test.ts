import { describe, expect, it } from "vitest";
import type { CertificateData } from "@/lib/pdf/certificate-data";
import {
  buildRecipientOptions,
  isValidRecipientEmail,
} from "./recipients";

function certData(
  overrides?: {
    customerEmail?: string | null;
    customerName?: string;
    onSiteEmail?: string | null;
    onSiteName?: string | null;
  },
): CertificateData {
  // Use explicit key lookup so an explicit `null` override takes effect
  // (??/|| would coalesce it back to the default).
  const o = overrides ?? {};
  const cert = {
    customer: {
      displayName:
        "customerName" in o && o.customerName !== undefined
          ? o.customerName
          : "Acme Property",
      email:
        "customerEmail" in o ? o.customerEmail : "billing@acme.com",
    },
    serviceLocation: {
      onSiteContactEmail:
        "onSiteEmail" in o ? o.onSiteEmail : "bob@acme.com",
      onSiteContactName:
        "onSiteName" in o ? o.onSiteName : "Bob Sanchez",
    },
  };
  return cert as unknown as CertificateData;
}

describe("isValidRecipientEmail", () => {
  it("accepts a plain email", () => {
    expect(isValidRecipientEmail("jane@example.com")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidRecipientEmail("not-an-email")).toBe(false);
    expect(isValidRecipientEmail("")).toBe(false);
    expect(isValidRecipientEmail("jane@")).toBe(false);
  });
});

describe("buildRecipientOptions", () => {
  it("returns billing + on-site + custom when both emails exist", () => {
    const opts = buildRecipientOptions(certData());
    expect(opts).toHaveLength(3);
    expect(opts[0].kind).toBe("billing");
    expect(opts[1].kind).toBe("on_site");
    expect(opts[2].kind).toBe("custom");
  });

  it("omits billing when customer email is missing", () => {
    const opts = buildRecipientOptions(certData({ customerEmail: null }));
    expect(opts.map((o) => o.kind)).toEqual(["on_site", "custom"]);
  });

  it("omits on-site when service-location email is missing", () => {
    const opts = buildRecipientOptions(certData({ onSiteEmail: null }));
    expect(opts.map((o) => o.kind)).toEqual(["billing", "custom"]);
  });

  it("always appends custom even when both emails are missing", () => {
    const opts = buildRecipientOptions(
      certData({ customerEmail: null, onSiteEmail: null }),
    );
    expect(opts).toEqual([{ kind: "custom" }]);
  });

  it("skips invalid emails silently", () => {
    const opts = buildRecipientOptions(
      certData({ customerEmail: "not-an-email", onSiteEmail: null }),
    );
    expect(opts.map((o) => o.kind)).toEqual(["custom"]);
  });

  it("deduplicates when on-site equals billing (case-insensitive)", () => {
    const opts = buildRecipientOptions(
      certData({
        customerEmail: "same@acme.com",
        onSiteEmail: "SAME@acme.com",
      }),
    );
    expect(opts.map((o) => o.kind)).toEqual(["billing", "custom"]);
  });

  it("billing label includes customer display name + email", () => {
    const opts = buildRecipientOptions(certData());
    const billing = opts[0];
    expect(billing.kind).toBe("billing");
    if (billing.kind === "billing") {
      expect(billing.label).toContain("Acme Property");
      expect(billing.label).toContain("billing@acme.com");
    }
  });

  it("on-site label omits name cleanly when contact name is null", () => {
    const opts = buildRecipientOptions(
      certData({ onSiteName: null }),
    );
    const onSite = opts.find((o) => o.kind === "on_site");
    expect(onSite?.kind).toBe("on_site");
    if (onSite && onSite.kind === "on_site") {
      expect(onSite.label).toBe("On-site — bob@acme.com");
    }
  });

  it("trims leading/trailing whitespace on emails", () => {
    const opts = buildRecipientOptions(
      certData({ customerEmail: "  billing@acme.com  " }),
    );
    const billing = opts.find((o) => o.kind === "billing");
    if (billing && billing.kind === "billing") {
      expect(billing.email).toBe("billing@acme.com");
    }
  });
});
