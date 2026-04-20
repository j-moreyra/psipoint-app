// License expiration warning thresholds for the dashboard banner.
// Bands (days remaining, inclusive on the upper edge):
//   > 90        → no banner
//   90 ≥ n > 60 → info    (plenty of runway, just a heads-up)
//   60 ≥ n > 30 → warn    (schedule the renewal)
//   30 ≥ n > 0  → urgent  (cert validity is at stake)
//   ≤ 0         → expired (strongest copy)
//
// Kept pure so it can be unit-tested without touching the DB or clock.
// Consumes "YYYY-MM-DD" strings — same convention as due-status.

export type LicenseWarningLevel = "info" | "warn" | "urgent" | "expired";

export type LicenseWarning = {
  level: LicenseWarningLevel;
  daysLeft: number; // negative once expired
  expirationYmd: string;
};

export const LICENSE_WARN_THRESHOLDS = {
  info: 90,
  warn: 60,
  urgent: 30,
} as const;

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffCalendarDays(aYmd: string, bYmd: string): number {
  const [ay, am, ad] = aYmd.split("-").map(Number);
  const [by, bm, bd] = bYmd.split("-").map(Number);
  return Math.round(
    (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000,
  );
}

// Returns null when the expiration date is missing, malformed, or sits
// outside all warning bands. Any level returned means the banner
// should render.
export function licenseWarning(
  expirationYmd: string | null | undefined,
  today: Date = new Date(),
): LicenseWarning | null {
  if (!expirationYmd) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expirationYmd)) return null;

  const todayYmd = toLocalDateStr(today);
  const daysLeft = diffCalendarDays(expirationYmd, todayYmd);

  if (daysLeft <= 0) {
    return { level: "expired", daysLeft, expirationYmd };
  }
  if (daysLeft <= LICENSE_WARN_THRESHOLDS.urgent) {
    return { level: "urgent", daysLeft, expirationYmd };
  }
  if (daysLeft <= LICENSE_WARN_THRESHOLDS.warn) {
    return { level: "warn", daysLeft, expirationYmd };
  }
  if (daysLeft <= LICENSE_WARN_THRESHOLDS.info) {
    return { level: "info", daysLeft, expirationYmd };
  }
  return null;
}
