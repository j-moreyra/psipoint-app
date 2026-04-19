import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CertificateData } from "@/lib/pdf/certificate-data";
import { formatAddressLine } from "@/lib/pdf/certificate-data";

// React Email template used for the "here's your backflow test
// certificate" send. Renders HTML + plain text from CertificateData;
// the server action attaches the PDF and passes to Resend.

export type CertificateEmailProps = {
  data: CertificateData;
};

const text = {
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: "#111827",
};
const muted = { ...text, color: "#6b7280", fontSize: 13 };
const body = { backgroundColor: "#f9fafb", margin: 0, padding: "32px 0" };
const container = {
  backgroundColor: "#ffffff",
  borderRadius: 8,
  padding: 28,
  maxWidth: 560,
  margin: "0 auto",
  border: "1px solid #e5e7eb",
};

export function CertificateReadyEmail({ data }: CertificateEmailProps) {
  const passed = data.test.effectiveResult === "pass";
  const title = passed
    ? "Your backflow test certificate"
    : "Your backflow test report (failed)";
  const preview = passed
    ? `${data.device.serialNumber} passed on ${data.test.date}`
    : `${data.device.serialNumber} — test failed on ${data.test.date}`;
  const locationLine = formatAddressLine(data.serviceLocation.address);

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading as="h1" style={{ ...text, fontSize: 20, margin: 0 }}>
            {title}
          </Heading>
          <Text style={{ ...muted, marginTop: 4 }}>
            From {data.company.name}
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

          <Text style={{ ...text, fontSize: 14 }}>
            Hi{data.customer.displayName ? ` ${data.customer.displayName}` : ""},
          </Text>

          <Text style={{ ...text, fontSize: 14 }}>
            Your backflow test certificate is attached. Keep a copy for your
            records — some water utilities ask for it.
          </Text>

          <Section
            style={{
              backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: 16,
              margin: "16px 0",
            }}
          >
            <Row label="Device" value={`${data.device.serialNumber} · ${data.device.typeLabel}`} />
            {locationLine ? <Row label="Location" value={locationLine} /> : null}
            <Row label="Test date" value={data.test.date} />
            <Row
              label="Result"
              value={passed ? "PASS" : "FAIL"}
              valueColor={passed ? "#059669" : "#dc2626"}
              bold
            />
            <Row
              label="Tester"
              value={`${data.tester.fullName} · License ${data.tester.licenseNumber}`}
            />
            <Row
              label="Certificate #"
              value={data.certificateNumber}
              mono
            />
          </Section>

          {!passed ? (
            <Text style={{ ...text, fontSize: 14 }}>
              The device did not pass this test. We'll follow up about next
              steps, or reply to this email with any questions.
            </Text>
          ) : null}

          <Text style={{ ...muted, fontSize: 12, marginTop: 24 }}>
            Questions? Reply to this email or call {data.company.phone ?? "us"}.
            {data.company.website ? (
              <>
                {" "}
                <Link href={data.company.website} style={{ color: "#2563eb" }}>
                  {data.company.website}
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <Text
      style={{
        ...text,
        fontSize: 13,
        margin: "4px 0",
      }}
    >
      <span style={{ color: "#6b7280" }}>{label}: </span>
      <span
        style={{
          fontWeight: bold ? 700 : 400,
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : undefined,
          color: valueColor ?? "#111827",
        }}
      >
        {value}
      </span>
    </Text>
  );
}

// Plain-text fallback. Identical info, no markup. Lots of mail clients
// (and corporate filters) prefer a present plain-text part — the Resend
// API accepts it alongside html.
export function certificateReadyPlainText(data: CertificateData): string {
  const passed = data.test.effectiveResult === "pass";
  const lines = [
    passed
      ? "Your backflow test certificate is attached."
      : "Your backflow test report (failed) is attached.",
    "",
    `From: ${data.company.name}`,
    `Device: ${data.device.serialNumber} · ${data.device.typeLabel}`,
    `Test date: ${data.test.date}`,
    `Result: ${passed ? "PASS" : "FAIL"}`,
    `Tester: ${data.tester.fullName} · License ${data.tester.licenseNumber}`,
    `Certificate #: ${data.certificateNumber}`,
  ];
  const loc = formatAddressLine(data.serviceLocation.address);
  if (loc) lines.splice(4, 0, `Location: ${loc}`);
  if (data.company.phone) {
    lines.push("", `Questions? Call ${data.company.phone}.`);
  }
  return lines.join("\n");
}
