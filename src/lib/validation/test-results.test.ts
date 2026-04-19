import { describe, expect, it } from "vitest";
import { FIELD_LIMITS } from "./fields";
import {
  testResultFormDefaults,
  testResultSchema,
  testResultValueLabels,
  testResultValues,
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

const validDc: TestResultInput = {
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

const validPvb: TestResultInput = {
  device_type: "PVB",
  test_date: "2026-04-18",
  test_gauge_serial: "G-1",
  test_gauge_calibration_date: "",
  water_supply_pressure: "",
  shutoff_valve_1_condition: "",
  shutoff_valve_2_condition: "",
  result: "pass",
  notes: "",
  check_valve_1_psid: "2.3",
  air_inlet_opening: "1.1",
  repairs_made: "",
  retest_result: "",
  retest_check_valve_1_psid: "",
  retest_check_valve_2_psid: "",
  retest_relief_valve_opening: "",
  retest_date: "",
};

const validSvb: TestResultInput = {
  device_type: "SVB",
  test_date: "2026-04-18",
  test_gauge_serial: "G-1",
  test_gauge_calibration_date: "",
  water_supply_pressure: "",
  shutoff_valve_1_condition: "",
  shutoff_valve_2_condition: "",
  result: "pass",
  notes: "",
  check_valve_1_psid: "2.0",
  air_inlet_opening: "1.0",
  repairs_made: "",
  retest_result: "",
  retest_check_valve_1_psid: "",
  retest_check_valve_2_psid: "",
  retest_relief_valve_opening: "",
  retest_date: "",
};

const validAvb: TestResultInput = {
  device_type: "AVB",
  test_date: "2026-04-18",
  test_gauge_serial: "G-1",
  test_gauge_calibration_date: "",
  water_supply_pressure: "",
  shutoff_valve_1_condition: "",
  shutoff_valve_2_condition: "",
  result: "pass",
  notes: "Visual inspection — no leaks.",
  repairs_made: "",
  retest_result: "",
  retest_check_valve_1_psid: "",
  retest_check_valve_2_psid: "",
  retest_relief_valve_opening: "",
  retest_date: "",
};

describe("testResultValues + labels", () => {
  it("exposes the pass/fail tuple (order matters for UI radios)", () => {
    expect(testResultValues).toEqual(["pass", "fail"]);
  });

  it("labels map every value", () => {
    for (const v of testResultValues) {
      expect(testResultValueLabels[v]).toBeTruthy();
    }
  });
});

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

  it("accepts PSID at the 999.9 upper boundary", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        check_valve_1_psid: "999.9",
      }).success,
    ).toBe(true);
  });

  it("rejects missing test_date", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_date: "" }).success,
    ).toBe(false);
  });

  it("rejects malformed test_date", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_date: "04/18/2026" })
        .success,
    ).toBe(false);
  });

  it("rejects missing gauge serial", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_gauge_serial: "" })
        .success,
    ).toBe(false);
  });

  it("rejects whitespace-only gauge serial", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, test_gauge_serial: "   " })
        .success,
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

  it("rejects PSID with two decimals (numeric(4,1) overflow)", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        check_valve_1_psid: "12.34",
      }).success,
    ).toBe(false);
  });

  it("rejects PSID with negative value", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        relief_valve_opening: "-1",
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

  it("accepts fail result (schema permits — UX is what requires retest_*)", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, result: "fail" }).success,
    ).toBe(true);
  });
});

describe("testResultSchema — DC / PVB / SVB variants", () => {
  it("DC: accepts minimal DC test with cv1 + cv2 only", () => {
    expect(testResultSchema.safeParse(validDc).success).toBe(true);
  });

  it("PVB: accepts minimal PVB test with cv1 + air_inlet", () => {
    expect(testResultSchema.safeParse(validPvb).success).toBe(true);
  });

  it("SVB: accepts minimal SVB test with cv1 + air_inlet", () => {
    expect(testResultSchema.safeParse(validSvb).success).toBe(true);
  });

  it("PVB: rejects 1000+ air_inlet_opening", () => {
    expect(
      testResultSchema.safeParse({ ...validPvb, air_inlet_opening: "1000" })
        .success,
    ).toBe(false);
  });
});

