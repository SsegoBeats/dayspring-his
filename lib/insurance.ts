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

export const INSURANCE_PAYER_TYPES = [
  "INSURER",
  "HMO",
  "CORPORATE",
  "GOVERNMENT",
  "BROKER",
] as const

export const INSURANCE_PANEL_STATUSES = [
  "Unknown",
  "Confirmed",
  "Limited Panel",
  "Out of Panel",
] as const

export const INSURANCE_PREAUTH_STATUSES = [
  "Pending",
  "Approved",
  "Denied",
  "Expired",
] as const

export const INSURANCE_PREAUTH_SERVICE_CATEGORIES = [
  "Consultation",
  "Admission",
  "Maternity",
  "Surgery",
  "Imaging",
  "Laboratory",
  "Dental",
  "Optical",
  "Drugs",
  "Physiotherapy",
  "Other",
] as const

export const PATIENT_DOCUMENT_TYPES = [
  "ID",
  "INSURANCE",
  "GUARANTEE",
  "REFERRAL",
  "PREAUTH",
  "CLAIM_FORM",
  "CONSENT",
  "OTHER",
] as const

export type InsuranceSubscriberRelationship = (typeof INSURANCE_SUBSCRIBER_RELATIONSHIPS)[number]
export type InsuranceVerificationStatus = (typeof INSURANCE_VERIFICATION_STATUSES)[number]
export type InsurancePayerType = (typeof INSURANCE_PAYER_TYPES)[number]
export type InsurancePanelStatus = (typeof INSURANCE_PANEL_STATUSES)[number]
export type InsurancePreauthorizationStatus = (typeof INSURANCE_PREAUTH_STATUSES)[number]
export type InsurancePreauthorizationServiceCategory = (typeof INSURANCE_PREAUTH_SERVICE_CATEGORIES)[number]
export type PatientDocumentType = (typeof PATIENT_DOCUMENT_TYPES)[number]

export type UgandanInsurancePayerSeed = {
  name: string
  payerCode: string
  payerType: InsurancePayerType
  requiresPreauthDefault: boolean
  schemeStampRequired: boolean
  panelDriven: boolean
  notes: string
}

export const UGANDA_INSURANCE_PAYER_SEED: UgandanInsurancePayerSeed[] = [
  {
    name: "AAR Health Services (U) Limited",
    payerCode: "AAR-UG",
    payerType: "HMO",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "Licensed HMO-style medical cover. Confirm member eligibility, provider panel status, and pre-authorization for admission, maternity, scans, and specialist care.",
  },
  {
    name: "APA Insurance (Uganda) Limited",
    payerCode: "APA-UG",
    payerType: "INSURER",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "Supports reimbursement claims. Capture scheme name, member details, and front-desk verification trace.",
  },
  {
    name: "Jubilee Health Insurance Company of Uganda Limited",
    payerCode: "JHIC-UG",
    payerType: "INSURER",
    requiresPreauthDefault: true,
    schemeStampRequired: true,
    panelDriven: true,
    notes: "Corporate and retail health cover. Reimbursement often requires employer or scheme endorsement and supporting documents.",
  },
  {
    name: "Case Med Insurance Limited",
    payerCode: "CASEMED-UG",
    payerType: "HMO",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "HMO workflow. Front desk should confirm card validity, active benefits, referral rules, and service entitlement before the patient advances.",
  },
  {
    name: "International Air Ambulance (IAA) Limited",
    payerCode: "IAA-UG",
    payerType: "HMO",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "Managed-care cover. Verify panel access, referral requirements, and any authorization instructions before treatment.",
  },
  {
    name: "International Medical Link (IML) Limited",
    payerCode: "IML-UG",
    payerType: "HMO",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "Health membership organisation. Confirm panel access and referral requirements before sending the patient onward.",
  },
  {
    name: "St. Catherine's Medcare Limited",
    payerCode: "SCM-UG",
    payerType: "HMO",
    requiresPreauthDefault: true,
    schemeStampRequired: false,
    panelDriven: true,
    notes: "Panel-style medical management. Check member card, authorization status, and any referral instruction.",
  },
  {
    name: "Corporate / Employer Guarantee",
    payerCode: "CORP-GUAR",
    payerType: "CORPORATE",
    requiresPreauthDefault: false,
    schemeStampRequired: true,
    panelDriven: false,
    notes: "Use for employer guarantees, school schemes, NGO commitments, and other non-insurer sponsor letters.",
  },
  {
    name: "Government / Public Scheme",
    payerCode: "GOV-SCHEME",
    payerType: "GOVERNMENT",
    requiresPreauthDefault: false,
    schemeStampRequired: false,
    panelDriven: false,
    notes: "Use only when the visit is being covered by a government or public-sector arrangement approved by the facility.",
  },
]

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
      return "Insurance / membership card"
    case "GUARANTEE":
      return "Guarantee letter"
    case "REFERRAL":
      return "Referral letter"
    case "PREAUTH":
      return "Pre-authorization letter"
    case "CLAIM_FORM":
      return "Claim / reimbursement form"
    case "CONSENT":
      return "Consent"
    case "OTHER":
    default:
      return "Other document"
  }
}

