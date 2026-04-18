import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; flow?: "signup" | "reset" }>;
}) {
  const { email, flow } = await searchParams;
  const isReset = flow === "reset";

  return (
    <AuthShell
      title="Check your email"
      description={
        isReset
          ? "We sent you a link to reset your password."
          : "We sent you a link to confirm your account."
      }
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <p className="text-sm text-muted-foreground">
        {email ? (
          <>
            Sent to{" "}
            <span className="font-medium text-foreground">{email}</span>.{" "}
          </>
        ) : null}
        The link will sign you in automatically. Check your spam folder if you
        don&apos;t see it within a minute.
      </p>
    </AuthShell>
  );
}
