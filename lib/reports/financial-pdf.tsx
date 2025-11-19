// This file defines the PDF document for the Financial Report using React-PDF.
// It is imported by the API route and should not use browser-only APIs.

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import type { FinancialReportPayload } from "@/types/financial"

// Fonts are registered by the API route when available; we select at runtime

function formatUGX(value: number): string {
  try {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(value)
  } catch {
    return `USh ${Math.round(value).toLocaleString("en-UG")}`
  }
}

export function FinancialReportPdf({ payload }: { payload: FinancialReportPayload & { __useInter?: boolean; logoDataUrl?: string; logoBuffer?: Buffer } }) {
  const { hospitalName, periodLabel, generatedAtISO, logoUrl, logoDataUrl, logoBuffer, generatedBy, data, __useInter } = payload as any

  const baseFont = __useInter ? "Inter" : "Helvetica"

  const styles = StyleSheet.create({
    page: { position: "relative", paddingTop: 40, paddingBottom: 36, paddingHorizontal: 40, fontFamily: baseFont },
    header: { display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 },
    watermarkWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, alignItems: "center", justifyContent: "center" },
    // 20.93cm x 15.66cm converted to points (1cm ≈ 28.3465pt): ≈ 593pt x 445pt
    watermarkImg: { width: 593, height: 445, objectFit: "contain", opacity: 0.05 },
    brand: { display: "flex", flexDirection: "row", alignItems: "center", flexGrow: 1, flexShrink: 1, marginRight: 16 },
    // Larger logo in header for better visibility
    titleLogo: { width: 64, height: 64, objectFit: "contain", marginRight: 10 },
    logo: { width: 80, height: 80, objectFit: "contain", marginRight: 12, borderColor: "#d1d5db", borderWidth: 1 },
    titleWrap: { display: "flex", flexDirection: "column", maxWidth: 400, flexShrink: 1 },
    title: { fontSize: 18, fontWeight: 700, color: "#0ea5e9", lineHeight: 1.2 },
    subtitle: { fontSize: 10, color: "#64748b", marginTop: 2 },
    metaBox: { minWidth: 170, maxWidth: 220, alignItems: "flex-end", flexShrink: 0 },
    meta: { fontSize: 9, color: "#374151", textAlign: "right", lineHeight: 1.4 },
    sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 12, color: "#0ea5e9" },
    kpiRow: { display: "flex", flexDirection: "row" },
    kpiCard: { flexGrow: 1, border: "1px solid #e5e7eb", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
    kpiLabel: { fontSize: 9, color: "#6b7280" },
    kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 3, color: "#0f766e" },
    table: { width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", marginTop: 10 },
    tr: { display: "flex", flexDirection: "row" },
    th: { flex: 1, backgroundColor: "#f9fafb", paddingVertical: 9, paddingHorizontal: 8, fontSize: 9, fontWeight: 700, borderRight: "1px solid #e5e7eb" },
    td: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 9, borderTop: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" },
    footnote: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#6b7280", display: "flex", flexDirection: "row", justifyContent: "space-between" },
  })

  const hasLogo = Boolean(logoDataUrl || logoUrl)
  // Split hospital name so text after a hyphen becomes a second line
  const [mainTitle, secondaryTitle] = String(hospitalName || "").split(" - ") as [string, string?]

  return (
    <Document title={`Financial Report - ${hospitalName}`} author={generatedBy || hospitalName} subject="Financial Report" creator={generatedBy || hospitalName} producer="React-PDF">
      <Page size="A4" style={styles.page} wrap>
        {hasLogo && (
          <View style={styles.watermarkWrap} fixed>
            {logoDataUrl ? (
              <Image src={logoDataUrl as string} style={styles.watermarkImg} />
            ) : (
              <Image src={logoUrl as string} style={styles.watermarkImg} />
            )}
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.brand}>
            {hasLogo && (
              logoDataUrl ? (
                <Image src={logoDataUrl as string} style={styles.titleLogo} />
              ) : (
                <Image src={logoUrl as string} style={styles.titleLogo} />
              )
            )}
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{mainTitle || hospitalName}</Text>
              {secondaryTitle ? <Text style={styles.title}>{secondaryTitle}</Text> : null}
              <Text style={styles.subtitle}>Financial Reports & Analytics</Text>
            </View>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.meta}>Period: {periodLabel}</Text>
            <Text style={styles.meta}>Generated: {new Date(generatedAtISO).toLocaleString("en-GB")}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Revenue</Text>
            <Text style={styles.kpiValue}>{formatUGX(data.summary.totalRevenue)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Outstanding Balance</Text>
            <Text style={styles.kpiValue}>{formatUGX(data.summary.outstandingBalance)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Transaction</Text>
            <Text style={styles.kpiValue}>{formatUGX(data.summary.avgTransactionValue)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Active Methods</Text>
            <Text style={styles.kpiValue}>{data.summary.activePaymentMethods}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Revenue by Department</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Department</Text>
            <Text style={styles.th}>Revenue</Text>
            <Text style={styles.th}>Transactions</Text>
          </View>
          {data.revenueByDepartment.map((row, idx) => (
            <View style={styles.tr} key={`dept-${idx}`} wrap={false}>
              <Text style={styles.td}>{row.department}</Text>
              <Text style={styles.td}>{formatUGX(row.revenue)}</Text>
              <Text style={styles.td}>{row.transactions}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Payment Methods</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Method</Text>
            <Text style={styles.th}>Revenue</Text>
            <Text style={styles.th}>Transactions</Text>
          </View>
          {data.revenueByPaymentMethod.map((row, idx) => (
            <View style={styles.tr} key={`pm-${idx}`} wrap={false}>
              <Text style={styles.td}>{row.paymentMethod}</Text>
              <Text style={styles.td}>{formatUGX(row.revenue)}</Text>
              <Text style={styles.td}>{row.transactions}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Top Services</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Service</Text>
            <Text style={styles.th}>Revenue</Text>
            <Text style={styles.th}>Count</Text>
          </View>
          {data.topServices.map((row, idx) => (
            <View style={styles.tr} key={`svc-${idx}`} wrap={false}>
              <Text style={styles.td}>{row.service}</Text>
              <Text style={styles.td}>{formatUGX(row.revenue)}</Text>
              <Text style={styles.td}>{row.count}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Patient Visits</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Date</Text>
            <Text style={styles.th}>Visits</Text>
          </View>
          {data.patientVisits.map((row, idx) => (
            <View style={styles.tr} key={`pv-${idx}`} wrap={false}>
              <Text style={styles.td}>{row.date}</Text>
              <Text style={styles.td}>{row.visits}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footnote} fixed>
          <Text>Generated by {generatedBy || hospitalName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}


