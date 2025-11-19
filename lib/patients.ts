export function formatPatientDigits(value?: string | null, digits = 4): string {
  const raw = (value || "").replace(/\D/g, "")
  if (!raw) return ""
  return raw.slice(-digits).padStart(digits, "0")
}

export function formatPatientNumber(value?: string | null, digits = 4): string {
  const digitsOnly = formatPatientDigits(value, digits)
  return digitsOnly ? `P${digitsOnly}` : value || "-"
}
