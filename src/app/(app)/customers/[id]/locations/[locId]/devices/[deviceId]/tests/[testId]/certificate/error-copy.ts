// Stage-specific toast copy for the two server actions. Kept in a
// standalone file (not inside the client component) so tests can import
// these without pulling in the `"use server"` action module and its
// server-only transitive deps.

export function generateErrorCopy(
  stage: "fetch" | "pdf" | "storage" | "db",
): string {
  switch (stage) {
    case "fetch":
      return "Couldn't load the test data. Refresh and try again.";
    case "pdf":
      return "Couldn't generate the PDF. Try again.";
    case "storage":
      return "Couldn't save the PDF. Try again.";
    case "db":
      return "Couldn't record the certificate. Try again.";
  }
}

export function sendErrorCopy(
  stage:
    | "fetch"
    | "not_ready"
    | "bad_email"
    | "download"
    | "email"
    | "db"
    | "not_configured",
): string {
  switch (stage) {
    case "fetch":
      return "Couldn't load the test data. Refresh and try again.";
    case "not_ready":
      return "Generate the certificate first.";
    case "bad_email":
      return "Enter a valid email address.";
    case "download":
      return "Couldn't load the saved PDF. Try regenerating.";
    case "email":
      return "Couldn't send the email. Check the address and try again.";
    case "db":
      return "Sent, but couldn't record it. Try again.";
    case "not_configured":
      return "Email sending isn't set up yet. Contact support.";
  }
}
