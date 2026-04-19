import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  formatAddressLine,
  type CertificateData,
  type CertificateReadings,
} from "./certificate-data";

// One Certificate component with type-aware readings branches. Shared
// scaffold (header, context, tester info, shutoffs, notes, signature)
// stays identical across all 5 device types; only the readings block
// differs. Parallels the TestForm's PerTypeReadings on purpose —
// maintaining parity stays a one-diff exercise.
//
// @react-pdf/renderer is DOM-free; only Document/Page/View/Text/Image
// are valid. StyleSheet.create gives us typed style objects.

const COLORS = {
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#2563eb",
  pass: "#059669",
  fail: "#dc2626",
  cardBg: "#f9fafb",
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: COLORS.text,
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 64, height: 44, objectFit: "contain" },
  companyName: { fontSize: 14, fontWeight: 700 },
  companyMeta: { color: COLORS.muted, fontSize: 8 },
  headerRight: { alignItems: "flex-end" },
  titleSmall: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  titleBig: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  certNumber: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 4,
    fontFamily: "Courier",
  },
  resultStamp: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  resultPass: { borderColor: COLORS.pass, color: COLORS.pass },
  resultFail: { borderColor: COLORS.fail, color: COLORS.fail },
  afterRetest: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 3,
    textTransform: "none",
  },

  // Row of up-to-three info cards; used for customer / location / device
  infoRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    backgroundColor: COLORS.cardBg,
  },
  cardLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  cardTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  cardLine: { fontSize: 8 },
  cardLineMuted: { fontSize: 8, color: COLORS.muted },

  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: COLORS.muted,
    marginBottom: 6,
    marginTop: 6,
  },
  readingsBlock: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  readingsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  readingBox: {
    flexGrow: 1,
    flexBasis: "30%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    padding: 6,
  },
  readingLabel: { fontSize: 7, color: COLORS.muted },
  readingValue: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  readingUnit: { fontSize: 7, color: COLORS.muted },
  inspectionBlock: {
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    marginBottom: 12,
    backgroundColor: COLORS.cardBg,
    fontSize: 8.5,
    color: COLORS.muted,
  },

  kvRow: { flexDirection: "row", gap: 12, marginBottom: 6 },
  kv: { flexGrow: 1, flexBasis: "25%" },
  kvLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase" },
  kvValue: { fontSize: 9, marginTop: 1 },
  kvValueMono: {
    fontSize: 9,
    marginTop: 1,
    fontFamily: "Courier",
  },

  retestCard: {
    marginTop: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.fail,
    borderRadius: 4,
    backgroundColor: "#fef2f2",
    marginBottom: 12,
  },
  retestCardPass: {
    borderColor: COLORS.pass,
    backgroundColor: "#f0fdf4",
  },
  retestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  retestTitle: { fontSize: 10, fontWeight: 700 },
  retestResult: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  retestReadings: { marginTop: 6 },

  notesBlock: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    minHeight: 32,
  },
  notesText: { fontSize: 8.5 },

  signatureRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  sigBox: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: COLORS.text,
    paddingTop: 4,
  },
  sigLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
  },
  sigName: { fontSize: 9, marginTop: 2 },
  sigMeta: { fontSize: 7, color: COLORS.muted, marginTop: 2 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
  },
});

export type CertificateProps = {
  data: CertificateData;
  // Pre-fetched logo as a data URL ("data:image/png;base64,...") or an
  // http(s) URL. When undefined the header shows text only.
  logoSrc?: string;
};

