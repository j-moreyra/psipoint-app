import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
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
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (tester) redirect("/dashboard");

  return <>{children}</>;
}