export function getPatientDocumentTypeDescription(type: PatientDocumentType) {
  switch (type) {
    case "ID":
      return "National ID, passport, work ID, or other identity document used to confirm the patient or principal member."
    case "INSURANCE":
      return "Insurance card, e-card screenshot, or membership letter showing the payer, card number, and member details."
    case "GUARANTEE":
      return "Employer, school, NGO, or sponsor letter confirming the facility should bill the organisation."
    case "REFERRAL":
      return "Referral note from another provider or network gatekeeper when the payer requires formal referral before treatment."
    case "PREAUTH":
      return "Approval letter, email, portal printout, or authorization note issued after pre-authorization is granted."
    case "CLAIM_FORM":
      return "Completed reimbursement or provider claim form that billing will use when submitting to the payer."
    case "CONSENT":
      return "Signed patient consent or financial undertaking related to treatment, billing, or insurer communication."
    case "OTHER":
    default:
      return "Any supporting insurance document that does not fit the main categories."
  }
}

export function getInsurancePayerTypeLabel(type: InsurancePayerType) {
  switch (type) {
    case "INSURER":
      return "Insurer"
    case "HMO":
      return "HMO"
    case "CORPORATE":
      return "Corporate guarantor"
    case "GOVERNMENT":
      return "Government scheme"
    case "BROKER":
      return "Broker / intermediary"
    default:
      return type
  }
}

export function getInsurancePayerTypeDescription(type: InsurancePayerType) {
  switch (type) {
    case "INSURER":
      return "Licensed insurance company offering medical cover. Reception usually verifies card details, scheme eligibility, and pre-authorization rules."
    case "HMO":
      return "Health membership organisation. Panel confirmation, referral rules, and benefit restrictions should be checked before service."
    case "CORPORATE":
      return "Employer, school, NGO, or other institution guaranteeing payment. A signed guarantee letter is normally required."
    case "GOVERNMENT":
      return "Government or public-sector arrangement approved for this patient. Record the scheme clearly and keep supporting paperwork."
    case "BROKER":
      return "Intermediary managing cover on behalf of another payer. Capture the underlying insurer or sponsor in notes where possible."
    default:
      return "Insurance payer classification."
  }
}

export function getSubscriberRelationshipLabel(relationship: InsuranceSubscriberRelationship) {
  if (relationship === "Self") return "Principal member (self)"
  return relationship
}

export function getVerificationStatusDescription(status: InsuranceVerificationStatus) {
  switch (status) {
    case "Verified":
      return "Front desk has confirmed cover using a card check, portal, email, call log, or official payer response."
    case "Pending":
      return "Verification has been started but the payer or sponsor has not given a final answer yet."
    case "Rejected":
      return "The payer or sponsor declined cover for the patient, service, or visit."
    case "Expired":
      return "The card or policy is past its valid date or the sponsor has indicated the cover is no longer active."
    case "Unverified":
    default:
      return "No formal eligibility check has been recorded yet."
  }
}

export function getPanelStatusDescription(status: InsurancePanelStatus) {
  switch (status) {
    case "Confirmed":
      return "The facility or service has been confirmed as part of the payer's active provider panel for this member."
    case "Limited Panel":
      return "The payer allows some services or departments here, but not the entire visit scope."
    case "Out of Panel":
      return "The payer does not recognise the facility or requested service under the current member rules."
    case "Unknown":
    default:
      return "Panel status has not yet been checked with the payer or sponsor."
  }
}

export function getPreauthorizationStatusDescription(status: InsurancePreauthorizationStatus) {
  switch (status) {
    case "Approved":
      return "The payer or sponsor approved the service. Record the authorization code and expiry if provided."
    case "Denied":
      return "The payer or sponsor declined the request. Billing or clinical teams should review the alternative payment path."
    case "Expired":
      return "An earlier approval is no longer valid for the current visit or date."
    case "Pending":
    default:
      return "The request has been lodged and is awaiting a decision from the payer or sponsor."
  }
}

export function getPreauthorizationServiceDescription(category: InsurancePreauthorizationServiceCategory) {
  switch (category) {
    case "Admission":
      return "Use when the patient needs admission, bed approval, or inpatient continuation."
    case "Maternity":
      return "Use for antenatal package approval, delivery, theatre, or maternity admission clearance."
    case "Surgery":
      return "Use for procedures, theatre cases, and surgeon-approved interventions."
    case "Imaging":
      return "Use for scans such as CT, MRI, or ultrasound when the payer requires approval before imaging."
    case "Laboratory":
      return "Use for specialist or high-cost laboratory requests that need payer confirmation."
    case "Dental":
      return "Use for dental work when the payer restricts eligibility or benefit limits."
    case "Optical":
      return "Use for optical benefits such as lenses, frames, or ophthalmic services."
    case "Drugs":
      return "Use for high-cost medicines or non-routine pharmacy cover that needs approval."
    case "Physiotherapy":
      return "Use for rehab sessions, therapy packages, or continuation approvals."
    case "Consultation":
      return "Use when the outpatient consultation itself requires approval or network confirmation."
    case "Other":
    default:
      return "Use for any service that does not fit the standard pre-authorization categories."
  }
}
