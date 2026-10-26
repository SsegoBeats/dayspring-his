export function matchesFacilityScope(userFacilityId?: string | null, patientFacilityId?: string | null) {
  if (!userFacilityId) return true
  if (!patientFacilityId) return false
  return String(patientFacilityId) === String(userFacilityId)
}

export function canUpdateImmunizationRecord(
  auth: { id: string; role: string },
  recordedBy: string | null | undefined,
  userFacilityId?: string | null,
  patientFacilityId?: string | null,
  isAdminOverride = false,
) {
  if (isAdminOverride || auth.role === "Hospital Admin") return true
  if (!matchesFacilityScope(userFacilityId, patientFacilityId)) return false
  if (recordedBy && recordedBy !== auth.id) return false
  return true
}
