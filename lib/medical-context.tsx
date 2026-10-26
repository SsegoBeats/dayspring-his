"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/security"

export interface MedicalRecord {
  id: string
  patientId: string
  patientName: string
  doctorName: string
  date: string
  diagnosis: string
  symptoms: string
  history?: string
  impression?: string
  treatment: string
  notes?: string
  vitalSigns?: {
    bloodPressure?: string
    temperature?: string
    heartRate?: string
    respiratoryRate?: string
    oxygenSaturation?: string
  }
}

export interface Prescription {
  id: string
  patientId: string
  patientName: string
  doctorName: string
  date: string
  medications: {
    name: string
    dosage: string
    frequency: string
    duration: string
    instructions?: string
  }[]
  status: "active" | "completed" | "cancelled"
  is_controlled_substance?: boolean
  visit_type?: "OPD" | "INPATIENT" | "EMERGENCY"
}

export interface LabResult {
  id: string
  patientId: string
  patientName: string
  testType: string
  orderedBy: string
  orderedDate: string
  completedDate?: string
  priority?: "stat" | "urgent" | "routine"
  status: "pending" | "completed" | "cancelled"
  results?: string
  notes?: string
  reviewedBy?: string
  reviewedAt?: string
  assignedToId?: string
  assignedToName?: string
}

export interface MedicalDocument {
  id: string
  patientId: string
  patientName: string
  documentType: "lab-report" | "xray" | "scan" | "prescription" | "consent-form" | "other"
  fileName: string
  fileUrl: string
  uploadedBy: string
  uploadedDate: string
  notes?: string
}

export interface Allergy {
  id: string
  patientId: string
  allergen: string
  reaction: string
  severity: "mild" | "moderate" | "severe"
  diagnosedDate: string
  notes?: string
}

export interface Immunization {
  id: string
  patientId: string
  vaccineName: string
  dateAdministered?: string
  administeredAt?: string
  nextDueDate?: string
  overdueDate?: string
  ageTime?: string
  scheduleCode?: string
  dose?: string
  status?: "Due" | "Given" | "Overdue" | "Not Given" | "Contraindicated" | "Refused"
  statusReason?: string
  administeredBy: string
  route?: string
  administrationSite?: string
  manufacturer?: string
  batchNumber?: string
  isOtherVaccine?: boolean
  otherVaccineReason?: string
  contraindicationReason?: string
  refusalReason?: string
  notes?: string
}

export interface ChronicCondition {
  id: string
  patientId: string
  condition: string
  diagnosedDate: string
  status: "active" | "managed" | "resolved"
  medications?: string[]
  notes?: string
}

export interface Procedure {
  id: string
  patientId: string
  patientName: string
  orderedByName?: string
  completedByName?: string
  procedureName: string
  procedureType?: string
  status?: "ordered" | "in_progress" | "completed" | "cancelled"
  date?: string
  time?: string
  performedBy?: string
  reasonIndication?: string
  findings?: string
  procedureNotes?: string
  outcome?: string
  followUpInstructions?: string
  isOtherProcedure?: boolean
  otherProcedureName?: string
}

interface MedicalContextType {
  medicalRecords: MedicalRecord[]
  prescriptions: Prescription[]
  labResults: LabResult[]
  procedures: Procedure[]
  medicalDocuments: MedicalDocument[]
  allergies: Allergy[]
  immunizations: Immunization[]
  chronicConditions: ChronicCondition[]
  refreshMedicalData: () => Promise<void>
  addMedicalRecord: (record: Omit<MedicalRecord, "id">) => Promise<MedicalRecord | null>
  addPrescription: (prescription: Omit<Prescription, "id">) => void
  updatePrescription: (id: string, updates: Partial<Prescription>) => void
  addLabResult: (labResult: Omit<LabResult, "id">) => void
  updateLabResult: (id: string, updates: Partial<LabResult>) => void
  getPatientMedicalRecords: (patientId: string) => MedicalRecord[]
  getPatientPrescriptions: (patientId: string) => Prescription[]
  getPatientLabResults: (patientId: string) => LabResult[]
  getPatientProcedures: (patientId: string) => Procedure[]
  addMedicalDocument: (document: Omit<MedicalDocument, "id">) => void
  getPatientDocuments: (patientId: string) => MedicalDocument[]
  addAllergy: (allergy: Omit<Allergy, "id">) => void
  getPatientAllergies: (patientId: string) => Allergy[]
  addImmunization: (immunization: Omit<Immunization, "id">) => Promise<void>
  updateImmunization: (id: string, updates: Partial<Immunization>) => Promise<void>
  getPatientImmunizations: (patientId: string) => Immunization[]
  addChronicCondition: (condition: Omit<ChronicCondition, "id">) => void
  updateChronicCondition: (id: string, updates: Partial<ChronicCondition>) => void
  getPatientChronicConditions: (patientId: string) => ChronicCondition[]
  getPatientTimeline: (patientId: string) => any[]
}

