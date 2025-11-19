"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export interface MedicalRecord {
  id: string
  patientId: string
  patientName: string
  doctorName: string
  date: string
  diagnosis: string
  symptoms: string
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
  dateAdministered: string
  nextDueDate?: string
  administeredBy: string
  batchNumber?: string
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

interface MedicalContextType {
  medicalRecords: MedicalRecord[]
  prescriptions: Prescription[]
  labResults: LabResult[]
  medicalDocuments: MedicalDocument[]
  allergies: Allergy[]
  immunizations: Immunization[]
  chronicConditions: ChronicCondition[]
  addMedicalRecord: (record: Omit<MedicalRecord, "id">) => void
  addPrescription: (prescription: Omit<Prescription, "id">) => void
  updatePrescription: (id: string, updates: Partial<Prescription>) => void
  addLabResult: (labResult: Omit<LabResult, "id">) => void
  updateLabResult: (id: string, updates: Partial<LabResult>) => void
  getPatientMedicalRecords: (patientId: string) => MedicalRecord[]
  getPatientPrescriptions: (patientId: string) => Prescription[]
  getPatientLabResults: (patientId: string) => LabResult[]
  addMedicalDocument: (document: Omit<MedicalDocument, "id">) => void
  getPatientDocuments: (patientId: string) => MedicalDocument[]
  addAllergy: (allergy: Omit<Allergy, "id">) => void
  getPatientAllergies: (patientId: string) => Allergy[]
  addImmunization: (immunization: Omit<Immunization, "id">) => void
  getPatientImmunizations: (patientId: string) => Immunization[]
  addChronicCondition: (condition: Omit<ChronicCondition, "id">) => void
  updateChronicCondition: (id: string, updates: Partial<ChronicCondition>) => void
  getPatientChronicConditions: (patientId: string) => ChronicCondition[]
  getPatientTimeline: (patientId: string) => any[]
}

const MedicalContext = createContext<MedicalContextType | undefined>(undefined)
export function MedicalProvider({ children }: { children: ReactNode }) {
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [medicalDocuments, setMedicalDocuments] = useState<MedicalDocument[]>([])
  const [allergies, setAllergies] = useState<Allergy[]>([])
  const [immunizations, setImmunizations] = useState<Immunization[]>([])
  const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/medical", { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const recs: MedicalRecord[] = (data.medicalRecords || []).map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            patientName: "",
            doctorName: "",
            date: r.visit_date,
            diagnosis: r.diagnosis || "",
            symptoms: r.chief_complaint || "",
            treatment: r.treatment_plan || "",
          }))
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
              patientName: "",
              doctorName: "",
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
            }
          })
          const labs: LabResult[] = (data.labResults || []).map((l: any) => ({
            id: l.id,
            patientId: l.patient_id,
            patientName: "",
            testType: l.test_type,
            orderedBy: "",
            orderedDate: l.ordered_date ? new Date(l.ordered_date).toISOString() : "",
            completedDate: l.completed_date ? new Date(l.completed_date).toISOString() : undefined,
            priority: l.priority ? (l.priority.toString().toLowerCase() as LabResult["priority"]) : undefined,
            status: (l.status || "pending").toString().toLowerCase(),
            results: l.results || undefined,
            notes: l.notes || undefined,
            assignedToId: l.assigned_radiologist_id || undefined,
            assignedToName: l.assigned_radiologist_name || undefined,
          }))
          setMedicalRecords(recs)
          setPrescriptions(pres)
          setLabResults(labs)
        } else {
          setMedicalRecords([])
          setPrescriptions([])
          setLabResults([])
        }
      } catch {
        setMedicalRecords([])
        setPrescriptions([])
        setLabResults([])
      }
    })()
  }, [])

  const addMedicalRecord = (record: Omit<MedicalRecord, "id">) => {
    const newRecord: MedicalRecord = {
      ...record,
      id: `MR${String(medicalRecords.length + 1).padStart(3, "0")}`,
    }
    setMedicalRecords([...medicalRecords, newRecord])
    ;(async () => {
      try {
        await fetch("/api/medical/records", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: record.patientId,
            chiefComplaint: record.symptoms,
            diagnosis: record.diagnosis,
            treatmentPlan: record.treatment,
            notes: record.notes,
          }),
        })
      } catch {
        // Non-fatal: local state already updated; server is source of truth when available.
      }
    })()
  }

  const addPrescription = (prescription: Omit<Prescription, "id">) => {
    const newPrescription: Prescription = {
      ...prescription,
      id: `RX${String(prescriptions.length + 1).padStart(3, "0")}`,
    }
    setPrescriptions([...prescriptions, newPrescription])
    ;(async () => {
      try {
        await fetch("/api/medical/prescriptions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: prescription.patientId,
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
    const newAllergy: Allergy = {
      ...allergy,
      id: `ALG${String(allergies.length + 1).padStart(3, "0")}`,
    }
    setAllergies([...allergies, newAllergy])
  }

  const getPatientAllergies = (patientId: string) => {
    return allergies.filter((a) => a.patientId === patientId)
  }

  const addImmunization = (immunization: Omit<Immunization, "id">) => {
    const newImmunization: Immunization = {
      ...immunization,
      id: `IMM${String(immunizations.length + 1).padStart(3, "0")}`,
    }
    setImmunizations([...immunizations, newImmunization])
  }

  const getPatientImmunizations = (patientId: string) => {
    return immunizations.filter((i) => i.patientId === patientId)
  }

  const addChronicCondition = (condition: Omit<ChronicCondition, "id">) => {
    const newCondition: ChronicCondition = {
      ...condition,
      id: `CHR${String(chronicConditions.length + 1).padStart(3, "0")}`,
    }
    setChronicConditions([...chronicConditions, newCondition])
  }

  const updateChronicCondition = (id: string, updates: Partial<ChronicCondition>) => {
    setChronicConditions(chronicConditions.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const getPatientChronicConditions = (patientId: string) => {
    return chronicConditions.filter((c) => c.patientId === patientId)
  }

  const getPatientTimeline = (patientId: string) => {
    const timeline: any[] = []

    // Add medical records
    getPatientMedicalRecords(patientId).forEach((record) => {
      timeline.push({
        type: "consultation",
        date: record.date,
        data: record,
      })
    })

    // Add prescriptions
    getPatientPrescriptions(patientId).forEach((prescription) => {
      timeline.push({
        type: "prescription",
        date: prescription.date,
        data: prescription,
      })
    })

    // Add lab results
    getPatientLabResults(patientId).forEach((labResult) => {
      timeline.push({
        type: "lab-result",
        date: labResult.completedDate || labResult.orderedDate,
        data: labResult,
      })
    })

    // Add documents
    getPatientDocuments(patientId).forEach((document) => {
      timeline.push({
        type: "document",
        date: document.uploadedDate,
        data: document,
      })
    })

    // Add immunizations
    getPatientImmunizations(patientId).forEach((immunization) => {
      timeline.push({
        type: "immunization",
        date: immunization.dateAdministered,
        data: immunization,
      })
    })

    // Sort by date (newest first)
    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  return (
    <MedicalContext.Provider
      value={{
        medicalRecords,
        prescriptions,
        labResults,
        medicalDocuments,
        allergies,
        immunizations,
        chronicConditions,
        addMedicalRecord,
        addPrescription,
        updatePrescription,
        addLabResult,
        updateLabResult,
        getPatientMedicalRecords,
        getPatientPrescriptions,
        getPatientLabResults,
        addMedicalDocument,
        getPatientDocuments,
        addAllergy,
        getPatientAllergies,
        addImmunization,
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
