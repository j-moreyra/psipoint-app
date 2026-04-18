import type { AuthError } from "@supabase/supabase-js";

// User-friendly copy for the Supabase auth error codes we care about.
// Anything we don't recognise falls back to the generic message so we
// never surface raw Supabase text (which leaks implementation detail
// and sometimes exposes whether an account exists).
const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match.",
  email_not_confirmed:
    "Check your email and click the confirmation link before signing in.",
  user_already_exists: "An account with that email already exists.",
  weak_password: "Password is too weak — use at least 8 characters.",
  over_email_send_rate_limit:
    "Too many attempts — wait a minute and try again.",
  over_request_rate_limit: "Too many attempts — wait a minute and try again.",
  otp_expired: "That link has expired. Request a new one.",
  otp_disabled: "Magic-link sign-in is disabled.",
  signup_disabled: "Signups are temporarily disabled.",
  email_address_invalid: "Enter a valid email.",
  same_password: "New password must differ from your current one.",
};

const FALLBACK = "Something went wrong. Please try again.";

export function authErrorMessage(
  error: AuthError | { code?: string | null } | null | undefined,
): string {
  if (!error) return FALLBACK;
  const code = "code" in error ? error.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return FALLBACK;
}
