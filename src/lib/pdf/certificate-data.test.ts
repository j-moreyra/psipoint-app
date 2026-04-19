import { describe, expect, it } from "vitest";
import {
  buildCertificateData,
  formatAddressLine,
  type BuildCertificateDataInput,
  type CompanyRow,
  type CustomerRow,
  type DeviceRow,
  type ServiceLocationRow,
  type TestResultRow,
  type TesterRow,
} from "./certificate-data";

function baseInput(overrides?: {
  testResult?: Partial<TestResultRow>;
  device?: Partial<DeviceRow>;
  customer?: Partial<CustomerRow>;
  serviceLocation?: Partial<ServiceLocationRow>;
  tester?: Partial<TesterRow>;
  company?: Partial<CompanyRow>;
}): BuildCertificateDataInput {
  return {
    testResult: {
      id: "11111111-2222-3333-4444-555555555555",
      test_date: "2026-04-19",
      result: "pass",
      check_valve_1_psid: 4.5,
      check_valve_2_psid: 3.2,
      relief_valve_opening: 2.0,
      air_inlet_opening: null,
      shutoff_valve_1_condition: "Closed tight",
      shutoff_valve_2_condition: null,
      test_gauge_serial: "GAUGE-001",
      test_gauge_calibration_date: "2026-01-01",
      water_supply_pressure: 65.0,
      repairs_made: null,
      retest_result: null,
      retest_check_valve_1_psid: null,
      retest_check_valve_2_psid: null,
      retest_relief_valve_opening: null,
      retest_date: null,
      notes: "Routine annual test.",
      ...overrides?.testResult,
    },
    device: {
      id: "dev-id",
      serial_number: "BF-001",
      manufacturer: "Watts",
      model: "009M3",
      size: "3/4\"",
      type: "RP",
      location_description: "Mechanical room",
      install_date: "2020-06-15",
      service_type: "domestic",
      ...overrides?.device,
    },
    customer: {
      id: "cust-id",
      company_name: "Acme Property",
      contact_first_name: "Jane",
      contact_last_name: "Doe",
      email: "billing@acme.com",
      phone: "555-0100",
      billing_address_line_1: "100 Billing St",
      billing_address_line_2: null,
      billing_city: "Miami",
      billing_state: "FL",
      billing_zip: "33101",
      ...overrides?.customer,
    },
    serviceLocation: {
      id: "loc-id",
      nickname: "Acme Tower",
      address_line_1: "123 Service Ave",
      address_line_2: "Bldg B",
      city: "Miami",
      state: "FL",
      zip: "33102",
      on_site_contact_first_name: "Bob",
      on_site_contact_last_name: "Sanchez",
      on_site_contact_phone: "555-0199",
      on_site_contact_email: "bob@acme.com",
      water_district: "Miami-Dade Water & Sewer",
      hazard_type: "high",
      ...overrides?.serviceLocation,
    },
    tester: {
      id: "tester-id",
      first_name: "Pat",
      last_name: "Tester",
      license_number: "FL-1234",
      license_expiration: "2027-01-01",
      license_issuing_authority: "FDEP",
      ...overrides?.tester,
    },
    company: {
      id: "co-id",
      name: "BackFLO Testing Co",
      address_line_1: "1 HQ Plaza",
      address_line_2: null,
      city: "Miami",
      state: "FL",
      zip: "33130",
      phone: "305-555-0101",
      website: "https://backflo.app",
      logo_url: "co-id/logo.png",
      default_pdf_footer: "Thank you for your business.",
      ...overrides?.company,
    },
  };
}

