import { deviceTypeLabels, type DeviceType } from "@/lib/validation/devices";
import { customerDisplayName } from "@/lib/db/customers";

// Flat, presentation-ready shape consumed by both the Certificate PDF
// and the certificate email. Keep it JSON-serializable so server actions
// can pass it across boundaries without TDZ surprises.

export type CertificateReadings =
  | {
      kind: "rp";
      check_valve_1_psid: number | null;
      check_valve_2_psid: number | null;
      relief_valve_opening: number | null;
    }
  | {
      kind: "dc";
      check_valve_1_psid: number | null;
      check_valve_2_psid: number | null;
    }
  | {
      kind: "pvb_svb";
      check_valve_psid: number | null;
      air_inlet_opening: number | null;
    }
  | { kind: "avb" };

export type CertificateRetest = {
  date: string | null;
  result: "pass" | "fail";
  repairs: string | null;
  readings: CertificateReadings;
};

export type CertificateData = {
  testResultId: string;
  certificateNumber: string; // short display id — first 8 of uuid, uppercase

  test: {
    date: string; // YYYY-MM-DD
    result: "pass" | "fail";
    effectiveResult: "pass" | "fail"; // retest wins if present
    waterSupplyPressure: number | null;
    notes: string | null;
  };

  gauge: {
    serial: string;
    calibrationDate: string | null;
  };

  shutoffs: {
    sv1Condition: string | null;
    sv2Condition: string | null;
  };

  readings: CertificateReadings;
  retest: CertificateRetest | null;

  device: {
    id: string;
    serialNumber: string;
    manufacturer: string;
    model: string;
    size: string;
    type: DeviceType;
    typeLabel: string;
    locationDescription: string;
    installDate: string | null;
    serviceType: string | null;
  };

  customer: {
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    billingAddress: AddressBlock;
  };

  serviceLocation: {
    id: string;
    nickname: string | null;
    address: AddressBlock;
    onSiteContactName: string | null;
    onSiteContactPhone: string | null;
    onSiteContactEmail: string | null;
    waterDistrict: string | null;
    hazardType: string | null;
  };

  tester: {
    id: string;
    fullName: string;
    licenseNumber: string;
    licenseExpiration: string; // YYYY-MM-DD
    licenseIssuingAuthority: string | null;
  };

  company: {
    id: string;
    name: string;
    address: AddressBlock;
    phone: string | null;
    website: string | null;
    logoUrl: string | null; // raw value from companies.logo_url — storage path, not signed URL
    pdfFooter: string | null;
  };
};

export type AddressBlock = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

// ----- Input row shapes -----
// Deliberately mirror the subset of columns we read, so tests can
// construct fixtures without importing the full Supabase Database type.

export type TestResultRow = {
  id: string;
  test_date: string;
  result: string;
  check_valve_1_psid: number | string | null;
  check_valve_2_psid: number | string | null;
  relief_valve_opening: number | string | null;
  air_inlet_opening: number | string | null;
  shutoff_valve_1_condition: string | null;
  shutoff_valve_2_condition: string | null;
  test_gauge_serial: string;
  test_gauge_calibration_date: string | null;
  water_supply_pressure: number | string | null;
  repairs_made: string | null;
  retest_result: string | null;
  retest_check_valve_1_psid: number | string | null;
  retest_check_valve_2_psid: number | string | null;
  retest_relief_valve_opening: number | string | null;
  retest_date: string | null;
  notes: string | null;
};

export type DeviceRow = {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  size: string;
  type: string;
  location_description: string;
  install_date: string | null;
  service_type: string | null;
};

export type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address_line_1: string | null;
  billing_address_line_2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
};

export type ServiceLocationRow = {
  id: string;
  nickname: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  zip: string;
  on_site_contact_first_name: string | null;
  on_site_contact_last_name: string | null;
  on_site_contact_phone: string | null;
  on_site_contact_email: string | null;
  water_district: string | null;
  hazard_type: string | null;
};

export type TesterRow = {
  id: string;
  first_name: string;
  last_name: string;
  license_number: string;
  license_expiration: string;
  license_issuing_authority: string | null;
};

export type CompanyRow = {
  id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  default_pdf_footer: string | null;
};

export type BuildCertificateDataInput = {
  testResult: TestResultRow;
  device: DeviceRow;
  customer: CustomerRow;
  serviceLocation: ServiceLocationRow;
  tester: TesterRow;
  company: CompanyRow;
};

const VALID_TYPES: readonly DeviceType[] = ["RP", "DC", "PVB", "SVB", "AVB"];

function narrowDeviceType(raw: string): DeviceType {
  return (VALID_TYPES as readonly string[]).includes(raw)
    ? (raw as DeviceType)
    : "RP";
}

function narrowResult(raw: string): "pass" | "fail" {
  return raw === "fail" ? "fail" : "pass";
}

