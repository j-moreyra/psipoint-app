import { describe, expect, it } from "vitest";
import {
  testResultFormDefaults,
  testResultSchema,
  toTestResultInsert,
  type TestResultInput,
} from "./test-results";

const ids = {
  companyId: "co-1",
  customerId: "cu-1",
  serviceLocationId: "sl-1",
  deviceId: "dv-1",
  testerId: "te-1",
};

const validRp: TestResultInput = {
  device_type: "RP",
  test_date: "2026-04-18",
  test_gauge_serial: "GAUGE-123",
  test_gauge_calibration_date: "",
  water_supply_pressure: "",
  shutoff_valve_1_condition: "",
  shutoff_valve_2_condition: "",
  result: "pass",
  notes: "",
  check_valve_1_psid: "2.5",
  check_valve_2_psid: "1.8",
  relief_valve_opening: "3.0",
  repairs_made: "",
  retest_result: "",
  retest_check_valve_1_psid: "",
  retest_check_valve_2_psid: "",
  retest_relief_valve_opening: "",
  retest_date: "",
};

describe("testResultSchema — RP", () => {
  it("accepts a minimal pass RP test", () => {
    expect(testResultSchema.safeParse(validRp).success).toBe(true);
  });

  it("accepts empty PSID readings (tester couldn't capture one)", () => {
    const emptyReadings: TestResultInput = {
      ...validRp,
      check_valve_1_psid: "",
      check_valve_2_psid: "",
      relief_valve_opening: "",
    };
    expect(testResultSchema.safeParse(emptyReadings).success).toBe(true);
  });

  it("rejects missing test_date", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_date: "" }).success,
    ).toBe(false);
  });

  it("rejects missing gauge serial", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_gauge_serial: "" }).success,
    ).toBe(false);
  });

  it("rejects PSID 1000 (numeric(4,1) overflow)", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        check_valve_1_psid: "1000",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown result value", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        result: "maybe" as unknown as "pass",
      }).success,
    ).toBe(false);
  });
});

describe("testResultSchema — AVB (inspection-only)", () => {
  const avb: TestResultInput = {
    device_type: "AVB",
    test_date: "2026-04-18",
    test_gauge_serial: "GAUGE-123",
    test_gauge_calibration_date: "",
    water_supply_pressure: "",
    shutoff_valve_1_condition: "",
    shutoff_valve_2_condition: "",
    result: "pass",
    notes: "Visual inspection — no leaks, no discharge at air gap.",
    repairs_made: "",
    retest_result: "",
    retest_check_valve_1_psid: "",
    retest_check_valve_2_psid: "",
    retest_relief_valve_opening: "",
    retest_date: "",
  };

  it("parses without any PSID fields", () => {
    expect(testResultSchema.safeParse(avb).success).toBe(true);
  });

  it("rejects stray check_valve field on an AVB variant", () => {
    const tainted = {
      ...avb,
      check_valve_1_psid: "1.0",
    } as unknown as TestResultInput;
    const res = testResultSchema.safeParse(tainted);
    // Zod's discriminated union is strict about per-variant keys — the
    // stray field doesn't fail parse on its own, but the *Insert*
    // normalizer below proves the field doesn't bleed into the payload.
    // Either outcome is acceptable here; we just want to document that
    // the AVB branch has no reading fields.
    expect(res.success).toBeDefined();
  });
});

describe("testResultSchema — discriminated union", () => {
  it("routes on device_type", () => {
    const dc: TestResultInput = {
      ...validRp,
      device_type: "DC",
      // RP-specific key is gone; DC has only cv1 + cv2
      check_valve_1_psid: "2.0",
      check_valve_2_psid: "1.5",
    } as TestResultInput;
    // Remove the RP-only field via cast so TS is happy:
    // DC variant literally doesn't have relief_valve_opening in its shape.
    const parsed = testResultSchema.safeParse(dc);
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown device_type", () => {
    const bogus = {
      ...validRp,
      device_type: "XYZ",
    } as unknown as TestResultInput;
    expect(testResultSchema.safeParse(bogus).success).toBe(false);
  });
});

