export type ImmunizationStatus =
  | "Due"
  | "Given"
  | "Overdue"
  | "Not Given"
  | "Contraindicated"
  | "Refused"

export const TIMING_BUCKETS = [
  "At Birth",
  "6 Weeks",
  "10 Weeks",
  "14 Weeks",
  "6 Months",
  "7 Months",
  "8 Months",
  "9 Months",
  "1 Year",
  "1½ Years",
  "2 Years",
  "2½ Years",
  "3 Years",
  "3½ Years",
  "4 Years",
  "4½ Years",
  "5 Years",
  "Other Timing",
] as const

export type TimingBucket = (typeof TIMING_BUCKETS)[number]

export const VACCINES_BY_TIMING: Record<TimingBucket, string[]> = {
  "At Birth": ["BCG", "OPV 0", "Hepatitis B Birth Dose"],
  "6 Weeks": ["OPV 1", "Pentavalent 1", "PCV 1", "Rotavirus 1"],
  "10 Weeks": ["OPV 2", "Pentavalent 2", "PCV 2", "Rotavirus 2"],
  "14 Weeks": ["OPV 3", "Pentavalent 3", "PCV 3", "IPV 1"],
  "6 Months": ["Vitamin A (1st dose)", "Influenza"],
  "7 Months": [],
  "8 Months": [],
  "9 Months": ["Measles-Rubella 1", "Yellow Fever"],
  "1 Year": ["MMR", "Varicella"],
  "1½ Years": ["DPT Booster 1", "PCV Booster"],
  "2 Years": ["Typhoid", "Hepatitis A"],
  "2½ Years": ["Measles-Rubella 2", "OPV Booster"],
  "3 Years": ["Deworming", "Influenza"],
  "3½ Years": ["Influenza Booster"],
  "4 Years": ["DPT Booster 2", "MMR Booster"],
  "4½ Years": ["Polio Booster"],
  "5 Years": ["Td", "Catch-up Review"],
  "Other Timing": [],
}

export const DAYS_PER_BUCKET: Record<TimingBucket, number | null> = {
  "At Birth": 0,
  "6 Weeks": 42,
  "10 Weeks": 70,
  "14 Weeks": 98,
  "6 Months": 183,
  "7 Months": 213,
  "8 Months": 243,
  "9 Months": 274,
  "1 Year": 365,
  "1½ Years": 548,
  "2 Years": 730,
  "2½ Years": 913,
  "3 Years": 1095,
  "3½ Years": 1278,
  "4 Years": 1460,
  "4½ Years": 1643,
  "5 Years": 1825,
  "Other Timing": null,
}

export function isImmunizationStatus(value: string | undefined | null): value is ImmunizationStatus {
  return (
    value === "Due" ||
    value === "Given" ||
    value === "Overdue" ||
    value === "Not Given" ||
    value === "Contraindicated" ||
    value === "Refused"
  )
}

export function deriveStatus(
  explicitStatus?: string,
  dateAdministered?: string,
  nextDueDate?: string,
  today: string = new Date().toISOString().slice(0, 10),
): ImmunizationStatus {
  if (isImmunizationStatus(explicitStatus)) return explicitStatus
  if (dateAdministered) return "Given"
  if (nextDueDate && nextDueDate < today) return "Overdue"
  return "Due"
}

export function computeDueDateFromDob(dateOfBirth: string | null | undefined, ageTime: string | null | undefined): string | null {
  if (!dateOfBirth || !ageTime) return null
  if (!TIMING_BUCKETS.includes(ageTime as TimingBucket)) return null
  const offset = DAYS_PER_BUCKET[ageTime as TimingBucket]
  if (offset == null) return null
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`)
  if (Number.isNaN(dob.getTime())) return null
  dob.setUTCDate(dob.getUTCDate() + offset)
  return dob.toISOString().slice(0, 10)
}

export function computeDueDateFromDobWithOffset(
  dateOfBirth: string | null | undefined,
  dayOffset: number | null | undefined,
): string | null {
  if (!dateOfBirth || dayOffset == null) return null
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`)
  if (Number.isNaN(dob.getTime())) return null
  dob.setUTCDate(dob.getUTCDate() + dayOffset)
  return dob.toISOString().slice(0, 10)
}

export function computeOverdueDate(nextDueDate: string | null | undefined, graceDays = 0): string | null {
  if (!nextDueDate) return null
  const due = new Date(`${nextDueDate}T00:00:00.000Z`)
  if (Number.isNaN(due.getTime())) return null
  due.setUTCDate(due.getUTCDate() + Math.max(0, graceDays))
  return due.toISOString().slice(0, 10)
}
