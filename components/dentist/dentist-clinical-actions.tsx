"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Pill, FlaskConical, Scan, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { usePatients } from "@/lib/patient-context"

type Section = "rx" | "lab" | "radiology" | null

interface PatientOption {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
}

function PatientSearch({
  value,
  onChange,
}: {
  value: PatientOption | null
  onChange: (p: PatientOption | null) => void
}) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient name or number…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => {
          onChange(null)
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-cyan-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-cyan-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-cyan-50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange({
                  id: p.id,
                  patientNumber: (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patientNumber?: string; patient_number?: string }).patient_number || "",
                  firstName: (p as { firstName?: string; first_name?: string }).firstName || (p as { firstName?: string; first_name?: string }).first_name || "",
                  lastName: (p as { lastName?: string; last_name?: string }).lastName || (p as { lastName?: string; last_name?: string }).last_name || "",
                })
                setQuery("")
                setOpen(false)
              }}
            >
              <span className="font-medium text-slate-800">
                {(p as { firstName?: string; first_name?: string }).firstName || (p as { firstName?: string; first_name?: string }).first_name}{" "}
                {(p as { lastName?: string; last_name?: string }).lastName || (p as { lastName?: string; last_name?: string }).last_name}
              </span>
              <span className="ml-2 text-slate-400 text-xs">
                {(p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patientNumber?: string; patient_number?: string }).patient_number}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WritePrescription() {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [medications, setMedications] = useState([
    { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
  ])
  const [priority, setPriority] = useState("Routine")
  const [clinicalNotes, setClinicalNotes] = useState("")
  const [saving, setSaving] = useState(false)

  function addMedication() {
    setMedications((m) => [...m, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }])
  }

  function updateMed(i: number, field: string, val: string) {
    setMedications((m) => m.map((med, idx) => idx === i ? { ...med, [field]: val } : med))
  }

  function removeMed(i: number) {
    setMedications((m) => m.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!patient) { toast.error("Select a patient"); return }
    const incomplete = medications.some((m) => !m.name || !m.dosage || !m.frequency || !m.duration)
    if (incomplete) { toast.error("Complete all medication fields (name, dosage, frequency, duration)"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/medical/prescriptions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          medications: medications.map((m) => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
            instructions: m.instructions || null,
          })),
          priority,
          clinicalNotes: clinicalNotes || null,
          visitType: "OPD",
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to create prescription")
      }
      const data = await res.json()
      toast.success(`Prescription created${data.prescription?.id ? ` (#${String(data.prescription.id).slice(0, 8)})` : ""}`)
      setPatient(null)
      setMedications([{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }])
      setClinicalNotes("")
      setPriority("Routine")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create prescription")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Patient</Label>
        <PatientSearch value={patient} onChange={setPatient} />
      </div>

      <div className="space-y-1">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="focus:ring-cyan-400">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Routine", "Urgent", "Stat"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {medications.map((med, i) => (
        <div key={i} className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-cyan-600">Medication {i + 1}</p>
            {medications.length > 1 && (
              <button type="button" onClick={() => removeMed(i)}
                className="text-xs text-rose-500 hover:text-rose-700">Remove</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Medication name</Label>
              <Input value={med.name} onChange={(e) => updateMed(i, "name", e.target.value)}
                placeholder="e.g. Amoxicillin" className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dosage</Label>
              <Input value={med.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)}
                placeholder="e.g. 500mg" className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Input value={med.frequency} onChange={(e) => updateMed(i, "frequency", e.target.value)}
                placeholder="e.g. 3x daily" className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Duration</Label>
              <Input value={med.duration} onChange={(e) => updateMed(i, "duration", e.target.value)}
                placeholder="e.g. 7 days" className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instructions (optional)</Label>
              <Input value={med.instructions} onChange={(e) => updateMed(i, "instructions", e.target.value)}
                placeholder="e.g. After meals" className="focus-visible:ring-cyan-400" />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm"
        className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
        onClick={addMedication}>
        + Add another medication
      </Button>

      <div className="space-y-1">
        <Label>Clinical notes (optional)</Label>
        <Textarea value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)}
          placeholder="Post-procedure antibiotic course, analgesics for pain management…"
          className="focus-visible:ring-cyan-400" />
      </div>

      <Button onClick={handleSubmit} disabled={saving}
        className="bg-cyan-600 hover:bg-cyan-700 text-white w-full">
        {saving ? "Submitting…" : "Submit Prescription"}
      </Button>
    </div>
  )
}