const MedicalContext = createContext<MedicalContextType | undefined>(undefined)

async function fetchAndMapMedicalData(): Promise<{
  recs: MedicalRecord[]
  pres: Prescription[]
  labs: LabResult[]
  procedures: Procedure[]
  allergyList: Allergy[]
  immunizationList: Immunization[]
  chronicList: ChronicCondition[]
  docList: MedicalDocument[]
}> {
  const [res, allergyRes, immunizationRes, chronicRes, docRes] = await Promise.all([
    fetch("/api/medical", { credentials: "include" }),
    fetch("/api/medical/allergies", { credentials: "include" }),
    fetch("/api/medical/immunizations", { credentials: "include" }),
    fetch("/api/medical/chronic-conditions", { credentials: "include" }),
    fetch("/api/medical/documents", { credentials: "include" }),
  ])
  if (!res.ok) {
    throw new Error(`Failed to fetch /api/medical: ${res.status}`)
  }
  const data = await res.json()
  const recs: MedicalRecord[] = (data.medicalRecords || []).map((r: any) => {
    const hasVitals =
      r.blood_pressure_systolic != null ||
      r.blood_pressure_diastolic != null ||
      r.temperature != null ||
      r.heart_rate != null ||
      r.respiratory_rate != null ||
      r.oxygen_saturation != null
    const vitalSigns = hasVitals
      ? {
          bloodPressure:
            r.blood_pressure_systolic != null && r.blood_pressure_diastolic != null
              ? `${r.blood_pressure_systolic}/${r.blood_pressure_diastolic}`
              : undefined,
          temperature: r.temperature != null ? String(r.temperature) : undefined,
          heartRate: r.heart_rate != null ? String(r.heart_rate) : undefined,
          respiratoryRate: r.respiratory_rate != null ? String(r.respiratory_rate) : undefined,
          oxygenSaturation: r.oxygen_saturation != null ? String(r.oxygen_saturation) : undefined,
        }
      : undefined
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name ? String(r.patient_name).trim() : "",
      doctorName: r.doctor_name ? String(r.doctor_name).trim() : "",
      date: r.visit_date,
      diagnosis: r.diagnosis || "",
      symptoms: r.chief_complaint || "",
      history: r.history || "",
      impression: r.impression || "",
      treatment: r.treatment_plan || "",
      notes: r.notes || "",
      ...(vitalSigns && { vitalSigns }),
    }
  })
  const pres: Prescription[] = (data.prescriptions || []).map((p: any) => {
    const rawStatus = (p.status || "Pending").toString()
    let status: Prescription["status"]
    switch (rawStatus.toLowerCase()) {
      case "pending":
        status = "active"
        break
      case "dispensed":
        status = "completed"
        break
      case "cancelled":
        status = "cancelled"
        break
      default:
        status = "active"
    }
    return {
      id: p.id,
      patientId: p.patient_id,
      patientName: p.patient_name ? String(p.patient_name).trim() : "",
      doctorName: p.doctor_name ? String(p.doctor_name).trim() : "",
      date: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
      medications: [
        {
          name: p.medication_name,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions || undefined,
        },
      ],
      status,
      is_controlled_substance: p.is_controlled_substance === true,
      visit_type: (["OPD", "INPATIENT", "EMERGENCY"].includes(p.visit_type) ? p.visit_type : "OPD") as Prescription["visit_type"],
    }
  })
  const labs: LabResult[] = (data.labResults || []).map((l: any) => ({
    id: l.id,
    patientId: l.patient_id,
    patientName: l.patient_name ? String(l.patient_name).trim() : "",
    testType: l.test_type,
    orderedBy: l.doctor_name ? String(l.doctor_name).trim() : "",
    orderedDate: l.ordered_date ? new Date(l.ordered_date).toISOString() : "",
    completedDate: l.completed_date ? new Date(l.completed_date).toISOString() : undefined,
    priority: l.priority ? (l.priority.toString().toLowerCase() as LabResult["priority"]) : undefined,
    status: (l.status || "pending").toString().toLowerCase(),
    results: l.results || undefined,
    notes: l.notes || undefined,
    assignedToId: l.assigned_radiologist_id || undefined,
    assignedToName: l.assigned_radiologist_name || undefined,
  }))

  const procedures: Procedure[] = (data.procedures || []).map((p: any) => ({
    id: p.id,
    patientId: p.patient_id,
    patientName: p.patient_name ? String(p.patient_name).trim() : "",
    orderedByName: p.ordered_by_name ? String(p.ordered_by_name).trim() : undefined,
    completedByName: p.completed_by_name ? String(p.completed_by_name).trim() : undefined,
    procedureName: p.procedure_name || p.other_procedure_name || "Procedure",
    procedureType: p.procedure_type || undefined,
    status: (p.status || "ordered").toString().toLowerCase() as Procedure["status"],
    date: p.performed_at ? new Date(p.performed_at).toISOString().slice(0, 10) : p.ordered_at ? new Date(p.ordered_at).toISOString().slice(0, 10) : undefined,
    time: p.performed_at ? new Date(p.performed_at).toISOString().slice(11, 16) : p.ordered_at ? new Date(p.ordered_at).toISOString().slice(11, 16) : undefined,
    performedBy: p.performed_by_name || undefined,
    reasonIndication: p.reason_indication || undefined,
    findings: p.findings || undefined,
    procedureNotes: p.procedure_notes || undefined,
    outcome: p.outcome || undefined,
    followUpInstructions: p.follow_up_instructions || undefined,
    isOtherProcedure: p.is_other_procedure === true || Boolean(p.other_procedure_name),
    otherProcedureName: p.other_procedure_name || undefined,
  }))

  const allergyData = allergyRes.ok ? await allergyRes.json() : { allergies: [] }
  const allergyList: Allergy[] = (allergyData.allergies || []).map((a: any) => ({
    id: a.id,
    patientId: a.patient_id,
    allergen: a.allergen,
    reaction: a.reaction,
    severity: a.severity as Allergy["severity"],
    diagnosedDate: a.diagnosed_date ? String(a.diagnosed_date).slice(0, 10) : "",
    notes: a.notes || undefined,
  }))

  const immunizationData = immunizationRes.ok ? await immunizationRes.json() : { immunizations: [] }
  const immunizationList: Immunization[] = (immunizationData.immunizations || []).map((i: any) => ({
    id: i.id,
    patientId: i.patient_id,
    vaccineName: i.vaccine_name,
    dateAdministered: i.date_administered ? String(i.date_administered).slice(0, 10) : "",
    administeredAt: i.administered_at ? new Date(i.administered_at).toISOString() : undefined,
    nextDueDate: i.next_due_date ? String(i.next_due_date).slice(0, 10) : undefined,
    overdueDate: i.overdue_date ? String(i.overdue_date).slice(0, 10) : undefined,
    ageTime: i.age_time || undefined,
    scheduleCode: i.schedule_code || undefined,
    dose: i.dose || undefined,
    status: i.status || undefined,
    statusReason: i.status_reason || undefined,
    administeredBy: i.administered_by || "",
    route: i.route || undefined,
    administrationSite: i.administration_site || undefined,
    manufacturer: i.manufacturer || undefined,
    batchNumber: i.batch_number || undefined,
    isOtherVaccine: i.is_other_vaccine === true,
    otherVaccineReason: i.other_vaccine_reason || undefined,
    contraindicationReason: i.contraindication_reason || undefined,
    refusalReason: i.refusal_reason || undefined,
    notes: i.notes || undefined,
  }))

  const chronicData = chronicRes.ok ? await chronicRes.json() : { chronicConditions: [] }
  const chronicList: ChronicCondition[] = (chronicData.chronicConditions || []).map((c: any) => ({
    id: c.id,
    patientId: c.patient_id,
    condition: c.condition,
    diagnosedDate: c.diagnosed_date ? String(c.diagnosed_date).slice(0, 10) : "",
    status: c.status as ChronicCondition["status"],
    medications: Array.isArray(c.medications) ? c.medications : undefined,
    notes: c.notes || undefined,
  }))

  const docData = docRes.ok ? await docRes.json() : { documents: [] }
  const docList: MedicalDocument[] = (docData.documents || []).map((d: any) => ({
    id: d.id,
    patientId: d.patient_id,
    patientName: "",
    documentType: (d.type || "OTHER").toLowerCase().replace("_", "-") as MedicalDocument["documentType"],
    fileName: d.file_name || d.type,
    fileUrl: d.file_url,
    uploadedBy: d.uploaded_by_name || "Unknown",
    uploadedDate: d.uploaded_at ? String(d.uploaded_at).slice(0, 10) : "",
    notes: d.notes || undefined,
  }))

  return { recs, pres, labs, procedures, allergyList, immunizationList, chronicList, docList }
}