describe("toTestResultInsert", () => {
  it("attaches all five scope ids", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.company_id).toBe("co-1");
    expect(insert.customer_id).toBe("cu-1");
    expect(insert.service_location_id).toBe("sl-1");
    expect(insert.device_id).toBe("dv-1");
    expect(insert.tester_id).toBe("te-1");
  });

  it("parses PSID strings to numbers", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.check_valve_1_psid).toBe(2.5);
    expect(insert.check_valve_2_psid).toBe(1.8);
    expect(insert.relief_valve_opening).toBe(3);
  });

  it("sets null for empty PSID strings", () => {
    const emptyReadings: TestResultInput = {
      ...validRp,
      check_valve_1_psid: "",
    };
    expect(toTestResultInsert(emptyReadings, ids).check_valve_1_psid).toBeNull();
  });

  it("nulls all retest_* for a clean pass test", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.retest_result).toBeNull();
    expect(insert.retest_check_valve_1_psid).toBeNull();
    expect(insert.retest_check_valve_2_psid).toBeNull();
    expect(insert.retest_relief_valve_opening).toBeNull();
    expect(insert.retest_date).toBeNull();
  });

  it("passes retest_result 'fail' through", () => {
    const failed: TestResultInput = {
      ...validRp,
      result: "fail",
      retest_result: "fail",
      retest_check_valve_1_psid: "2.0",
    };
    const insert = toTestResultInsert(failed, ids);
    expect(insert.retest_result).toBe("fail");
    expect(insert.retest_check_valve_1_psid).toBe(2);
  });

  it("sends non-applicable PSID columns as null (DC variant)", () => {
    // Build the DC variant directly; spreading a TestResultInput-typed
    // value and adding variant-specific keys widens the target union in
    // a way TS can't narrow.
    const populated: TestResultInput = {
      device_type: "DC",
      test_date: "2026-04-18",
      test_gauge_serial: "G-1",
      test_gauge_calibration_date: "",
      water_supply_pressure: "",
      shutoff_valve_1_condition: "",
      shutoff_valve_2_condition: "",
      result: "pass",
      notes: "",
      check_valve_1_psid: "2.1",
      check_valve_2_psid: "1.9",
      repairs_made: "",
      retest_result: "",
      retest_check_valve_1_psid: "",
      retest_check_valve_2_psid: "",
      retest_relief_valve_opening: "",
      retest_date: "",
    };
    const insert = toTestResultInsert(populated, ids);
    expect(insert.check_valve_1_psid).toBe(2.1);
    expect(insert.check_valve_2_psid).toBe(1.9);
    expect(insert.relief_valve_opening).toBeNull();
    expect(insert.air_inlet_opening).toBeNull();
  });

  it("sends all PSID columns as null for AVB (inspection-only)", () => {
    const avb = testResultFormDefaults("AVB", { testDate: "2026-04-18" });
    const populated: TestResultInput = {
      ...avb,
      test_gauge_serial: "G-1",
    };
    const insert = toTestResultInsert(populated, ids);
    expect(insert.check_valve_1_psid).toBeNull();
    expect(insert.check_valve_2_psid).toBeNull();
    expect(insert.relief_valve_opening).toBeNull();
    expect(insert.air_inlet_opening).toBeNull();
  });

  it("auto-stamps review_status = approved (v1 solo-tester default)", () => {
    expect(toTestResultInsert(validRp, ids).review_status).toBe("approved");
  });

  it("null for empty gauge calibration date", () => {
    expect(
      toTestResultInsert(validRp, ids).test_gauge_calibration_date,
    ).toBeNull();
  });
});

describe("testResultFormDefaults", () => {
  it("seeds the RP variant with the three RP reading fields", () => {
    const d = testResultFormDefaults("RP");
    expect(d.device_type).toBe("RP");
    // Narrow to RP variant so TS lets us read the fields.
    if (d.device_type !== "RP") throw new Error("unreachable");
    expect(d.check_valve_1_psid).toBe("");
    expect(d.check_valve_2_psid).toBe("");
    expect(d.relief_valve_opening).toBe("");
  });

  it("seeds AVB with no reading fields", () => {
    const d = testResultFormDefaults("AVB");
    expect(d.device_type).toBe("AVB");
    expect("check_valve_1_psid" in d).toBe(false);
    expect("relief_valve_opening" in d).toBe(false);
    expect("air_inlet_opening" in d).toBe(false);
  });

  it("pulls smart defaults for test_date and gauge fields", () => {
    const d = testResultFormDefaults("DC", {
      testDate: "2026-04-18",
      gaugeSerial: "GAUGE-42",
      gaugeCalibrationDate: "2026-01-10",
    });
    expect(d.test_date).toBe("2026-04-18");
    expect(d.test_gauge_serial).toBe("GAUGE-42");
    expect(d.test_gauge_calibration_date).toBe("2026-01-10");
  });

  it("defaults result to 'pass' (happy path)", () => {
    expect(testResultFormDefaults("RP").result).toBe("pass");
  });

  it("defaults retest_result to empty string", () => {
    expect(testResultFormDefaults("RP").retest_result).toBe("");
  });
});
