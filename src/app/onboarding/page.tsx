import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return <OnboardingForm />;
}
