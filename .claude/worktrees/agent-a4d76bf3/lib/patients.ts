/**
 * Canonical Patient ID format: P#### (e.g. P0001, P0005).
 * Use this everywhere for display: receipts, exports, portals, reports.
 */
const PATIENT_ID_DIGITS = 4

export function formatPatientDigits(value?: string | null, digits = PATIENT_ID_DIGITS): string {
  const raw = (value || "").replace(/\D/g, "")
  if (!raw) return ""
  return raw.slice(-digits).padStart(digits, "0")
}

export function formatPatientNumber(value?: string | null, digits = PATIENT_ID_DIGITS): string {
  const digitsOnly = formatPatientDigits(value, digits)
  return digitsOnly ? `P${digitsOnly}` : value || "-"
}

/** Alias for display - ensures consistent Patient ID across the system */
export const formatPatientId = formatPatientNumber