describe("buildCertificateData — core shape", () => {
  it("flattens a passing RP test into the presentation shape", () => {
    const data = buildCertificateData(baseInput());

    expect(data.testResultId).toBe("11111111-2222-3333-4444-555555555555");
    expect(data.certificateNumber).toBe("11111111");
    expect(data.test.result).toBe("pass");
    expect(data.test.effectiveResult).toBe("pass");
    expect(data.test.waterSupplyPressure).toBe(65);
    expect(data.gauge.serial).toBe("GAUGE-001");
    expect(data.gauge.calibrationDate).toBe("2026-01-01");
    expect(data.shutoffs.sv1Condition).toBe("Closed tight");
    expect(data.shutoffs.sv2Condition).toBeNull();
    expect(data.retest).toBeNull();
  });

  it("produces RP readings for an RP device", () => {
    const data = buildCertificateData(baseInput());
    expect(data.readings.kind).toBe("rp");
    if (data.readings.kind === "rp") {
      expect(data.readings.check_valve_1_psid).toBe(4.5);
      expect(data.readings.check_valve_2_psid).toBe(3.2);
      expect(data.readings.relief_valve_opening).toBe(2.0);
    }
  });

  it("coerces numeric strings to numbers", () => {
    const data = buildCertificateData(
      baseInput({
        testResult: {
          check_valve_1_psid: "4.5" as unknown as number,
          water_supply_pressure: "65" as unknown as number,
        },
      }),
    );
    if (data.readings.kind === "rp") {
      expect(data.readings.check_valve_1_psid).toBe(4.5);
    }
    expect(data.test.waterSupplyPressure).toBe(65);
  });

  it("returns null for non-numeric PSID strings", () => {
    const data = buildCertificateData(
      baseInput({
        testResult: {
          check_valve_1_psid: "not a number" as unknown as number,
        },
      }),
    );
    if (data.readings.kind === "rp") {
      expect(data.readings.check_valve_1_psid).toBeNull();
    }
  });

  it("uses company display name for customer when present", () => {
    const data = buildCertificateData(baseInput());
    expect(data.customer.displayName).toBe("Acme Property");
  });

  it("falls back to contact name when no company_name", () => {
    const data = buildCertificateData(
      baseInput({
        customer: { company_name: null },
      }),
    );
    expect(data.customer.displayName).toBe("Jane Doe");
  });

  it("joins on-site contact first + last into a single name, null when both missing", () => {
    const withBoth = buildCertificateData(baseInput());
    expect(withBoth.serviceLocation.onSiteContactName).toBe("Bob Sanchez");

    const withNone = buildCertificateData(
      baseInput({
        serviceLocation: {
          on_site_contact_first_name: null,
          on_site_contact_last_name: null,
        },
      }),
    );
    expect(withNone.serviceLocation.onSiteContactName).toBeNull();
  });
});

describe("buildCertificateData — device-type branches", () => {
  it("DC returns dc readings (no relief valve)", () => {
    const data = buildCertificateData(
      baseInput({ device: { type: "DC" } }),
    );
    expect(data.readings.kind).toBe("dc");
    if (data.readings.kind === "dc") {
      expect(data.readings.check_valve_1_psid).toBe(4.5);
      expect(data.readings.check_valve_2_psid).toBe(3.2);
    }
  });

  it("PVB returns pvb_svb readings with air inlet from air_inlet_opening col", () => {
    const data = buildCertificateData(
      baseInput({
        device: { type: "PVB" },
        testResult: { air_inlet_opening: 1.0 },
      }),
    );
    expect(data.readings.kind).toBe("pvb_svb");
    if (data.readings.kind === "pvb_svb") {
      expect(data.readings.check_valve_psid).toBe(4.5);
      expect(data.readings.air_inlet_opening).toBe(1.0);
    }
  });

  it("SVB returns pvb_svb readings (same branch as PVB)", () => {
    const data = buildCertificateData(
      baseInput({ device: { type: "SVB" } }),
    );
    expect(data.readings.kind).toBe("pvb_svb");
  });

  it("AVB returns avb readings with no numeric fields", () => {
    const data = buildCertificateData(
      baseInput({ device: { type: "AVB" } }),
    );
    expect(data.readings.kind).toBe("avb");
  });

  it("unknown device type narrows to RP (defensive default)", () => {
    const data = buildCertificateData(
      baseInput({ device: { type: "XYZ" as unknown as "RP" } }),
    );
    expect(data.device.type).toBe("RP");
    expect(data.readings.kind).toBe("rp");
  });
});

