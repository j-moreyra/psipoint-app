import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tester } = await supabase
    .from("testers")
    .select("first_name, companies(name)")
    .eq("id", user!.id)
    .maybeSingle();

  const companyName =
    (tester?.companies as { name: string } | null)?.name ?? "your company";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome back, {tester?.first_name ?? "there"}.
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Running {companyName} on BackFLO.
      </p>

      <div className="mt-8 rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Customers, service locations, devices, and test recording land in the
          next phase. For now, head to{" "}
          <a
            href="/settings/profile"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Settings
          </a>{" "}
          to review your profile and company details.
        </p>
      </div>
    </div>
  );
}