function toNum(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildReadings(
  type: DeviceType,
  t: TestResultRow,
): CertificateReadings {
  if (type === "RP") {
    return {
      kind: "rp",
      check_valve_1_psid: toNum(t.check_valve_1_psid),
      check_valve_2_psid: toNum(t.check_valve_2_psid),
      relief_valve_opening: toNum(t.relief_valve_opening),
    };
  }
  if (type === "DC") {
    return {
      kind: "dc",
      check_valve_1_psid: toNum(t.check_valve_1_psid),
      check_valve_2_psid: toNum(t.check_valve_2_psid),
    };
  }
  if (type === "PVB" || type === "SVB") {
    return {
      kind: "pvb_svb",
      check_valve_psid: toNum(t.check_valve_1_psid),
      air_inlet_opening: toNum(t.air_inlet_opening),
    };
  }
  return { kind: "avb" };
}

function buildRetestReadings(
  type: DeviceType,
  t: TestResultRow,
): CertificateReadings {
  if (type === "RP") {
    return {
      kind: "rp",
      check_valve_1_psid: toNum(t.retest_check_valve_1_psid),
      check_valve_2_psid: toNum(t.retest_check_valve_2_psid),
      relief_valve_opening: toNum(t.retest_relief_valve_opening),
    };
  }
  if (type === "DC") {
    return {
      kind: "dc",
      check_valve_1_psid: toNum(t.retest_check_valve_1_psid),
      check_valve_2_psid: toNum(t.retest_check_valve_2_psid),
    };
  }
  if (type === "PVB" || type === "SVB") {
    // No retest_air_inlet_opening column exists — intentional per blueprint.
    return {
      kind: "pvb_svb",
      check_valve_psid: toNum(t.retest_check_valve_1_psid),
      air_inlet_opening: null,
    };
  }
  return { kind: "avb" };
}

export function buildCertificateData(
  input: BuildCertificateDataInput,
): CertificateData {
  const { testResult: t, device, customer, serviceLocation, tester, company } =
    input;

  const type = narrowDeviceType(device.type);
  const result = narrowResult(t.result);
  const retestResult =
    t.retest_result === "pass" || t.retest_result === "fail"
      ? t.retest_result
      : null;

  const retest: CertificateRetest | null = retestResult
    ? {
        date: t.retest_date,
        result: retestResult,
        repairs: t.repairs_made,
        readings: buildRetestReadings(type, t),
      }
    : null;

  return {
    testResultId: t.id,
    certificateNumber: t.id.replace(/-/g, "").slice(0, 8).toUpperCase(),

    test: {
      date: t.test_date,
      result,
      effectiveResult: retest?.result ?? result,
      waterSupplyPressure: toNum(t.water_supply_pressure),
      notes: t.notes,
    },

    gauge: {
      serial: t.test_gauge_serial,
      calibrationDate: t.test_gauge_calibration_date,
    },

    shutoffs: {
      sv1Condition: t.shutoff_valve_1_condition,
      sv2Condition: t.shutoff_valve_2_condition,
    },

    readings: buildReadings(type, t),
    retest,

    device: {
      id: device.id,
      serialNumber: device.serial_number,
      manufacturer: device.manufacturer,
      model: device.model,
      size: device.size,
      type,
      typeLabel: deviceTypeLabels[type],
      locationDescription: device.location_description,
      installDate: device.install_date,
      serviceType: device.service_type,
    },

    customer: {
      id: customer.id,
      displayName: customerDisplayName(customer),
      email: customer.email,
      phone: customer.phone,
      billingAddress: {
        line1: customer.billing_address_line_1,
        line2: customer.billing_address_line_2,
        city: customer.billing_city,
        state: customer.billing_state,
        zip: customer.billing_zip,
      },
    },

    serviceLocation: {
      id: serviceLocation.id,
      nickname: serviceLocation.nickname,
      address: {
        line1: serviceLocation.address_line_1,
        line2: serviceLocation.address_line_2,
        city: serviceLocation.city,
        state: serviceLocation.state,
        zip: serviceLocation.zip,
      },
      onSiteContactName: joinName(
        serviceLocation.on_site_contact_first_name,
        serviceLocation.on_site_contact_last_name,
      ),
      onSiteContactPhone: serviceLocation.on_site_contact_phone,
      onSiteContactEmail: serviceLocation.on_site_contact_email,
      waterDistrict: serviceLocation.water_district,
      hazardType: serviceLocation.hazard_type,
    },

    tester: {
      id: tester.id,
      fullName: `${tester.first_name} ${tester.last_name}`.trim(),
      licenseNumber: tester.license_number,
      licenseExpiration: tester.license_expiration,
      licenseIssuingAuthority: tester.license_issuing_authority,
    },

    company: {
      id: company.id,
      name: company.name,
      address: {
        line1: company.address_line_1,
        line2: company.address_line_2,
        city: company.city,
        state: company.state,
        zip: company.zip,
      },
      phone: company.phone,
      website: company.website,
      logoUrl: company.logo_url,
      pdfFooter: company.default_pdf_footer,
    },
  };
}

function joinName(first: string | null, last: string | null): string | null {
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined || null;
}

// Pretty-print an address block as a single comma-joined line. Missing
// parts collapse silently — renderers can null-check the returned string.
export function formatAddressLine(addr: AddressBlock): string | null {
  const street = [addr.line1, addr.line2].filter(Boolean).join(", ");
  const cityStateZip = [
    addr.city,
    [addr.state, addr.zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const combined = [street, cityStateZip].filter(Boolean).join(" · ");
  return combined || null;
}
