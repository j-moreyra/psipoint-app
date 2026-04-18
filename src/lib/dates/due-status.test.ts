import { describe, expect, it } from "vitest";
import {
  DUE_SOON_WINDOW_DAYS,
  bucketByDueStatus,
  deviceStatus,
  isDueSoon,
  isOverdue,
  type DueStatusInput,
} from "./due-status";

// Anchor "today" so these assertions stay stable across time zones + CI.
const TODAY = new Date("2026-04-18T12:00:00");

describe("DUE_SOON_WINDOW_DAYS", () => {
  it("defaults to 60 days (Phase 3 Q5)", () => {
    expect(DUE_SOON_WINDOW_DAYS).toBe(60);
  });
});

describe("deviceStatus", () => {
  it("never_tested when last_tested_date is null", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: null,
          next_test_due_date: null,
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("never_tested");
  });

  it("overdue when due date is in the past", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-01",
          next_test_due_date: "2026-04-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("overdue");
  });

  it("due_soon when due within 60 days", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-06-15",
          next_test_due_date: "2026-06-15",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("current when due > 60 days out", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-09-01",
          next_test_due_date: "2026-09-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  it("next_due_override wins over next_test_due_date", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2026-01-01",
          next_test_due_date: "2026-12-01", // would be 'current'
          next_due_override: "2026-04-01", // past — overdue
        },
        TODAY,
      ),
    ).toBe("overdue");
  });

  it("tested but no due date → treat as current", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2026-01-01",
          next_test_due_date: null,
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  // 60-day boundary checks around TODAY = 2026-04-18.
  it("boundary: due exactly today → due_soon", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-18",
          next_test_due_date: "2026-04-18",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("boundary: due in exactly 60 days → due_soon (2026-06-17)", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-06-17",
          next_test_due_date: "2026-06-17",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("due_soon");
  });

  it("boundary: due in 61 days → current (2026-06-18)", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-06-18",
          next_test_due_date: "2026-06-18",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("current");
  });

  it("boundary: due yesterday → overdue", () => {
    expect(
      deviceStatus(
        {
          last_tested_date: "2025-04-17",
          next_test_due_date: "2026-04-17",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe("overdue");
  });

  it("custom windowDays flips the boundary (30-day mode)", () => {
    // Due 45 days out — due_soon at default 60, current at 30.
    const d: DueStatusInput = {
      last_tested_date: "2025-06-02",
      next_test_due_date: "2026-06-02",
      next_due_override: null,
    };
    expect(deviceStatus(d, TODAY)).toBe("due_soon");
    expect(deviceStatus(d, TODAY, 30)).toBe("current");
  });
});

describe("isOverdue", () => {
  it("true for past due date", () => {
    expect(
      isOverdue(
        {
          last_tested_date: "2025-04-01",
          next_test_due_date: "2026-04-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe(true);
  });

  it("false for never_tested (no signal to overdue)", () => {
    expect(
      isOverdue(
        {
          last_tested_date: null,
          next_test_due_date: null,
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe(false);
  });

  it("false for due_soon", () => {
    expect(
      isOverdue(
        {
          last_tested_date: "2025-06-15",
          next_test_due_date: "2026-06-15",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe(false);
  });
});

describe("isDueSoon", () => {
  it("true inside the default 60-day window", () => {
    expect(
      isDueSoon(
        {
          last_tested_date: "2025-06-15",
          next_test_due_date: "2026-06-15",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe(true);
  });

  it("false when overdue (past dates are their own bucket)", () => {
    expect(
      isDueSoon(
        {
          last_tested_date: "2025-04-01",
          next_test_due_date: "2026-04-01",
          next_due_override: null,
        },
        TODAY,
      ),
    ).toBe(false);
  });

  it("respects a custom window", () => {
    // Due in 45 days — inside 60d, outside 30d.
    const d: DueStatusInput = {
      last_tested_date: "2025-06-02",
      next_test_due_date: "2026-06-02",
      next_due_override: null,
    };
    expect(isDueSoon(d, TODAY, 60)).toBe(true);
    expect(isDueSoon(d, TODAY, 30)).toBe(false);
  });
});

describe("bucketByDueStatus", () => {
  const devices: DueStatusInput[] = [
    // overdue (due in the past)
    {
      last_tested_date: "2025-04-01",
      next_test_due_date: "2026-04-01",
      next_due_override: null,
    },
    // due_soon (due in ~2 months)
    {
      last_tested_date: "2025-06-15",
      next_test_due_date: "2026-06-15",
      next_due_override: null,
    },
    // current (due next year)
    {
      last_tested_date: "2026-01-01",
      next_test_due_date: "2027-01-01",
      next_due_override: null,
    },
    // never_tested
    {
      last_tested_date: null,
      next_test_due_date: null,
      next_due_override: null,
    },
    // another overdue — confirms bucketing accumulates
    {
      last_tested_date: "2024-10-10",
      next_test_due_date: "2025-10-10",
      next_due_override: null,
    },
  ];

  it("sorts each device into its status bucket", () => {
    const b = bucketByDueStatus(devices, TODAY);
    expect(b.overdue).toHaveLength(2);
    expect(b.dueSoon).toHaveLength(1);
    expect(b.current).toHaveLength(1);
    expect(b.neverTested).toHaveLength(1);
  });

  it("preserves input ordering within each bucket", () => {
    const b = bucketByDueStatus(devices, TODAY);
    // overdue[0] was devices[0]; overdue[1] was devices[4]
    expect(b.overdue[0]).toBe(devices[0]);
    expect(b.overdue[1]).toBe(devices[4]);
  });

  it("empty input → empty buckets", () => {
    const b = bucketByDueStatus([], TODAY);
    expect(b.overdue).toEqual([]);
    expect(b.dueSoon).toEqual([]);
    expect(b.current).toEqual([]);
    expect(b.neverTested).toEqual([]);
  });

  it("custom windowDays flips borderline devices", () => {
    // Due in 45 days — at 60d window it's due_soon, at 30d it's current.
    const borderline: DueStatusInput = {
      last_tested_date: "2025-06-02",
      next_test_due_date: "2026-06-02",
      next_due_override: null,
    };
    expect(bucketByDueStatus([borderline], TODAY, 60).dueSoon).toHaveLength(1);
    expect(bucketByDueStatus([borderline], TODAY, 30).current).toHaveLength(1);
  });
});
