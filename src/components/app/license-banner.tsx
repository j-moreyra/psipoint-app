import Link from "next/link";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import type { LicenseWarning } from "@/lib/dates/license-warning";
import { cn } from "@/lib/utils";

// Dashboard-only license expiration banner. Renders nothing when the
// tester's license is more than 90 days out. Copy escalates at the
// 60-day, 30-day, and already-expired thresholds. Placement is
// deliberate: nagging a tester on every page is worse than missing a
// renewal by a week — the dashboard is the first surface they see.

export function LicenseBanner({ warning }: { warning: LicenseWarning | null }) {
  if (!warning) return null;

  const { level, daysLeft, expirationYmd } = warning;
  const { title, body, tone } = copyForLevel(level, daysLeft, expirationYmd);
  const Icon = tone === "info" ? InfoIcon : AlertTriangleIcon;

  return (
    <aside
      role={tone === "destructive" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 shadow-sm",
        tone === "info" &&
          "border-blue-300/60 bg-blue-50 text-blue-950 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-100",
        tone === "warn" &&
          "border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
        tone === "destructive" &&
          "border-destructive/40 bg-destructive/5 text-destructive dark:text-destructive",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "info" && "text-blue-600 dark:text-blue-300",
          tone === "warn" && "text-amber-700 dark:text-amber-300",
          tone === "destructive" && "text-destructive",
        )}
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">{title}</p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            tone === "info" && "text-blue-900/80 dark:text-blue-200/80",
            tone === "warn" && "text-amber-900/80 dark:text-amber-200/80",
            tone === "destructive" && "text-destructive/80",
          )}
        >
          {body}{" "}
          <Link
            href="/settings/profile"
            className="font-medium underline underline-offset-4"
          >
            Update license in Settings
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}

function copyForLevel(
  level: LicenseWarning["level"],
  daysLeft: number,
  expirationYmd: string,
): {
  title: string;
  body: string;
  tone: "info" | "warn" | "destructive";
} {
  switch (level) {
    case "info":
      return {
        tone: "info",
        title: `Your tester license expires on ${expirationYmd}.`,
        body: `You have ${daysLeft} days left — plenty of runway, but worth scheduling the renewal.`,
      };
    case "warn":
      return {
        tone: "warn",
        title: `License expires on ${expirationYmd} — ${daysLeft} days.`,
        body: "Schedule your renewal now so you don't lapse mid-job.",
      };
    case "urgent":
      return {
        tone: "destructive",
        title: `License expires on ${expirationYmd} — ${daysLeft} ${
          daysLeft === 1 ? "day" : "days"
        } left.`,
        body: "Certificates issued after expiration may be rejected by water purveyors.",
      };
    case "expired": {
      const agoDays = Math.abs(daysLeft);
      return {
        tone: "destructive",
        title:
          agoDays === 0
            ? `Your license expired today (${expirationYmd}).`
            : `Your license expired ${agoDays} ${
                agoDays === 1 ? "day" : "days"
              } ago on ${expirationYmd}.`,
        body: "Renew before issuing further certificates.",
      };
    }
  }
}