describe("testResultSchema — AVB (inspection-only)", () => {
  it("parses without any PSID fields", () => {
    expect(testResultSchema.safeParse(validAvb).success).toBe(true);
  });

  it("still requires test_date + gauge serial (inspection has records too)", () => {
    expect(
      testResultSchema.safeParse({ ...validAvb, test_date: "" }).success,
    ).toBe(false);
    expect(
      testResultSchema.safeParse({ ...validAvb, test_gauge_serial: "" })
        .success,
    ).toBe(false);
  });

  it("still accepts pass or fail (a backflow event at an AVB matters)", () => {
    expect(
      testResultSchema.safeParse({ ...validAvb, result: "fail" }).success,
    ).toBe(true);
  });

  it("accepts notes up to the 5000-char notes cap", () => {
    const longNotes = "x".repeat(FIELD_LIMITS.notes);
    expect(
      testResultSchema.safeParse({ ...validAvb, notes: longNotes }).success,
    ).toBe(true);
  });
});

describe("testResultSchema — discriminated union", () => {
  it("routes on device_type", () => {
    expect(testResultSchema.safeParse(validDc).success).toBe(true);
  });

  it("rejects unknown device_type", () => {
    const bogus = {
      ...validRp,
      device_type: "XYZ",
    } as unknown as TestResultInput;
    expect(testResultSchema.safeParse(bogus).success).toBe(false);
  });

  it("rejects missing device_type", () => {
    const { device_type: _, ...rest } = validRp;
    void _;
    expect(
      testResultSchema.safeParse(rest as unknown as TestResultInput).success,
    ).toBe(false);
  });
});

describe("testResultSchema — length caps (DB drift)", () => {
  it("test_gauge_serial capped at FIELD_LIMITS.serial (100)", () => {
    const overflow = "x".repeat(FIELD_LIMITS.serial + 1);
    expect(
      testResultSchema.safeParse({ ...validRp, test_gauge_serial: overflow })
        .success,
    ).toBe(false);
  });

  it("test_gauge_serial accepts exactly FIELD_LIMITS.serial chars", () => {
    const atCap = "x".repeat(FIELD_LIMITS.serial);
    expect(
      testResultSchema.safeParse({ ...validRp, test_gauge_serial: atCap })
        .success,
    ).toBe(true);
  });

  it("notes capped at FIELD_LIMITS.notes (5000)", () => {
    const overflow = "x".repeat(FIELD_LIMITS.notes + 1);
    expect(
      testResultSchema.safeParse({ ...validRp, notes: overflow }).success,
    ).toBe(false);
  });

  it("notes accepts exactly FIELD_LIMITS.notes chars", () => {
    const atCap = "x".repeat(FIELD_LIMITS.notes);
    expect(
      testResultSchema.safeParse({ ...validRp, notes: atCap }).success,
    ).toBe(true);
  });

  it("repairs_made capped at FIELD_LIMITS.repairs (5000)", () => {
    const overflow = "x".repeat(FIELD_LIMITS.repairs + 1);
    expect(
      testResultSchema.safeParse({ ...validRp, repairs_made: overflow })
        .success,
    ).toBe(false);
  });

  it("repairs_made accepts exactly FIELD_LIMITS.repairs chars", () => {
    const atCap = "x".repeat(FIELD_LIMITS.repairs);
    expect(
      testResultSchema.safeParse({ ...validRp, repairs_made: atCap })
        .success,
    ).toBe(true);
  });

  it("shutoff_valve_1_condition capped at FIELD_LIMITS.shutoffCondition (200)", () => {
    const overflow = "x".repeat(FIELD_LIMITS.shutoffCondition + 1);
    expect(
      testResultSchema.safeParse({
        ...validRp,
        shutoff_valve_1_condition: overflow,
      }).success,
    ).toBe(false);
  });

  it("shutoff_valve_2_condition capped at FIELD_LIMITS.shutoffCondition (200)", () => {
    const overflow = "x".repeat(FIELD_LIMITS.shutoffCondition + 1);
    expect(
      testResultSchema.safeParse({
        ...validRp,
        shutoff_valve_2_condition: overflow,
      }).success,
    ).toBe(false);
  });
});

