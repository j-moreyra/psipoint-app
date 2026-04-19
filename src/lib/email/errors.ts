// Error translator for email operations. Never leak Resend/SMTP error
// text — can include internal IDs, rate-limit mechanics, and DKIM
// diagnostics that aren't helpful to the tester.
export function emailErrorMessage(
  _error: unknown,
  fallback = "Couldn't send the email. Please try again.",
): string {
  return fallback;
}
