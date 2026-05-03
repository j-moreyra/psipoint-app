import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

// Mock only the boundary we actually call (renderToBuffer). Keep the
// real StyleSheet/Document/Page/etc. exports so Certificate.tsx still
// imports cleanly — we're testing our wrapper, not @react-pdf internals.
const renderToBufferSpy = vi.fn(
  async (_el: ReactElement<DocumentProps>) => Buffer.from("%PDF-fake"),
);

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual =
    (await importOriginal<typeof import("@react-pdf/renderer")>()) ?? {};
  return {
    ...actual,
    renderToBuffer: (el: ReactElement<DocumentProps>) =>
      renderToBufferSpy(el),
  };
});

// Import under test *after* the mock is registered.
const { renderCertificatePdf } = await import("./render");
const { Certificate } = await import("./certificate");

type MinimalCertData = Parameters<typeof Certificate>[0]["data"];

function stubCertData(): MinimalCertData {
  return {
    testResultId: "11111111-2222-3333-4444-555555555555",
    certificateNumber: "ABCDEF01",
    test: {
      date: "2026-04-19",
      result: "pass",
      effectiveResult: "pass",
      waterSupplyPressure: 65,
      notes: null,
    },
    gauge: { serial: "G-1", calibrationDate: "2026-01-01" },
    shutoffs: { sv1Condition: null, sv2Condition: null },
    readings: {
      kind: "rp",
      check_valve_1_psid: 4.5,
      check_valve_2_psid: 3.2,
      relief_valve_opening: 2,
    },
    retest: null,
    device: {
      id: "d",
      serialNumber: "BF-1",
      manufacturer: "Watts",
      model: "009",
      size: "3/4",
      type: "RP",
      typeLabel: "Reduced Pressure",
      locationDescription: "Mech",
      installDate: null,
      serviceType: null,
    },
    customer: {
      id: "c",
      displayName: "Acme",
      email: null,
      phone: null,
      billingAddress: {
        line1: null,
        line2: null,
        city: null,
        state: null,
        zip: null,
      },
    },
    serviceLocation: {
      id: "l",
      nickname: null,
      address: {
        line1: null,
        line2: null,
        city: null,
        state: null,
        zip: null,
      },
      onSiteContactName: null,
      onSiteContactPhone: null,
      onSiteContactEmail: null,
      waterDistrict: null,
      hazardType: null,
    },
    tester: {
      id: "t",
      fullName: "Pat Tester",
      licenseNumber: "FL-1",
      licenseExpiration: "2027-01-01",
      licenseIssuingAuthority: null,
    },
    company: {
      id: "co",
      name: "Psipoint",
      address: {
        line1: null,
        line2: null,
        city: null,
        state: null,
        zip: null,
      },
      phone: null,
      website: null,
      logoUrl: null,
      pdfFooter: null,
    },
  } as MinimalCertData;
}

describe("renderCertificatePdf", () => {
  beforeEach(() => {
    renderToBufferSpy.mockClear();
  });

  it("returns the Buffer produced by renderToBuffer", async () => {
    const r = await renderCertificatePdf({ data: stubCertData() });
    expect(r).toBeInstanceOf(Buffer);
    expect(r.toString()).toBe("%PDF-fake");
  });

  it("invokes renderToBuffer exactly once per call", async () => {
    await renderCertificatePdf({ data: stubCertData() });
    expect(renderToBufferSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards the Certificate component with the provided props", async () => {
    const data = stubCertData();
    await renderCertificatePdf({ data, logoSrc: "data:image/png;base64,AA" });
    const [element] = renderToBufferSpy.mock.calls[0];
    expect(element.type).toBe(Certificate);
    expect((element.props as { data: MinimalCertData }).data).toBe(data);
    expect((element.props as { logoSrc?: string }).logoSrc).toBe(
      "data:image/png;base64,AA",
    );
  });

  it("omits logoSrc when not provided (Certificate renders text-only header)", async () => {
    await renderCertificatePdf({ data: stubCertData() });
    const [element] = renderToBufferSpy.mock.calls[0];
    expect(
      (element.props as { logoSrc?: string }).logoSrc,
    ).toBeUndefined();
  });

  it("surfaces renderer failures to the caller (caller maps to 'pdf' stage)", async () => {
    renderToBufferSpy.mockRejectedValueOnce(new Error("bad font"));
    await expect(
      renderCertificatePdf({ data: stubCertData() }),
    ).rejects.toThrow(/bad font/);
  });
});
