import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: tester } = await supabase
    .from("testers")
    .select(
      "first_name, last_name, phone, license_number, license_expiration, license_issuing_authority, test_gauge_serial, test_gauge_calibration_date, email",
    )
    .eq("id", user!.id)
    .single();

  if (!tester) {
    throw new Error("Missing tester record");
  }

  return (
    <ProfileForm
      email={tester.email}
      defaults={{
        first_name: tester.first_name,
        last_name: tester.last_name,
        phone: tester.phone ?? "",
        license_number: tester.license_number,
        license_expiration: tester.license_expiration,
        license_issuing_authority: tester.license_issuing_authority ?? "",
        test_gauge_serial: tester.test_gauge_serial ?? "",
        test_gauge_calibration_date: tester.test_gauge_calibration_date ?? "",
      }}
    />
  );
}
