import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tester } = await supabase
    .from("testers")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!tester) redirect("/onboarding");

  return <AppShell user={tester}>{children}</AppShell>;
}