describe("buildCertificateData — retest inclusion", () => {
  it("omits retest when retest_result is null", () => {
    const data = buildCertificateData(baseInput());
    expect(data.retest).toBeNull();
    expect(data.test.effectiveResult).toBe("pass");
  });

  it("omits retest when retest_result is an unknown value", () => {
    const data = buildCertificateData(
      baseInput({
        testResult: { retest_result: "maybe" as unknown as "pass" },
      }),
    );
    expect(data.retest).toBeNull();
  });

  it("includes retest when retest_result is pass — effective result flips to pass", () => {
    const data = buildCertificateData(
      baseInput({
        testResult: {
          result: "fail",
          retest_result: "pass",
          retest_date: "2026-04-20",
          repairs_made: "Replaced check valve",
          retest_check_valve_1_psid: 5.0,
          retest_check_valve_2_psid: 4.0,
          retest_relief_valve_opening: 2.5,
        },
      }),
    );
    expect(data.test.result).toBe("fail");
    expect(data.retest).not.toBeNull();
    expect(data.retest?.result).toBe("pass");
    expect(data.retest?.date).toBe("2026-04-20");
    expect(data.retest?.repairs).toBe("Replaced check valve");
    expect(data.test.effectiveResult).toBe("pass");
    if (data.retest && data.retest.readings.kind === "rp") {
      expect(data.retest.readings.check_valve_1_psid).toBe(5.0);
      expect(data.retest.readings.relief_valve_opening).toBe(2.5);
    }
  });

  it("retest readings for PVB have null air_inlet (no retest column exists)", () => {
    const data = buildCertificateData(
      baseInput({
        device: { type: "PVB" },
        testResult: {
          result: "fail",
          retest_result: "pass",
          retest_check_valve_1_psid: 6.0,
        },
      }),
    );
    if (data.retest && data.retest.readings.kind === "pvb_svb") {
      expect(data.retest.readings.check_valve_psid).toBe(6.0);
      expect(data.retest.readings.air_inlet_opening).toBeNull();
    }
  });

  it("AVB retest returns avb readings kind (no numeric values)", () => {
    const data = buildCertificateData(
      baseInput({
        device: { type: "AVB" },
        testResult: {
          result: "fail",
          retest_result: "pass",
        },
      }),
    );
    expect(data.retest?.readings.kind).toBe("avb");
  });
});

describe("buildCertificateData — misc", () => {
  it("certificateNumber strips hyphens and uppercases first 8 hex chars", () => {
    const data = buildCertificateData(
      baseInput({
        testResult: { id: "abcdef01-2345-6789-abcd-ef0123456789" },
      }),
    );
    expect(data.certificateNumber).toBe("ABCDEF01");
  });

  it("tester fullName joins first + last, trims extra whitespace", () => {
    const data = buildCertificateData(
      baseInput({
        tester: { first_name: "  Pat", last_name: "Tester  " },
      }),
    );
    expect(data.tester.fullName).toBe("Pat Tester");
  });

  it("passes company.logo_url through as a raw storage path (not a signed URL)", () => {
    const data = buildCertificateData(baseInput());
    expect(data.company.logoUrl).toBe("co-id/logo.png");
  });

  it("narrows unexpected result string to pass (defensive default)", () => {
    const data = buildCertificateData(
      baseInput({ testResult: { result: "unknown" } }),
    );
    expect(data.test.result).toBe("pass");
  });
});

describe("formatAddressLine", () => {
  it("joins full address", () => {
    expect(
      formatAddressLine({
        line1: "123 Main St",
        line2: "Apt 4",
        city: "Miami",
        state: "FL",
        zip: "33101",
      }),
    ).toBe("123 Main St, Apt 4 · Miami, FL 33101");
  });

  it("skips missing parts cleanly", () => {
    expect(
      formatAddressLine({
        line1: "123 Main St",
        line2: null,
        city: "Miami",
        state: null,
        zip: null,
      }),
    ).toBe("123 Main St · Miami");
  });

  it("returns null when all fields are empty", () => {
    expect(
      formatAddressLine({
        line1: null,
        line2: null,
        city: null,
        state: null,
        zip: null,
      }),
    ).toBeNull();
  });
});
