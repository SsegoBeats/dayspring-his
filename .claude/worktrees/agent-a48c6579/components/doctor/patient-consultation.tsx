"use client"
import { useState, useEffect } from "react"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import { Button } from "@/components/ui/button"
import { Printer, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPatientNumber } from "@/lib/patients"
import { ConsultationTab } from "./consultation-tabs/consultation-tab"
import { PrescriptionTab } from "./consultation-tabs/prescription-tab"
import { LabsTab } from "./consultation-tabs/labs-tab"
import { HistoryTab } from "./consultation-tabs/history-tab"
import { DentalTab } from "./consultation-tabs/dental-tab"

export type ConsultTab = "consultation" | "prescription" | "labs" | "history" | "dental"

interface PatientConsultationProps {
  patientId: string
  /** Preferred close handler. Falls back to onBack for legacy callers. */
  onClose?: () => void
  /** Legacy alias for onClose — kept so existing callers don't break. */
  onBack?: () => void
  initialTab?: ConsultTab
}

// DentalRecord shape used only for print section
interface DentalRecordSummary {
  diagnosis?: string | null
  procedure_performed?: string | null
  visit_date?: string | null
  notes?: string | null
  tooth_chart?: { notes?: string } | null
}

export function PatientConsultation({ patientId, onClose, onBack, initialTab = "consultation" }: PatientConsultationProps) {
  const handleClose = onClose ?? onBack ?? (() => {})

  const { getPatient } = usePatients()
  const { getPatientMedicalRecords, getPatientPrescriptions } = useMedical()
  const { user } = useAuth()
  const { tests: labTests } = useLab()

  const patient = getPatient(patientId)
  const medicalHistory = getPatientMedicalRecords(patientId)
  const prescriptions = getPatientPrescriptions(patientId)
  const latestRecord = medicalHistory.length ? medicalHistory[medicalHistory.length - 1] : null
  const labResults = labTests.filter((t) => t.patientId === patientId)

  const [activeTab, setActiveTab] = useState<ConsultTab>(initialTab)
  const [dentalHistory, setDentalHistory] = useState<DentalRecordSummary[]>([])

  // SSE stream for live lab updates — kept in state so it can be passed to LabsTab during render
  const [labStream, setLabStream] = useState<EventSource | null>(null)
  useEffect(() => {
    const es = new EventSource(`/api/lab-tests/stream?patientId=${patientId}`, { withCredentials: true })
    setLabStream(es)
    es.onerror = () => { es.close(); setLabStream(null) }
    return () => { es.close(); setLabStream(null) }
  }, [patientId])

  if (!patient || !user) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-500">Patient not found.</p>
      </div>
    )
  }

  const derivedAge =
    patient.dateOfBirth && !Number.isNaN(new Date(patient.dateOfBirth).getTime())
      ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear())
      : null
  const age = patient.ageYears ?? derivedAge

  const pid = formatPatientNumber(patient.patientNumber)
  const allergyStr = patient.allergies?.trim()
  const hasAllergy = !!allergyStr && allergyStr.toLowerCase() !== "none"

  const tabs: Array<{ id: ConsultTab; label: string }> = [
    { id: "consultation", label: "Consultation" },
    { id: "prescription", label: "Prescription" },
    { id: "labs", label: "Labs" },
    { id: "history", label: "History" },
    ...(user.role === "Dentist" ? [{ id: "dental" as ConsultTab, label: "Dental" }] : []),
  ]

  return (
    <div className="flex flex-col">
      {/* Print styles */}
      <style>{`@media print { .no-print { display:none !important; } .only-print { display:block !important; } } @media screen { .only-print { display:none; } }`}</style>

      {/* Sticky patient header */}
      <div className="sticky top-0 z-10 border-b border-teal-100 bg-white px-6 py-4 no-print">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-bold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-teal-600">P.ID: {pid || "—"}</span>
              {age != null && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">{age} yrs</span>
              )}
              {patient.gender && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700 capitalize">{patient.gender}</span>
              )}
              {patient.bloodGroup && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">{patient.bloodGroup}</span>
              )}
              {hasAllergy && (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700" title={allergyStr}>
                  ⚠ Allergies: {allergyStr}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print consultation summary">
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close consultation panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Pill tab bar */}
      <div role="tablist" className="no-print flex gap-1 overflow-x-auto border-b border-teal-100 px-6 pb-0 pt-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-teal-700 text-white"
                : "text-teal-600 hover:bg-teal-50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content area */}
      <div className="px-6 py-6 no-print">
        {activeTab === "consultation" && <ConsultationTab patient={patient} user={user} />}
        {activeTab === "prescription" && <PrescriptionTab patient={patient} user={user} />}
        {activeTab === "labs" && <LabsTab patient={patient} user={user} labStream={labStream} />}
        {activeTab === "history" && <HistoryTab patient={patient} user={user} />}
        {activeTab === "dental" && user.role === "Dentist" && (
          <DentalTab patient={patient} user={user} onRecordsChange={setDentalHistory} />
        )}
      </div>

      {/* Print section — preserved from original */}
      <div className="only-print hidden border rounded p-4 text-sm space-y-2 bg-white">
        <h2 className="text-lg font-semibold">Clinician Summary</h2>
        <div>Patient: {patient.firstName} {patient.lastName} (PID: {pid || "—"})</div>
        <div>Printed by: {user.email || user.name}</div>
        <div className="grid grid-cols-2 gap-2">
          <div>Age: {age ?? "—"}</div>
          <div>Blood: {patient.bloodGroup || "—"}</div>
          <div>Sex: {patient.gender || "—"}</div>
          <div>Date: {new Date().toLocaleString()}</div>
        </div>
        <div>
          <div className="font-semibold">Vitals</div>
          <div className="border p-2 rounded">
            BP: {latestRecord?.vitalSigns?.bloodPressure || "—"}, Temp: {latestRecord?.vitalSigns?.temperature || "—"}, HR: {latestRecord?.vitalSigns?.heartRate || "—"}, RR: {latestRecord?.vitalSigns?.respiratoryRate || "—"}, SpO₂: {latestRecord?.vitalSigns?.oxygenSaturation || "—"}
          </div>
        </div>
        <div>
          <div className="font-semibold">Symptoms / Complaints</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.symptoms || "—"}</div>
        </div>
        <div>
          <div className="font-semibold">Diagnosis</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.diagnosis || "—"}</div>
        </div>
        <div>
          <div className="font-semibold">Plan</div>
          <div className="border p-2 rounded min-h-[40px]">{latestRecord?.treatment || latestRecord?.notes || "—"}</div>
        </div>
        {user.role === "Dentist" && (
          <div>
            <div className="font-semibold">Dental</div>
            <div className="border p-2 rounded min-h-[40px]">
              {dentalHistory.length === 0 ? "—" : (() => {
                const d = dentalHistory[0]
                const toothNotes = typeof d.tooth_chart?.notes === "string" ? d.tooth_chart.notes : d.notes
                return [
                  d.diagnosis && `Diagnosis: ${d.diagnosis}`,
                  d.procedure_performed && `Procedure: ${d.procedure_performed}`,
                  toothNotes && `Tooth/Chart: ${toothNotes}`,
                  d.visit_date ? `Visit: ${String(d.visit_date).slice(0, 10)}` : "",
                ].filter(Boolean).join(" | ") || "—"
              })()}
            </div>
          </div>
        )}
        <div>
          <div className="font-semibold">Results</div>
          <div className="border p-2 rounded min-h-[40px]">
            {labResults.length === 0 ? "—" : labResults.map((l) => `${l.testName || l.testType || ""}: ${l.results || l.status || ""}`).join("; ")}
          </div>
        </div>
        <div>
          <div className="font-semibold">Prescriptions</div>
          <div className="border p-2 rounded min-h-[40px]">
            {prescriptions.length === 0 ? "—" : prescriptions.map((p) =>
              p.medications
                ?.map((m) => `${m.name || ""}${m.dosage ? " (" + m.dosage + ")" : ""}${m.frequency ? " " + m.frequency : ""}${m.duration ? " for " + m.duration : ""}`)
                .join(", ")
            ).join("; ")}
          </div>
        </div>
        <div className="pt-2">
          <div className="font-semibold">Signature / Stamp</div>
          <div className="h-12 border-b" />
        </div>
      </div>
    </div>
  )
}