describe("testResultSchema — optional date fields", () => {
  it("test_gauge_calibration_date accepts empty", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        test_gauge_calibration_date: "",
      }).success,
    ).toBe(true);
  });

  it("test_gauge_calibration_date accepts YYYY-MM-DD", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        test_gauge_calibration_date: "2026-01-01",
      }).success,
    ).toBe(true);
  });

  it("test_gauge_calibration_date rejects malformed", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        test_gauge_calibration_date: "2026/01/01",
      }).success,
    ).toBe(false);
  });

  it("retest_date accepts empty", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, retest_date: "" }).success,
    ).toBe(true);
  });

  it("retest_date rejects malformed", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, retest_date: "tomorrow" })
        .success,
    ).toBe(false);
  });
});

describe("testResultSchema — retest block", () => {
  it("retest_result accepts empty (no retest)", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, retest_result: "" }).success,
    ).toBe(true);
  });

  it("retest_result accepts pass", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, retest_result: "pass" }).success,
    ).toBe(true);
  });

  it("retest_result accepts fail", () => {
    expect(
      testResultSchema.safeParse({ ...validRp, retest_result: "fail" }).success,
    ).toBe(true);
  });

  it("retest_result rejects unknown value", () => {
    const bogus = {
      ...validRp,
      retest_result: "maybe",
    } as unknown as TestResultInput;
    expect(testResultSchema.safeParse(bogus).success).toBe(false);
  });

  it("retest PSID overflow rejected", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        retest_check_valve_1_psid: "1000",
      }).success,
    ).toBe(false);
  });

  it("water_supply_pressure accepts valid PSI", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        water_supply_pressure: "65.5",
      }).success,
    ).toBe(true);
  });

  it("water_supply_pressure rejects non-numeric", () => {
    expect(
      testResultSchema.safeParse({
        ...validRp,
        water_supply_pressure: "high",
      }).success,
    ).toBe(false);
  });
});

describe("toTestResultInsert — scope ids", () => {
  it("attaches all five scope ids", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.company_id).toBe("co-1");
    expect(insert.customer_id).toBe("cu-1");
    expect(insert.service_location_id).toBe("sl-1");
    expect(insert.device_id).toBe("dv-1");
    expect(insert.tester_id).toBe("te-1");
  });
});

describe("toTestResultInsert — PSID normalization", () => {
  it("parses PSID strings to numbers (RP)", () => {
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

  it("parses zero as the number 0, not null", () => {
    const withZero: TestResultInput = { ...validRp, check_valve_1_psid: "0" };
    expect(toTestResultInsert(withZero, ids).check_valve_1_psid).toBe(0);
  });

  it("converts water_supply_pressure to a number", () => {
    const insert = toTestResultInsert(
      { ...validRp, water_supply_pressure: "72.4" },
      ids,
    );
    expect(insert.water_supply_pressure).toBe(72.4);
  });

  it("null for empty water_supply_pressure", () => {
    expect(toTestResultInsert(validRp, ids).water_supply_pressure).toBeNull();
  });
});

describe("toTestResultInsert — retest block nulling", () => {
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

  it("passes retest_result 'pass' through after initial fail", () => {
    const retested: TestResultInput = {
      ...validRp,
      result: "fail",
      retest_result: "pass",
      retest_check_valve_1_psid: "2.5",
      retest_check_valve_2_psid: "1.9",
      retest_relief_valve_opening: "3.1",
      retest_date: "2026-04-19",
    };
    const insert = toTestResultInsert(retested, ids);
    expect(insert.retest_result).toBe("pass");
    expect(insert.retest_check_valve_1_psid).toBe(2.5);
    expect(insert.retest_check_valve_2_psid).toBe(1.9);
    expect(insert.retest_relief_valve_opening).toBe(3.1);
    expect(insert.retest_date).toBe("2026-04-19");
  });
});

describe("toTestResultInsert — per-variant column shape", () => {
  it("RP: all three readings set", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.check_valve_1_psid).toBe(2.5);
    expect(insert.check_valve_2_psid).toBe(1.8);
    expect(insert.relief_valve_opening).toBe(3);
    expect(insert.air_inlet_opening).toBeNull();
  });

  it("DC: cv1 + cv2 only; relief + air_inlet null", () => {
    const insert = toTestResultInsert(validDc, ids);
    expect(insert.check_valve_1_psid).toBe(2.1);
    expect(insert.check_valve_2_psid).toBe(1.9);
    expect(insert.relief_valve_opening).toBeNull();
    expect(insert.air_inlet_opening).toBeNull();
  });

  it("PVB: cv1 + air_inlet; cv2 + relief null", () => {
    const insert = toTestResultInsert(validPvb, ids);
    expect(insert.check_valve_1_psid).toBe(2.3);
    expect(insert.air_inlet_opening).toBe(1.1);
    expect(insert.check_valve_2_psid).toBeNull();
    expect(insert.relief_valve_opening).toBeNull();
  });

  it("SVB: cv1 + air_inlet; cv2 + relief null", () => {
    const insert = toTestResultInsert(validSvb, ids);
    expect(insert.check_valve_1_psid).toBe(2);
    expect(insert.air_inlet_opening).toBe(1);
    expect(insert.check_valve_2_psid).toBeNull();
    expect(insert.relief_valve_opening).toBeNull();
  });

  it("AVB: all reading columns null", () => {
    const insert = toTestResultInsert(validAvb, ids);
    expect(insert.check_valve_1_psid).toBeNull();
    expect(insert.check_valve_2_psid).toBeNull();
    expect(insert.relief_valve_opening).toBeNull();
    expect(insert.air_inlet_opening).toBeNull();
  });
});

