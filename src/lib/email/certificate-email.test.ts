import { describe, expect, it } from "vitest";
import type { CertificateData } from "@/lib/pdf/certificate-data";
import {
  buildCertificateEmailPayload,
  certificateAttachmentFilename,
  certificateEmailSubject,
} from "./certificate-email";

function stubData(overrides?: Partial<StubCert>): CertificateData {
  const base: StubCert = {
    certificateNumber: "ABCDEF01",
    device: {
      serialNumber: "BF-001",
      typeLabel: "RP — Reduced Pressure",
    },
    test: {
      date: "2026-04-19",
      effectiveResult: "pass",
    },
    customer: {
      displayName: "Acme Property",
    },
    serviceLocation: {
      address: {
        line1: "123 Service Ave",
        line2: null,
        city: "Miami",
        state: "FL",
        zip: "33102",
      },
    },
    tester: {
      fullName: "Pat Tester",
      licenseNumber: "FL-1234",
    },
    company: {
      name: "Psipoint Testing Co",
      phone: "305-555-0101",
      website: "https://psipoint.app",
    },
    ...overrides,
  };
  return base as unknown as CertificateData;
}

type StubCert = {
  certificateNumber: string;
  device: { serialNumber: string; typeLabel: string };
  test: { date: string; effectiveResult: "pass" | "fail" };
  customer: { displayName: string };
  serviceLocation: {
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    };
  };
  tester: { fullName: string; licenseNumber: string };
  company: { name: string; phone: string | null; website: string | null };
};

describe("certificateEmailSubject", () => {
  it("uses 'passed' when effective result is pass", () => {
    expect(certificateEmailSubject(stubData())).toBe(
      "Backflow test passed — BF-001 · 2026-04-19",
    );
  });

  it("uses 'failed' when effective result is fail", () => {
    const subj = certificateEmailSubject(
      stubData({ test: { date: "2026-04-19", effectiveResult: "fail" } }),
    );
    expect(subj).toBe("Backflow test failed — BF-001 · 2026-04-19");
  });
});

describe("certificateAttachmentFilename", () => {
  it("builds a filename with serial + test date", () => {
    expect(certificateAttachmentFilename(stubData())).toBe(
      "backflow-test-BF-001-2026-04-19.pdf",
    );
  });

  it("sanitizes characters that confuse mail clients", () => {
    const name = certificateAttachmentFilename(
      stubData({
        device: {
          serialNumber: "BF#001/weird",
          typeLabel: "RP — Reduced Pressure",
        },
      }),
    );
    expect(name).toBe("backflow-test-BF_001_weird-2026-04-19.pdf");
  });
});

describe("buildCertificateEmailPayload", () => {
  it("returns subject, to, html, text, and pdf attachment", async () => {
    const payload = await buildCertificateEmailPayload({
      data: stubData(),
      recipientEmail: "jane@example.com",
      pdfBuffer: Buffer.from("fake-pdf-bytes"),
    });

    expect(payload.to).toBe("jane@example.com");
    expect(payload.subject).toMatch(/Backflow test passed/);
    expect(payload.html.length).toBeGreaterThan(100);
    expect(payload.html).toContain("Acme Property");
    expect(payload.html).toContain("BF-001");
    expect(payload.text).toContain("Certificate #: ABCDEF01");
    expect(payload.text).toContain("Result: PASS");
    expect(payload.attachment.filename).toBe(
      "backflow-test-BF-001-2026-04-19.pdf",
    );
    expect(payload.attachment.content).toBeInstanceOf(Buffer);
    expect(payload.attachment.content.toString()).toBe("fake-pdf-bytes");
  });

  it("text body reflects FAIL when effective result is fail", async () => {
    const payload = await buildCertificateEmailPayload({
      data: stubData({
        test: { date: "2026-04-19", effectiveResult: "fail" },
      }),
      recipientEmail: "jane@example.com",
      pdfBuffer: Buffer.from("x"),
    });
    expect(payload.text).toContain("Result: FAIL");
    expect(payload.html).toContain("FAIL");
  });

  it("skips the location line when the address is empty", async () => {
    const payload = await buildCertificateEmailPayload({
      data: stubData({
        serviceLocation: {
          address: {
            line1: null,
            line2: null,
            city: null,
            state: null,
            zip: null,
          },
        },
      }),
      recipientEmail: "jane@example.com",
      pdfBuffer: Buffer.from("x"),
    });
    expect(payload.text).not.toContain("Location:");
  });
});
