import type { Metadata } from "next";
import Link from "next/link";
import { BuildingIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {tester?.first_name ?? "there"}.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Running {companyName} on BackFLO.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button nativeButton={false} render={<Link href="/customers" />}>
          <BuildingIcon className="size-4" />
          Customers
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/customers/new" />}
        >
          <PlusIcon className="size-4" />
          New customer
        </Button>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Unified search, test recording, and the PDF certificate flow land
          in Phases 3–4. For now you can manage customers, service locations,
          and devices.
        </p>
      </div>
    </div>
  );
}