describe("toTestResultInsert — string nulling", () => {
  it("null for empty notes", () => {
    expect(toTestResultInsert(validRp, ids).notes).toBeNull();
  });

  it("preserves notes when set", () => {
    const withNotes: TestResultInput = {
      ...validRp,
      notes: "Tested at 10am, dry weather.",
    };
    expect(toTestResultInsert(withNotes, ids).notes).toBe(
      "Tested at 10am, dry weather.",
    );
  });

  it("null for empty repairs_made", () => {
    expect(toTestResultInsert(validRp, ids).repairs_made).toBeNull();
  });

  it("preserves repairs_made when set", () => {
    const withRepairs: TestResultInput = {
      ...validRp,
      repairs_made: "Replaced relief valve spring.",
    };
    expect(toTestResultInsert(withRepairs, ids).repairs_made).toBe(
      "Replaced relief valve spring.",
    );
  });

  it("null for empty shutoff conditions", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect(insert.shutoff_valve_1_condition).toBeNull();
    expect(insert.shutoff_valve_2_condition).toBeNull();
  });

  it("preserves shutoff conditions when set", () => {
    const withCond: TestResultInput = {
      ...validRp,
      shutoff_valve_1_condition: "Leaks slightly when closed",
      shutoff_valve_2_condition: "Tight",
    };
    const insert = toTestResultInsert(withCond, ids);
    expect(insert.shutoff_valve_1_condition).toBe("Leaks slightly when closed");
    expect(insert.shutoff_valve_2_condition).toBe("Tight");
  });

  it("null for empty gauge calibration date", () => {
    expect(
      toTestResultInsert(validRp, ids).test_gauge_calibration_date,
    ).toBeNull();
  });

  it("preserves gauge calibration date when set", () => {
    const withCal: TestResultInput = {
      ...validRp,
      test_gauge_calibration_date: "2026-01-10",
    };
    expect(
      toTestResultInsert(withCal, ids).test_gauge_calibration_date,
    ).toBe("2026-01-10");
  });
});

describe("toTestResultInsert — review_status", () => {
  it("auto-stamps review_status = approved (v1 solo-tester default)", () => {
    expect(toTestResultInsert(validRp, ids).review_status).toBe("approved");
  });

  it("review_status is constant across every variant", () => {
    expect(toTestResultInsert(validDc, ids).review_status).toBe("approved");
    expect(toTestResultInsert(validPvb, ids).review_status).toBe("approved");
    expect(toTestResultInsert(validSvb, ids).review_status).toBe("approved");
    expect(toTestResultInsert(validAvb, ids).review_status).toBe("approved");
  });
});

describe("toTestResultInsert — device_type discriminator", () => {
  it("strips the form-only device_type from the insert payload", () => {
    const insert = toTestResultInsert(validRp, ids);
    expect("device_type" in insert).toBe(false);
  });
});

