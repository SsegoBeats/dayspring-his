/**
 * Single source of truth for department names used across reception:
 * check-in, queue board, and reception register/reports.
 * Update this list when adding or renaming departments.
 */
export const RECEPTION_DEPARTMENTS = [
  "General",
  "Dental",
  "Emergency",
  "Pediatrics",
  "Surgery",
  "Radiology",
  "Laboratory",
] as const

export type ReceptionDepartment = (typeof RECEPTION_DEPARTMENTS)[number]
