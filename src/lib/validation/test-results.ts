import { z } from "zod";
import {
  cappedOptionalText,
  FIELD_LIMITS,
  optionalDate,
  optionalPsi,
  requiredDate,
  requiredText,
} from "@/lib/validation/fields";
import { type DeviceType } from "./devices";

export const testResultValues = ["pass", "fail"] as const;
export type TestResultValue = (typeof testResultValues)[number];

export const testResultValueLabels: Record<TestResultValue, string> = {
  pass: "Pass",
  fail: "Fail",
};

// Retest result can be unset ("") when there's no retest to record — either
// because the initial test passed, or because the tester hasn't finished the
// retest yet. Converted to null at submit.
const optionalResult = z.union([z.literal(""), z.enum(testResultValues)]);

// Shared fields — every device type carries these, including AVB
// inspection-only tests. Length caps mirror migration
// 20260417130000_length_constraints.sql.
const baseTest = z.object({
  test_date: requiredDate,
  test_gauge_serial: requiredText(
    "Gauge serial is required",
    FIELD_LIMITS.serial,
  ),
  test_gauge_calibration_date: optionalDate,
  water_supply_pressure: optionalPsi,
  shutoff_valve_1_condition: cappedOptionalText(FIELD_LIMITS.shutoffCondition),
  shutoff_valve_2_condition: cappedOptionalText(FIELD_LIMITS.shutoffCondition),
  result: z.enum(testResultValues),
  notes: cappedOptionalText(FIELD_LIMITS.notes),
  // Retest block — all optional at the schema layer so "pass on first test"
  // validates with every retest_* empty. Unit 13 layers conditional UX
  // requirements on top (visible + required only when result === 'fail').
  repairs_made: cappedOptionalText(FIELD_LIMITS.repairs),
  retest_result: optionalResult,
  retest_check_valve_1_psid: optionalPsi,
  retest_check_valve_2_psid: optionalPsi,
  retest_relief_valve_opening: optionalPsi,
  retest_date: optionalDate,
});

// Per-type readings. `device_type` is a form-only discriminator — it
// matches the loaded device.type and is stripped at submit time (the DB
// carries device type via the device_id foreign key, not directly).
const rpSchema = baseTest.extend({
  device_type: z.literal("RP"),
  check_valve_1_psid: optionalPsi,
  check_valve_2_psid: optionalPsi,
  relief_valve_opening: optionalPsi,
});

const dcSchema = baseTest.extend({
  device_type: z.literal("DC"),
  check_valve_1_psid: optionalPsi,
  check_valve_2_psid: optionalPsi,
});

const pvbSchema = baseTest.extend({
  device_type: z.literal("PVB"),
  check_valve_1_psid: optionalPsi,
  air_inlet_opening: optionalPsi,
});

const svbSchema = baseTest.extend({
  device_type: z.literal("SVB"),
  check_valve_1_psid: optionalPsi,
  air_inlet_opening: optionalPsi,
});

// AVBs are visual-inspection only. No PSID readings; pass/fail + shutoff
// condition + notes carry the record.
const avbSchema = baseTest.extend({
  device_type: z.literal("AVB"),
});

export const testResultSchema = z.discriminatedUnion("device_type", [
  rpSchema,
  dcSchema,
  pvbSchema,
  svbSchema,
  avbSchema,
]);

export type TestResultInput = z.infer<typeof testResultSchema>;

const toNumOrNull = (s: string): number | null =>
  s.length > 0 ? Number(s) : null;
const toNullIfEmpty = (s: string): string | null =>
  s.length > 0 ? s : null;

export type TestResultInsertIds = {
  companyId: string;
  customerId: string;
  serviceLocationId: string;
  deviceId: string;
  testerId: string;
};

export function toTestResultInsert(
  v: TestResultInput,
  ids: TestResultInsertIds,
) {
  // Per-type readings absent from this variant stay null in the Insert
  // payload so the table's column shape is stable regardless of device
  // type. The `in` narrowing is what the discriminated union buys us.
  const typedReadings = {
    check_valve_1_psid:
      "check_valve_1_psid" in v ? toNumOrNull(v.check_valve_1_psid) : null,
    check_valve_2_psid:
      "check_valve_2_psid" in v ? toNumOrNull(v.check_valve_2_psid) : null,
    relief_valve_opening:
      "relief_valve_opening" in v
        ? toNumOrNull(v.relief_valve_opening)
        : null,
    air_inlet_opening:
      "air_inlet_opening" in v ? toNumOrNull(v.air_inlet_opening) : null,
  };

  return {
    company_id: ids.companyId,
    customer_id: ids.customerId,
    service_location_id: ids.serviceLocationId,
    device_id: ids.deviceId,
    tester_id: ids.testerId,
    test_date: v.test_date,
    test_gauge_serial: v.test_gauge_serial,
    test_gauge_calibration_date: toNullIfEmpty(v.test_gauge_calibration_date),
    water_supply_pressure: toNumOrNull(v.water_supply_pressure),
    shutoff_valve_1_condition: toNullIfEmpty(v.shutoff_valve_1_condition),
    shutoff_valve_2_condition: toNullIfEmpty(v.shutoff_valve_2_condition),
    result: v.result,
    notes: toNullIfEmpty(v.notes),
    repairs_made: toNullIfEmpty(v.repairs_made),
    retest_result: v.retest_result === "" ? null : v.retest_result,
    retest_check_valve_1_psid: toNumOrNull(v.retest_check_valve_1_psid),
    retest_check_valve_2_psid: toNumOrNull(v.retest_check_valve_2_psid),
    retest_relief_valve_opening: toNumOrNull(v.retest_relief_valve_opening),
    retest_date: toNullIfEmpty(v.retest_date),
    // Phase 3 Q7: v1 solo testers have no review workflow; every submit
    // lands approved. The column stays in place for v2 multi-tester shops.
    review_status: "approved" as const,
    ...typedReadings,
  };
}

// Form defaults per device type. `testDate` + gauge fields are prefilled
// from the tester profile at page load (unit 11 wires that).
export function testResultFormDefaults(
  deviceType: DeviceType,
  smart: {
    testDate?: string;
    gaugeSerial?: string;
    gaugeCalibrationDate?: string;
  } = {},
): TestResultInput {
  const shared = {
    test_date: smart.testDate ?? "",
    test_gauge_serial: smart.gaugeSerial ?? "",
    test_gauge_calibration_date: smart.gaugeCalibrationDate ?? "",
    water_supply_pressure: "",
    shutoff_valve_1_condition: "",
    shutoff_valve_2_condition: "",
    result: "pass" as const,
    notes: "",
    repairs_made: "",
    retest_result: "" as const,
    retest_check_valve_1_psid: "",
    retest_check_valve_2_psid: "",
    retest_relief_valve_opening: "",
    retest_date: "",
  };
  switch (deviceType) {
    case "RP":
      return {
        ...shared,
        device_type: "RP",
        check_valve_1_psid: "",
        check_valve_2_psid: "",
        relief_valve_opening: "",
      };
    case "DC":
      return {
        ...shared,
        device_type: "DC",
        check_valve_1_psid: "",
        check_valve_2_psid: "",
      };
    case "PVB":
      return {
        ...shared,
        device_type: "PVB",
        check_valve_1_psid: "",
        air_inlet_opening: "",
      };
    case "SVB":
      return {
        ...shared,
        device_type: "SVB",
        check_valve_1_psid: "",
        air_inlet_opening: "",
      };
    case "AVB":
      return { ...shared, device_type: "AVB" };
  }
}
