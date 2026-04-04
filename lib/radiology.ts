import type { LabTest } from "@/lib/lab-context"

export const RADIOLOGY_MODALITIES = [
  "x-ray",
  "ct scan",
  "ct",
  "mri",
  "ultrasound",
  "mammography",
  "fluoroscopy",
  "nuclear medicine",
  "pet scan",
  "pet-ct",
  "dexa",
  "angiography",
] as const

export type RadiologyStatus = "pending" | "in-progress" | "completed" | "cancelled"
export type RadiologyPriority = "routine" | "urgent" | "stat"

export type RadiologyStructuredTemplate = {
  modality: "X-Ray" | "CT Scan" | "MRI" | "Ultrasound" | "Mammography" | "Fluoroscopy" | "Nuclear Medicine" | "PET Scan" | "Angiography"
  description: string
  sectionOrder: string[]
  requiredSections: string[]
  quickPhrases: string[]
}

export const RADIOLOGY_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "application/dicom",
  "application/dicom+json",
  "application/zip",
  "application/x-zip-compressed",
] as const

export const RADIOLOGY_UPLOAD_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".pdf",
  ".dcm",
  ".dicom",
  ".zip",
] as const

const STRUCTURED_REPORT_TEMPLATES: Record<RadiologyStructuredTemplate["modality"], RadiologyStructuredTemplate> = {
  Fluoroscopy: {
    modality: "Fluoroscopy",
    description: "Fluoroscopy reporting with procedure description, fluoroscopy time, and findings.",
    sectionOrder: ["Clinical Indication", "Procedure", "Fluoroscopy Time", "Contrast Used", "Findings", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Procedure", "Findings", "Impression"],
    quickPhrases: [
      "Procedure performed without immediate complication.",
      "Contrast medium administered without adverse reaction.",
      "Dynamic assessment demonstrates normal mucosal pattern throughout.",
    ],
  },
  "Nuclear Medicine": {
    modality: "Nuclear Medicine",
    description: "Nuclear medicine scan reporting with radiopharmaceutical details, acquisition, and findings.",
    sectionOrder: ["Clinical Indication", "Radiopharmaceutical", "Technique", "Findings", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Radiopharmaceutical", "Findings", "Impression"],
    quickPhrases: [
      "No abnormal tracer uptake identified on this examination.",
      "Uniform physiological tracer distribution without focal photopenic defect.",
      "No evidence of scintigraphic metastatic disease within the scanned region.",
    ],
  },
  "PET Scan": {
    modality: "PET Scan",
    description: "PET/PET-CT reporting with SUV values, metabolic activity, and staging assessment.",
    sectionOrder: ["Clinical Indication", "Technique", "Comparison", "Findings", "SUV Measurements", "Impression", "Staging", "Recommendations"],
    requiredSections: ["Clinical Indication", "Technique", "Findings", "Impression", "Staging"],
    quickPhrases: [
      "No FDG-avid lesion identified to suggest active malignancy.",
      "Physiological FDG distribution without pathological hypermetabolic focus.",
      "No new FDG-avid lesion compared to prior examination.",
    ],
  },
  Angiography: {
    modality: "Angiography",
    description: "Angiography reporting with vessel assessment, stenosis grading, and intervention details.",
    sectionOrder: ["Clinical Indication", "Technique", "Access Site", "Vessels Assessed", "Findings", "Intervention", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Vessels Assessed", "Findings", "Impression"],
    quickPhrases: [
      "No significant stenosis or occlusion identified in the vessels assessed.",
      "Patent vascular anatomy without evidence of aneurysmal dilatation.",
      "Successful catheterisation and contrast opacification of target vessels.",
    ],
  },
  "X-Ray": {
    modality: "X-Ray",
    description: "Concise radiograph reporting with clinical indication, findings, and impression.",
    sectionOrder: ["Clinical Indication", "Comparison", "Findings", "Impression"],
    requiredSections: ["Clinical Indication", "Findings", "Impression"],
    quickPhrases: [
      "No acute cardiopulmonary abnormality identified on this radiograph.",
      "No displaced fracture or dislocation demonstrated on the provided views.",
      "Cardiomediastinal silhouette is within normal size limits.",
    ],
  },
  "CT Scan": {
    modality: "CT Scan",
    description: "Structured CT reporting with technique, findings, impression, and next-step guidance.",
    sectionOrder: ["Clinical Indication", "Technique", "Comparison", "Findings", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Technique", "Findings", "Impression", "Recommendations"],
    quickPhrases: [
      "No acute intracranial hemorrhage, mass effect, or midline shift.",
      "No bowel obstruction, free air, or drainable collection identified.",
      "No acute traumatic abnormality seen within the scanned field.",
    ],
  },
  MRI: {
    modality: "MRI",
    description: "Structured MRI reporting with technique, findings, impression, and actionable recommendations.",
    sectionOrder: ["Clinical Indication", "Technique", "Comparison", "Findings", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Technique", "Findings", "Impression", "Recommendations"],
    quickPhrases: [
      "No acute infarct, hemorrhage, or space-occupying lesion identified.",
      "Mild degenerative signal change without focal cord compression.",
      "No abnormal enhancement demonstrated on the provided sequences.",
    ],
  },
  Ultrasound: {
    modality: "Ultrasound",
    description: "Ultrasound reporting with indication, targeted findings, and impression.",
    sectionOrder: ["Clinical Indication", "Technique", "Findings", "Impression", "Recommendations"],
    requiredSections: ["Clinical Indication", "Findings", "Impression"],
    quickPhrases: [
      "No sonographic evidence of acute hepatobiliary abnormality.",
      "No hydronephrosis or focal renal mass seen on this examination.",
      "Single live intrauterine pregnancy with fetal cardiac activity present.",
    ],
  },
  Mammography: {
    modality: "Mammography",
    description: "Structured mammography reporting with breast density, BI-RADS, and recommendation fields.",
    sectionOrder: ["Clinical Indication", "Technique", "Breast Density", "Comparison", "Findings", "Impression", "BI-RADS", "Recommendations"],
    requiredSections: ["Clinical Indication", "Technique", "Breast Density", "Findings", "Impression", "BI-RADS", "Recommendations"],
    quickPhrases: [
      "No suspicious mass, architectural distortion, or grouped microcalcifications identified.",
      "Breast density is within expected range for age.",
      "Recommend routine interval follow-up in keeping with screening protocol.",
    ],
  },
}

export type RadiologyStudy = {
  id: string
  patientId: string
  patientName: string
  patientNumber?: string | null
  testName: string
  testType: string
  status: RadiologyStatus
  priority: RadiologyPriority
  orderedAt: string
  completedAt?: string | null
  accessionNumber?: string | null
  notes?: string
  results?: string
  orderedBy?: string
  assignedToId?: string | null
  assignedToName?: string | null
  assignedAt?: string | null
  patientDob?: string | null
  patientGender?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function resolveRadiologyModality(value?: string | null): RadiologyStructuredTemplate["modality"] | null {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "x-ray" || normalized === "xray") return "X-Ray"
  if (normalized === "ct scan" || normalized === "ct") return "CT Scan"
  if (normalized === "mri") return "MRI"
  if (normalized === "ultrasound") return "Ultrasound"
  if (normalized === "mammography") return "Mammography"
  if (normalized === "fluoroscopy") return "Fluoroscopy"
  if (normalized === "nuclear medicine") return "Nuclear Medicine"
  if (normalized === "pet scan" || normalized === "pet" || normalized === "pet-ct") return "PET Scan"
  if (normalized === "angiography" || normalized === "dsa") return "Angiography"
  return null
}

export function getRadiologyStructuredTemplate(value?: string | null) {
  const modality = resolveRadiologyModality(value)
  return modality ? STRUCTURED_REPORT_TEMPLATES[modality] : null
}

export function buildStructuredRadiologyReport(value?: string | null) {
  const template = getRadiologyStructuredTemplate(value)
  if (!template) return ""
  return template.sectionOrder.map((section) => `${section}:\n`).join("\n")
}

export function getMissingStructuredSections(report: string, sections: string[]) {
  return sections.filter((section) => {
    const pattern = new RegExp(`(^|\\n)${escapeRegExp(section)}\\s*:`, "i")
    return !pattern.test(report)
  })
}

export function isRadiologyImageAsset(fileUrl?: string | null, mimeType?: string | null) {
  const resolvedMime = String(mimeType || "").toLowerCase()
  const resolvedUrl = String(fileUrl || "").toLowerCase()
  return resolvedMime.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(resolvedUrl)
}

export function isRadiologyPdfAsset(fileUrl?: string | null, mimeType?: string | null) {
  const resolvedMime = String(mimeType || "").toLowerCase()
  const resolvedUrl = String(fileUrl || "").toLowerCase()
  return resolvedMime === "application/pdf" || /\.pdf$/i.test(resolvedUrl)
}

export function isRadiologyDicomAsset(fileUrl?: string | null, mimeType?: string | null, originalName?: string | null) {
  const candidates = [fileUrl, mimeType, originalName]
    .map((value) => String(value || "").toLowerCase())
    .join(" ")
  return /\bdicom\b/.test(candidates) || /\.(dcm|dicom)\b/.test(candidates)
}

export function formatRadiologyAttachmentName(originalName?: string | null, fileUrl?: string | null, type?: string | null) {
  const trimmedOriginal = String(originalName || "").trim()
  if (trimmedOriginal) return trimmedOriginal
  const fromUrl = String(fileUrl || "")
    .split("/")
    .pop()
    ?.split("?")[0]
    ?.trim()
  if (fromUrl) return fromUrl
  return String(type || "Attachment").trim() || "Attachment"
}

export function isRadiologyModality(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase()
  return RADIOLOGY_MODALITIES.includes(normalized as (typeof RADIOLOGY_MODALITIES)[number])
}

export function isRadiologyStudy(test: Partial<LabTest> & Record<string, any>) {
  return isRadiologyModality(test.testName) || isRadiologyModality(test.testType)
}

export function normalizeStudyStatus(value?: string | null): RadiologyStatus {
  const normalized = String(value || "").trim().toLowerCase().replace(/_/g, "-")
  if (normalized === "completed") return "completed"
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled"
  if (normalized === "in progress" || normalized === "in-progress") return "in-progress"
  return "pending"
}

export function normalizeStudyPriority(value?: string | null): RadiologyPriority {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "stat") return "stat"
  if (normalized === "urgent") return "urgent"
  return "routine"
}

export function formatStudyStatus(status: RadiologyStatus) {
  if (status === "in-progress") return "In Progress"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatStudyPriority(priority: RadiologyPriority) {
  if (priority === "stat") return "STAT"
  if (priority === "urgent") return "Urgent"
  return "Routine"
}

export function calculateAgeFromDob(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1
  }
  return Math.max(age, 0)
}

export function normalizeRadiologyStudy(test: Partial<LabTest> & Record<string, any>): RadiologyStudy | null {
  if (!isRadiologyStudy(test)) return null

  const testName = String(test.testName || test.test_type || test.testType || "").trim()
  const testType = String(test.testType || test.test_type || testName || "Radiology").trim()

  return {
    id: String(test.id || ""),
    patientId: String(test.patientId || test.patient_id || ""),
    patientName: String(test.patientName || test.patient_name || "").trim(),
    patientNumber: test.patientNumber || test.patient_number || null,
    testName,
    testType,
    status: normalizeStudyStatus(test.status),
    priority: normalizeStudyPriority(test.priority),
    orderedAt: String(test.orderedAt || test.ordered_at || test.orderedDate || test.ordered_date || ""),
    completedAt: test.completedAt || test.completed_at || test.completedDate || test.completed_date || null,
    accessionNumber: test.accessionNumber || test.accession_number || null,
    notes: test.notes || "",
    results: test.results || "",
    orderedBy: test.doctorName || test.orderedBy || test.doctor_name || "",
    assignedToId: test.assignedToId || test.assigned_radiologist_id || null,
    assignedToName: test.assignedToName || test.assigned_radiologist_name || null,
    assignedAt: test.assignedAt || test.assigned_at || null,
    patientDob: test.patientDob || test.patient_dob || test.date_of_birth || null,
    patientGender: test.patientGender || test.patient_gender || test.gender || null,
    reviewedBy: test.reviewedBy || test.reviewed_by || null,
    reviewedAt: test.reviewedAt || test.reviewed_at || null,
  }
}
