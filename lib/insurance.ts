export const INSURANCE_SUBSCRIBER_RELATIONSHIPS = [
  "Self",
  "Spouse",
  "Child",
  "Parent",
  "Guardian",
  "Other",
] as const

export const INSURANCE_VERIFICATION_STATUSES = [
  "Unverified",
  "Verified",
  "Pending",
  "Rejected",
  "Expired",
] as const

export const PATIENT_DOCUMENT_TYPES = ["ID", "INSURANCE", "CONSENT", "OTHER"] as const

export type InsuranceSubscriberRelationship = (typeof INSURANCE_SUBSCRIBER_RELATIONSHIPS)[number]
export type InsuranceVerificationStatus = (typeof INSURANCE_VERIFICATION_STATUSES)[number]
export type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number]

export function formatCoverageOrder(order?: number | null) {
  switch (order) {
    case 1:
      return "Primary"
    case 2:
      return "Secondary"
    case 3:
      return "Tertiary"
    case 4:
      return "Quaternary"
    default:
      return order ? `${order}th` : "Primary"
  }
}

export function getPatientDocumentTypeLabel(type: PatientDocumentType) {
  switch (type) {
    case "ID":
      return "Identification"
    case "INSURANCE":
      return "Insurance card"
    case "CONSENT":
      return "Consent"
    case "OTHER":
    default:
      return "Other document"
  }
}