function OrderLabTest() {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [testName, setTestName] = useState("")
  const [testType, setTestType] = useState("")
  const [priority, setPriority] = useState("Routine")
  const [specimenType, setSpecimenType] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const COMMON_DENTAL_LABS = [
    "Full Blood Count", "Blood Glucose (Fasting)", "HbA1c",
    "Bleeding Time", "Clotting Time", "PT/INR",
    "HIV Screening", "Hepatitis B Surface Antigen",
    "Urea & Electrolytes", "Liver Function Tests",
  ]

  async function handleSubmit() {
    if (!patient) { toast.error("Select a patient"); return }
    if (!testName) { toast.error("Enter a test name"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/lab-tests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          testName,
          testType: testType || testName,
          priority,
          specimenType: specimenType || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to order lab test")
      }
      const data = await res.json()
      const id = data.labTest?.id ?? data.id
      toast.success(`Lab order submitted${id ? ` (#${String(id).slice(0, 8)})` : ""}`)
      setPatient(null)
      setTestName("")
      setTestType("")
      setSpecimenType("")
      setNotes("")
      setPriority("Routine")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to order lab test")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Patient</Label>
        <PatientSearch value={patient} onChange={setPatient} />
      </div>

      <div className="space-y-1">
        <Label>Test name</Label>
        <Input value={testName} onChange={(e) => setTestName(e.target.value)}
          list="dental-lab-tests"
          placeholder="Start typing or pick from common tests…"
          className="focus-visible:ring-cyan-400" />
        <datalist id="dental-lab-tests">
          {COMMON_DENTAL_LABS.map((t) => <option key={t} value={t} />)}
        </datalist>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="focus:ring-cyan-400"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Routine", "Urgent", "Stat"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Specimen type (optional)</Label>
          <Input value={specimenType} onChange={(e) => setSpecimenType(e.target.value)}
            placeholder="e.g. Whole blood, Serum"
            className="focus-visible:ring-cyan-400" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Clinical notes (optional)</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Reason for test, pre-op screening, diabetic patient…"
          className="focus-visible:ring-cyan-400" />
      </div>

      <Button onClick={handleSubmit} disabled={saving}
        className="bg-cyan-600 hover:bg-cyan-700 text-white w-full">
        {saving ? "Submitting…" : "Submit Lab Order"}
      </Button>
    </div>
  )
}

const DENTAL_SCAN_TYPES = [
  "OPG Panoramic", "Periapical", "Bitewing",
  "CBCT", "Occlusal", "Lateral Cephalometric", "Other",
]

function RequestRadiology() {
  const [patient, setPatient] = useState<PatientOption | null>(null)
  const [scanType, setScanType] = useState("")
  const [indication, setIndication] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!patient) { toast.error("Select a patient"); return }
    if (!scanType) { toast.error("Select a scan type"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/lab-tests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          testName: scanType,
          testType: scanType,
          priority: "Routine",
          notes: indication || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Failed to request radiology")
      }
      const data = await res.json()
      const id = data.labTest?.id ?? data.id
      toast.success(`Radiology request submitted${id ? ` (#${String(id).slice(0, 8)})` : ""}`)
      setPatient(null)
      setScanType("")
      setIndication("")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to request radiology")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Patient</Label>
        <PatientSearch value={patient} onChange={setPatient} />
      </div>
      <div className="space-y-1">
        <Label>Scan type</Label>
        <Select value={scanType} onValueChange={setScanType}>
          <SelectTrigger className="focus:ring-cyan-400">
            <SelectValue placeholder="Select scan type…" />
          </SelectTrigger>
          <SelectContent>
            {DENTAL_SCAN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Clinical indication</Label>
        <Textarea value={indication} onChange={(e) => setIndication(e.target.value)}
          placeholder="Suspected periapical abscess, pre-implant assessment, impacted wisdom tooth…"
          className="min-h-[72px] focus-visible:ring-cyan-400" />
      </div>
      <Button onClick={handleSubmit} disabled={saving}
        className="bg-cyan-600 hover:bg-cyan-700 text-white w-full">
        {saving ? "Submitting…" : "Submit Radiology Request"}
      </Button>
    </div>
  )
}

interface SectionConfig {
  id: Section
  label: string
  icon: React.ReactNode
  description: string
  content: React.ReactNode
}

export function DentistClinicalActions({ defaultSection }: { defaultSection?: Section }) {
  const [open, setOpen] = useState<Section>(defaultSection ?? "rx")

  const sections: SectionConfig[] = [
    {
      id: "rx",
      label: "Write Prescription",
      icon: <Pill className="h-4 w-4" />,
      description: "Prescribe post-procedure medications for your patient",
      content: <WritePrescription />,
    },
    {
      id: "lab",
      label: "Order Lab Test",
      icon: <FlaskConical className="h-4 w-4" />,
      description: "Request blood work or specimen analysis",
      content: <OrderLabTest />,
    },
    {
      id: "radiology",
      label: "Request Radiology",
      icon: <Scan className="h-4 w-4" />,
      description: "Order dental X-rays, OPG panoramic, CBCT, and more",
      content: <RequestRadiology />,
    },
  ]

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div
          key={s.id}
          className={cn(
            "rounded-2xl border transition-all",
            open === s.id
              ? "border-cyan-200 bg-white shadow-sm"
              : "border-slate-100 bg-slate-50/50",
          )}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left"
            onClick={() => setOpen(open === s.id ? null : s.id)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-xl p-2 transition-colors",
                open === s.id ? "bg-cyan-50 text-cyan-600" : "bg-slate-100 text-slate-500",
              )}>
                {s.icon}
              </div>
              <div>
                <p className={cn(
                  "text-sm font-semibold",
                  open === s.id ? "text-cyan-700" : "text-slate-700",
                )}>
                  {s.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-4 w-4 text-slate-400 transition-transform",
              open === s.id && "rotate-180",
            )} />
          </button>
          {open === s.id && (
            <div className="px-5 pb-5 border-t border-cyan-50">
              <div className="pt-4">{s.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
