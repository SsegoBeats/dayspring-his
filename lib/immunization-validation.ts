import type { ImmunizationStatus } from "@/lib/immunization-schedule"

export function alignStatusWithDueDate(
  status: ImmunizationStatus,
  nextDueDate?: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): ImmunizationStatus {
  if (status !== "Due" && status !== "Overdue") return status
  if (!nextDueDate) return "Due"
  return nextDueDate < today ? "Overdue" : "Due"
}

export function validateStatusRules(
  status: ImmunizationStatus,
  dates: {
    dateAdministered?: string
    nextDueDate?: string | null
    overdueDate?: string | null
  },
  reason: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): string | null {
  if (status === "Given" && !dates.dateAdministered) return "dateAdministered is required when status is Given"
  if (status === "Given" && dates.dateAdministered && dates.dateAdministered > today) {
    return "dateAdministered cannot be in the future"
  }
  if ((status === "Contraindicated" || status === "Refused" || status === "Not Given") && !reason) {
    return `A reason is required when status is ${status}`
  }
  if (status === "Overdue" && (!dates.nextDueDate || dates.nextDueDate >= today)) {
    return "Overdue status requires a nextDueDate earlier than today"
  }
  if (status === "Due" && dates.nextDueDate && dates.nextDueDate < today) {
    return "Due status cannot have a nextDueDate earlier than today"
  }
  if (dates.nextDueDate && dates.overdueDate && dates.overdueDate < dates.nextDueDate) {
    return "overdueDate cannot be earlier than nextDueDate"
  }
  if (dates.dateAdministered && dates.nextDueDate && dates.nextDueDate < dates.dateAdministered) {
    return "nextDueDate cannot be earlier than dateAdministered"
  }
  return null
}

export function validateOtherVaccineReason(isOtherVaccine: boolean | undefined, reason: string | null | undefined): string | null {
  if (isOtherVaccine === true && !String(reason || "").trim()) {
    return "otherVaccineReason is required when isOtherVaccine is true"
  }
  return null
}