describe("testResultFormDefaults — RP", () => {
  it("seeds the RP variant with the three RP reading fields", () => {
    const d = testResultFormDefaults("RP");
    expect(d.device_type).toBe("RP");
    if (d.device_type !== "RP") throw new Error("unreachable");
    expect(d.check_valve_1_psid).toBe("");
    expect(d.check_valve_2_psid).toBe("");
    expect(d.relief_valve_opening).toBe("");
  });
});

describe("testResultFormDefaults — DC", () => {
  it("seeds DC with cv1 + cv2 only", () => {
    const d = testResultFormDefaults("DC");
    expect(d.device_type).toBe("DC");
    if (d.device_type !== "DC") throw new Error("unreachable");
    expect(d.check_valve_1_psid).toBe("");
    expect(d.check_valve_2_psid).toBe("");
    expect("relief_valve_opening" in d).toBe(false);
    expect("air_inlet_opening" in d).toBe(false);
  });
});

describe("testResultFormDefaults — PVB", () => {
  it("seeds PVB with cv1 + air_inlet only", () => {
    const d = testResultFormDefaults("PVB");
    expect(d.device_type).toBe("PVB");
    if (d.device_type !== "PVB") throw new Error("unreachable");
    expect(d.check_valve_1_psid).toBe("");
    expect(d.air_inlet_opening).toBe("");
    expect("check_valve_2_psid" in d).toBe(false);
    expect("relief_valve_opening" in d).toBe(false);
  });
});

describe("testResultFormDefaults — SVB", () => {
  it("seeds SVB with cv1 + air_inlet only", () => {
    const d = testResultFormDefaults("SVB");
    expect(d.device_type).toBe("SVB");
    if (d.device_type !== "SVB") throw new Error("unreachable");
    expect(d.check_valve_1_psid).toBe("");
    expect(d.air_inlet_opening).toBe("");
    expect("check_valve_2_psid" in d).toBe(false);
    expect("relief_valve_opening" in d).toBe(false);
  });
});

describe("testResultFormDefaults — AVB", () => {
  it("seeds AVB with no reading fields", () => {
    const d = testResultFormDefaults("AVB");
    expect(d.device_type).toBe("AVB");
    expect("check_valve_1_psid" in d).toBe(false);
    expect("check_valve_2_psid" in d).toBe(false);
    expect("relief_valve_opening" in d).toBe(false);
    expect("air_inlet_opening" in d).toBe(false);
  });
});

describe("testResultFormDefaults — smart defaults (Q11 + Q12)", () => {
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

  it("missing smart defaults resolve to '' (don't crash)", () => {
    const d = testResultFormDefaults("RP");
    expect(d.test_date).toBe("");
    expect(d.test_gauge_serial).toBe("");
    expect(d.test_gauge_calibration_date).toBe("");
  });

  it("partial smart defaults: only testDate set", () => {
    const d = testResultFormDefaults("RP", { testDate: "2026-04-18" });
    expect(d.test_date).toBe("2026-04-18");
    expect(d.test_gauge_serial).toBe("");
    expect(d.test_gauge_calibration_date).toBe("");
  });

  it("partial smart defaults: only gaugeSerial set", () => {
    const d = testResultFormDefaults("RP", { gaugeSerial: "G-1" });
    expect(d.test_date).toBe("");
    expect(d.test_gauge_serial).toBe("G-1");
  });

  it("defaults result to 'pass' (happy path)", () => {
    expect(testResultFormDefaults("RP").result).toBe("pass");
  });

  it("defaults retest_result to empty string", () => {
    expect(testResultFormDefaults("RP").retest_result).toBe("");
  });

  it("every variant default parses back through the schema", () => {
    // Smart defaults include a gauge serial so the schema's required
    // field is satisfied — mirrors what the canonical test-form route
    // hands to the form at page load time.
    const smart = { testDate: "2026-04-18", gaugeSerial: "G-1" };
    for (const type of ["RP", "DC", "PVB", "SVB", "AVB"] as const) {
      const d = testResultFormDefaults(type, smart);
      expect(testResultSchema.safeParse(d).success).toBe(true);
    }
  });
});
