"use client";

import { Button } from "@/components/ui/button";

// Catches uncaught errors from pages in the (app) route group — e.g. a
// Supabase outage while loading /dashboard or /settings/*. Keeps the app
// shell chrome intact via Next.js's error boundary behavior.
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We hit an unexpected error. Try again in a moment — if it keeps
        happening, sign out and back in.
      </p>
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </div>
  );
}
