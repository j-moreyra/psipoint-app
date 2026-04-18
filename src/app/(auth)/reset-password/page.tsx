"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  resetRequestSchema,
  type ResetRequestInput,
} from "@/lib/validation/auth";

export default function ResetPasswordRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetRequestInput) {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/update`,
    });
    setSubmitting(false);

    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }

    router.replace(
      `/check-email?flow=reset&email=${encodeURIComponent(values.email)}`,
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="We'll email you a link to choose a new one"
      footer={
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <fieldset disabled={submitting} className="block space-y-4 border-0 p-0 m-0 min-w-0">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            {...register("email")}
            aria-invalid={errors.email ? "true" : undefined}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Sending link…" : "Send reset link"}
        </Button>
        </fieldset>
      </form>
    </AuthShell>
  );
}
