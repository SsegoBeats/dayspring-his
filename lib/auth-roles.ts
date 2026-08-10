export const VALID_ROLE_VALUES = [
  "Receptionist",
  "Clinician",
  "Radiologist",
  "Nurse",
  "Lab Tech",
  "Hospital Admin",
  "Cashier",
  "Pharmacist",
  "Midwife",
  "Dentist",
] as const

export type SupportedRole = (typeof VALID_ROLE_VALUES)[number]

export const ROLE_OPTIONS: Array<{ value: SupportedRole; label: string }> = [
  { value: "Receptionist", label: "Receptionist" },
  { value: "Clinician", label: "Clinician" },
  { value: "Midwife", label: "Midwife" },
  { value: "Dentist", label: "Dentist" },
  { value: "Radiologist", label: "Radiologist" },
  { value: "Nurse", label: "Nurse" },
  { value: "Lab Tech", label: "Lab Technician" },
  { value: "Hospital Admin", label: "Hospital Admin" },
  { value: "Cashier", label: "Cashier" },
  { value: "Pharmacist", label: "Pharmacist" },
]

export function isSupportedRole(role: string | null | undefined): role is SupportedRole {
  return typeof role === "string" && VALID_ROLE_VALUES.includes(role as SupportedRole)
}

export function normalizeRole(role: string | null | undefined): SupportedRole | null {
  if (!role) return null
  const trimmed = role.trim()
  return isSupportedRole(trimmed) ? trimmed : null
}