export function MedicalProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [medicalDocuments, setMedicalDocuments] = useState<MedicalDocument[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [immunizations, setImmunizations] = useState<Immunization[]>([])
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([])

  const hasMedicalAccess = user && can(user.role, "medical", "read")

  const loadMedicalData = async () => {
    if (!hasMedicalAccess) return
    try {
      const result = await fetchAndMapMedicalData()
      setMedicalRecords(result.recs)
      setPrescriptions(result.pres)
      setLabResults(result.labs)
      setProcedures(result.procedures)
      setAllergies(result.allergyList)
      setImmunizations(result.immunizationList)
      setChronicConditions(result.chronicList)
      setMedicalDocuments(result.docList)
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[MedicalContext] Error fetching medical data:", err)
      }
    }
  }

  useEffect(() => {
    if (!hasMedicalAccess) return
    loadMedicalData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMedicalAccess])

  const addMedicalRecord = async (record: Omit<MedicalRecord, "id">): Promise<MedicalRecord | null> => {
    try {
      const res = await fetch("/api/medical/records", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: record.patientId,
          chiefComplaint: record.symptoms,
          history: record.history,
          impression: record.impression,
          diagnosis: record.diagnosis,
          treatmentPlan: record.treatment,
          notes: record.notes,
          ...(record.vitalSigns && Object.keys(record.vitalSigns).length > 0
            ? { vitalSigns: record.vitalSigns }
            : {}),
        }),
      })

      const payload = await res.json().catch(() => null)
      if (!res.ok || !payload?.record) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[MedicalContext] Failed to save medical record:", payload)
        }
        return null
      }

      await loadMedicalData()
      return payload.record
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[MedicalContext] Exception saving medical record:", err)
      }
      return null
    }
  }

  const addPrescription = (prescription: Omit<Prescription, "id">) => {
    const newPrescription: Prescription = {
      ...prescription,
      id: `RX${String(prescriptions.length + 1).padStart(3, "0")}`,
    }
    setPrescriptions([...prescriptions, newPrescription])
    ;(async () => {
      try {
        const res = await fetch("/api/medical/prescriptions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: prescription.patientId,
            visitType: prescription.visit_type ?? "OPD",
            medications: prescription.medications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              duration: m.duration,
              instructions: m.instructions,
              quantity: 1,
            })),
          }),
        })
        if (res.ok) await loadMedicalData()
      } catch {
        // Non-fatal
      }
    })()
  }

  const updatePrescription = (id: string, updates: Partial<Prescription>) => {
    setPrescriptions(prescriptions.map((p) => (p.id === id ? { ...p, ...updates } : p)))
    if (typeof updates.status === "string") {
      ;(async () => {
        try {
          await fetch(`/api/medical/prescriptions/${encodeURIComponent(id)}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: updates.status }),
          })
        } catch {
          // ignore – local state already updated
        }
      })()
    }
  }

  const addLabResult = (labResult: Omit<LabResult, "id">) => {
    const newLabResult: LabResult = {
      ...labResult,
      id: `LAB${String(labResults.length + 1).padStart(3, "0")}`,
    }
    setLabResults([...labResults, newLabResult])
  }

  const updateLabResult = (id: string, updates: Partial<LabResult>) => {
    setLabResults(labResults.map((lr) => (lr.id === id ? { ...lr, ...updates } : lr)))
  }

  const getPatientMedicalRecords = (patientId: string) => {
    return medicalRecords.filter((mr) => mr.patientId === patientId)
  }

  const getPatientPrescriptions = (patientId: string) => {
    return prescriptions.filter((p) => p.patientId === patientId)
  }

  const getPatientLabResults = (patientId: string) => {
    return labResults.filter((lr) => lr.patientId === patientId)
  }

  const getPatientProcedures = (patientId: string) => {
    return procedures.filter((procedure) => procedure.patientId === patientId)
  }

  const addMedicalDocument = (document: Omit<MedicalDocument, "id">) => {
    const newDocument: MedicalDocument = {
      ...document,
      id: `DOC${String(medicalDocuments.length + 1).padStart(3, "0")}`,
    }
    setMedicalDocuments([...medicalDocuments, newDocument])
  }

  const getPatientDocuments = (patientId: string) => {
    return medicalDocuments.filter((d) => d.patientId === patientId)
  }

  const addAllergy = (allergy: Omit<Allergy, "id">) => {
    const tempId = `ALG${String(allergies.length + 1).padStart(3, "0")}`
    const newAllergy: Allergy = { ...allergy, id: tempId }
    setAllergies((prev) => [...prev, newAllergy])
    ;(async () => {
      try {
        const res = await fetch("/api/medical/allergies", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: allergy.patientId,
            allergen: allergy.allergen,
            reaction: allergy.reaction,
            severity: allergy.severity,
            diagnosedDate: allergy.diagnosedDate || undefined,
            notes: allergy.notes,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setAllergies((prev) =>
            prev.map((a) => (a.id === tempId ? { ...a, id: data.allergy.id } : a)),
          )
        }
      } catch {
        // Non-fatal: local state already updated
      }
    })()
  }

  const getPatientAllergies = (patientId: string) => {
    return allergies.filter((a) => a.patientId === patientId)
  }

  const addImmunization = async (immunization: Omit<Immunization, "id">): Promise<void> => {
    const res = await fetch("/api/medical/immunizations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: immunization.patientId,
        vaccineName: immunization.vaccineName,
        dateAdministered: immunization.dateAdministered,
        administeredAt: immunization.administeredAt,
        nextDueDate: immunization.nextDueDate || undefined,
        overdueDate: immunization.overdueDate || undefined,
        ageTime: immunization.ageTime || undefined,
        scheduleCode: immunization.scheduleCode || undefined,
        dose: immunization.dose || undefined,
        status: immunization.status || undefined,
        statusReason: immunization.statusReason || undefined,
        administeredBy: immunization.administeredBy,
        route: immunization.route || undefined,
        administrationSite: immunization.administrationSite || undefined,
        manufacturer: immunization.manufacturer || undefined,
        batchNumber: immunization.batchNumber,
        isOtherVaccine: immunization.isOtherVaccine === true,
        otherVaccineReason: immunization.otherVaccineReason || undefined,
        contraindicationReason: immunization.contraindicationReason || undefined,
        refusalReason: immunization.refusalReason || undefined,
        notes: immunization.notes,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.immunization?.id) {
      throw new Error(data?.error || "Failed to save immunization")
    }
    setImmunizations((prev) => [...prev, { ...immunization, id: data.immunization.id }])
  }

  const updateImmunization = async (id: string, updates: Partial<Immunization>) => {
    setImmunizations((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
    try {
      await fetch(`/api/medical/immunizations?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaccineName: updates.vaccineName,
          dateAdministered: updates.dateAdministered,
          administeredAt: updates.administeredAt,
          nextDueDate: updates.nextDueDate,
          overdueDate: updates.overdueDate,
          ageTime: updates.ageTime,
          scheduleCode: updates.scheduleCode,
          dose: updates.dose,
          status: updates.status,
          statusReason: updates.statusReason,
          administeredBy: updates.administeredBy,
          route: updates.route,
          administrationSite: updates.administrationSite,
          manufacturer: updates.manufacturer,
          batchNumber: updates.batchNumber,
          isOtherVaccine: updates.isOtherVaccine,
          otherVaccineReason: updates.otherVaccineReason,
          contraindicationReason: updates.contraindicationReason,
          refusalReason: updates.refusalReason,
          notes: updates.notes,
        }),
      })
      await loadMedicalData()
    } catch {
      // Non-fatal: local state already updated
    }
  }

  const getPatientImmunizations = (patientId: string) => {
    return immunizations.filter((i) => i.patientId === patientId)
  }

  const addChronicCondition = (condition: Omit<ChronicCondition, "id">) => {
    const tempId = `CHR${String(chronicConditions.length + 1).padStart(3, "0")}`
    const newCondition: ChronicCondition = { ...condition, id: tempId }
    setChronicConditions((prev) => [...prev, newCondition])
    ;(async () => {
      try {
        const res = await fetch("/api/medical/chronic-conditions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: condition.patientId,
            condition: condition.condition,
            diagnosedDate: condition.diagnosedDate || undefined,
            status: condition.status,
            medications: condition.medications,
            notes: condition.notes,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setChronicConditions((prev) =>
            prev.map((c) => (c.id === tempId ? { ...c, id: data.chronicCondition.id } : c)),
          )
        }
      } catch {
        // Non-fatal: local state already updated
      }
    })()
  }

  const updateChronicCondition = (id: string, updates: Partial<ChronicCondition>) => {
    setChronicConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    ;(async () => {
      try {
        await fetch(`/api/medical/chronic-conditions?id=${encodeURIComponent(id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: updates.status,
            medications: updates.medications,
            notes: updates.notes,
          }),
        })
      } catch {
        // Non-fatal: local state already updated
      }
    })()
  }

  const getPatientChronicConditions = (patientId: string) => {
    return chronicConditions.filter((c) => c.patientId === patientId)
  }

  const getPatientTimeline = (patientId: string) => {
    const timeline: any[] = []

    getPatientMedicalRecords(patientId).forEach((record) => {
      timeline.push({
        type: "consultation",
        date: record.date,
        data: record,
      })
    })

    getPatientPrescriptions(patientId).forEach((prescription) => {
      timeline.push({
        type: "prescription",
        date: prescription.date,
        data: prescription,
      })
    })

    getPatientLabResults(patientId).forEach((labResult) => {
      timeline.push({
        type: "lab-result",
        date: labResult.completedDate || labResult.orderedDate,
        data: labResult,
      })
    })

    getPatientProcedures(patientId).forEach((procedure) => {
      timeline.push({
        type: "procedure",
        date: procedure.date || procedure.time || new Date().toISOString(),
        data: procedure,
      })
    })

    getPatientDocuments(patientId).forEach((document) => {
      timeline.push({
        type: "document",
        date: document.uploadedDate,
        data: document,
      })
    })

    getPatientImmunizations(patientId).forEach((immunization) => {
      timeline.push({
        type: "immunization",
        date: immunization.dateAdministered,
        data: immunization,
      })
    })

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  return (
    <MedicalContext.Provider
      value={{
        medicalRecords,
        prescriptions,
        labResults,
        procedures,
        medicalDocuments,
        allergies,
        immunizations,
        chronicConditions,
        refreshMedicalData: loadMedicalData,
        addMedicalRecord,
        addPrescription,
        updatePrescription,
        addLabResult,
        updateLabResult,
        getPatientMedicalRecords,
        getPatientPrescriptions,
        getPatientLabResults,
        getPatientProcedures,
        addMedicalDocument,
        getPatientDocuments,
        addAllergy,
        getPatientAllergies,
        addImmunization,
        updateImmunization,
        getPatientImmunizations,
        addChronicCondition,
        updateChronicCondition,
        getPatientChronicConditions,
        getPatientTimeline,
      }}
    >
      {children}
    </MedicalContext.Provider>
  )
}

export function useMedical() {
  const context = useContext(MedicalContext)
  if (context === undefined) {
    throw new Error("useMedical must be used within a MedicalProvider")
  }
  return context
}