export function Certificate({ data, logoSrc }: CertificateProps) {
  const effectivePass = data.test.effectiveResult === "pass";

  return (
    <Document
      title={`Backflow Test Certificate — ${data.device.serialNumber}`}
      author={data.company.name}
      subject="Backflow Prevention Assembly Test Report"
    >
      <Page size="LETTER" style={styles.page} wrap>
        <Header data={data} logoSrc={logoSrc} effectivePass={effectivePass} />

        <InfoCards data={data} />

        <TestMetaRow data={data} />

        <View style={styles.readingsBlock} wrap={false}>
          <Text style={styles.sectionTitle}>
            {data.retest ? "Initial test readings" : "Test readings"}
          </Text>
          <ReadingsBlock readings={data.readings} />
        </View>

        <ShutoffRow data={data} />

        {data.retest ? <RetestCard retest={data.retest} /> : null}

        <Text style={styles.sectionTitle}>Notes</Text>
        <View style={styles.notesBlock}>
          <Text style={styles.notesText}>
            {data.test.notes?.trim() || "—"}
          </Text>
        </View>

        <SignatureRow data={data} />

        {data.company.pdfFooter ? (
          <Text style={styles.footer} fixed>
            {data.company.pdfFooter}
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}

function Header({
  data,
  logoSrc,
  effectivePass,
}: {
  data: CertificateData;
  logoSrc?: string;
  effectivePass: boolean;
}) {
  const companyAddr = formatAddressLine(data.company.address);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
        <View>
          <Text style={styles.companyName}>{data.company.name}</Text>
          {companyAddr ? (
            <Text style={styles.companyMeta}>{companyAddr}</Text>
          ) : null}
          {data.company.phone || data.company.website ? (
            <Text style={styles.companyMeta}>
              {[data.company.phone, data.company.website]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.headerRight}>
        <Text style={styles.titleSmall}>Certificate</Text>
        <Text style={styles.titleBig}>Backflow Test Report</Text>
        <Text style={styles.certNumber}>#{data.certificateNumber}</Text>
        <View
          style={[
            styles.resultStamp,
            effectivePass ? styles.resultPass : styles.resultFail,
          ]}
        >
          <Text>{effectivePass ? "PASS" : "FAIL"}</Text>
        </View>
        {data.retest ? (
          <Text style={styles.afterRetest}>
            (after retest — initial result {data.test.result})
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function InfoCards({ data }: { data: CertificateData }) {
  const locAddr = formatAddressLine(data.serviceLocation.address);
  const billAddr = formatAddressLine(data.customer.billingAddress);
  return (
    <View style={styles.infoRow}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Customer</Text>
        <Text style={styles.cardTitle}>{data.customer.displayName}</Text>
        {data.customer.phone ? (
          <Text style={styles.cardLine}>{data.customer.phone}</Text>
        ) : null}
        {data.customer.email ? (
          <Text style={styles.cardLine}>{data.customer.email}</Text>
        ) : null}
        {billAddr ? <Text style={styles.cardLineMuted}>{billAddr}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Service location</Text>
        {data.serviceLocation.nickname ? (
          <Text style={styles.cardTitle}>
            {data.serviceLocation.nickname}
          </Text>
        ) : null}
        {locAddr ? <Text style={styles.cardLine}>{locAddr}</Text> : null}
        {data.serviceLocation.onSiteContactName ? (
          <Text style={styles.cardLineMuted}>
            Contact: {data.serviceLocation.onSiteContactName}
            {data.serviceLocation.onSiteContactPhone
              ? ` · ${data.serviceLocation.onSiteContactPhone}`
              : ""}
          </Text>
        ) : null}
        {data.serviceLocation.waterDistrict ? (
          <Text style={styles.cardLineMuted}>
            {data.serviceLocation.waterDistrict}
          </Text>
        ) : null}
        {data.serviceLocation.hazardType ? (
          <Text style={styles.cardLineMuted}>
            Hazard: {data.serviceLocation.hazardType}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Device</Text>
        <Text style={styles.cardTitle}>{data.device.serialNumber}</Text>
        <Text style={styles.cardLine}>{data.device.typeLabel}</Text>
        <Text style={styles.cardLineMuted}>
          {data.device.manufacturer} {data.device.model} · {data.device.size}
        </Text>
        <Text style={styles.cardLineMuted}>
          {data.device.locationDescription}
        </Text>
        {data.device.installDate ? (
          <Text style={styles.cardLineMuted}>
            Installed {data.device.installDate}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TestMetaRow({ data }: { data: CertificateData }) {
  return (
    <View style={styles.kvRow}>
      <KV label="Test date" value={data.test.date} />
      <KV
        label="Water supply pressure"
        value={fmtPsi(data.test.waterSupplyPressure)}
      />
      <KV label="Gauge serial" value={data.gauge.serial} mono />
      <KV
        label="Gauge calibrated"
        value={data.gauge.calibrationDate ?? "—"}
      />
    </View>
  );
}

function ShutoffRow({ data }: { data: CertificateData }) {
  return (
    <View style={styles.kvRow}>
      <KV
        label="Shutoff valve #1"
        value={data.shutoffs.sv1Condition ?? "—"}
      />
      <KV
        label="Shutoff valve #2"
        value={data.shutoffs.sv2Condition ?? "—"}
      />
    </View>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={mono ? styles.kvValueMono : styles.kvValue}>{value}</Text>
    </View>
  );
}

function ReadingsBlock({ readings }: { readings: CertificateReadings }) {
  if (readings.kind === "avb") {
    return (
      <View style={styles.inspectionBlock}>
        <Text>
          Atmospheric Vacuum Breaker — inspection only. No PSID readings
          required. Result recorded based on visual inspection and shutoff
          condition.
        </Text>
      </View>
    );
  }

  if (readings.kind === "rp") {
    return (
      <View style={styles.readingsGrid}>
        <Reading label="Check valve #1" value={fmtPsi(readings.check_valve_1_psid)} unit="PSID" />
        <Reading label="Check valve #2" value={fmtPsi(readings.check_valve_2_psid)} unit="PSID" />
        <Reading label="Relief valve opening" value={fmtPsi(readings.relief_valve_opening)} unit="PSID" />
      </View>
    );
  }

  if (readings.kind === "dc") {
    return (
      <View style={styles.readingsGrid}>
        <Reading label="Check valve #1" value={fmtPsi(readings.check_valve_1_psid)} unit="PSID" />
        <Reading label="Check valve #2" value={fmtPsi(readings.check_valve_2_psid)} unit="PSID" />
      </View>
    );
  }

  // pvb_svb
  return (
    <View style={styles.readingsGrid}>
      <Reading label="Check valve" value={fmtPsi(readings.check_valve_psid)} unit="PSID" />
      <Reading label="Air inlet opening" value={fmtPsi(readings.air_inlet_opening)} unit="PSID" />
    </View>
  );
}

function Reading({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  // Empty readings render as "—" with no trailing unit label — otherwise
  // the "PSID" underneath a lone em-dash reads like a stray metadata
  // line rather than a missing value.
  const hasValue = value !== "—";
  return (
    <View style={styles.readingBox}>
      <Text style={styles.readingLabel}>{label}</Text>
      <Text style={styles.readingValue}>{value}</Text>
      {hasValue ? <Text style={styles.readingUnit}>{unit}</Text> : null}
    </View>
  );
}

function RetestCard({
  retest,
}: {
  retest: NonNullable<CertificateData["retest"]>;
}) {
  const passed = retest.result === "pass";
  return (
    <View
      style={passed ? [styles.retestCard, styles.retestCardPass] : styles.retestCard}
      wrap={false}
    >
      <View style={styles.retestHeader}>
        <Text style={styles.retestTitle}>Retest</Text>
        <View
          style={[
            styles.retestResult,
            passed ? styles.resultPass : styles.resultFail,
          ]}
        >
          <Text>{passed ? "Retested — pass" : "Retested — fail"}</Text>
        </View>
      </View>

      <View style={styles.kvRow}>
        <KV label="Retest date" value={retest.date ?? "—"} />
      </View>

      {retest.repairs ? (
        <>
          <Text style={styles.kvLabel}>Repairs made</Text>
          <Text style={styles.notesText}>{retest.repairs}</Text>
        </>
      ) : null}

      {retest.readings.kind !== "avb" ? (
        <View style={styles.retestReadings}>
          <Text style={styles.kvLabel}>Retest readings</Text>
          <View style={styles.readingsGrid}>
            <ReadingsBlock readings={retest.readings} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SignatureRow({ data }: { data: CertificateData }) {
  return (
    <View style={styles.signatureRow}>
      <View style={styles.sigBox}>
        <Text style={styles.sigLabel}>Certified tester</Text>
        <Text style={styles.sigName}>{data.tester.fullName}</Text>
        <Text style={styles.sigMeta}>
          License {data.tester.licenseNumber}
          {data.tester.licenseIssuingAuthority
            ? ` · ${data.tester.licenseIssuingAuthority}`
            : ""}
        </Text>
        <Text style={styles.sigMeta}>
          Expires {data.tester.licenseExpiration}
        </Text>
      </View>
      <View style={styles.sigBox}>
        <Text style={styles.sigLabel}>Customer signature</Text>
        <Text style={styles.sigName}> </Text>
        <Text style={styles.sigMeta}>Date</Text>
      </View>
    </View>
  );
}

// Format numeric PSID — 1 decimal when present, "—" when null. Matches
// how testers describe readings in the field.
function fmtPsi(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(1);
}
