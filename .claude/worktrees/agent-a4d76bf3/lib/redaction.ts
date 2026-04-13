export type RedactionProfile = "default" | "billing" | "clinical" | "minimal"

export function redactRow<T extends Record<string, any>>(row: T, profile: RedactionProfile): T {
  const clone: any = { ...row }
  if (profile === "default") {
    if (clone.dob) clone.dob = String(clone.dob).slice(0, 4)
    if (clone.address) delete clone.address
    if (clone.notes) delete clone.notes
  }
  if (profile === "billing") {
    if (clone.notes) delete clone.notes
  }
  return clone
}


