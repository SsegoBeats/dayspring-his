# Doctor Portal "Consultation Room" Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the "Consultation Room" deep teal visual identity to the Doctor Portal, split the 1,557-line `patient-consultation.tsx` into five focused tab components plus a thin shell, and migrate the consultation panel from a full-screen Dialog to a side Sheet.

**Architecture:** Five new tab components under `components/doctor/consultation-tabs/` are created first (Tasks 1–5), each owning its own state and API calls. The shell is then rewritten to ~120 lines (Task 6) — it fetches patient data, owns the SSE stream ref, renders the sticky header + pill tab bar, and mounts the active tab. The dashboard and queue are redesigned last (Tasks 7–8) since they depend on the new `ConsultTab` type exported from the shell.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (Card, Table, Sheet, AlertDialog, Dialog, Button, Input, Textarea, Label, Badge), `lib/vital-formatting` (fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2), `lib/vital-signs-validation` (validateVitalSigns, VitalSignsAlert), `lib/auth-context` (User, UserRole), `lib/patient-context` (Patient), `lib/medical-context` (useMedical), `lib/lab-context` (useLab), sonner (toast), lucide-react icons.

---

## Key Types and Imports (Read Before Starting)

```typescript
// From lib/auth-context.tsx
import type { User } from "@/lib/auth-context"  // { id, name, role: UserRole, email }

// From lib/patient-context.tsx
import type { Patient } from "@/lib/patient-context"
// Patient: { id, patientNumber?, firstName, lastName, ageYears?, dateOfBirth?, gender, phone, bloodGroup?, allergies?, ... }

// From lib/medical-context.tsx — returned by useMedical()
// addMedicalRecord(record) — saves to context (no direct API call)
// addPrescription(p) — context write
// getPatientMedicalRecords(patientId): MedicalRecord[]
// getPatientPrescriptions(patientId): Prescription[]
// updateLabResult(id, data) — context update
// refreshMedicalData() — re-fetches from server

// From lib/lab-context.tsx — returned by useLab()
// tests: LabTest[]  (each has .patientId, .id, .testType/testName, .status, .results, .orderedAt, .is_critical?, .doctorName, .orderedBy, .completedAt)
// refresh: () => void

// Formatting helpers (lib/vital-formatting.ts) — all accept string, return string
// fmtBP(s), fmtTemp(s), fmtBpm(s), fmtRR(s), fmtSpO2(s)

// Vital validation (lib/vital-signs-validation.ts)
// validateVitalSigns({ temperature?, systolicBP?, diastolicBP?, heartRate?, respiratoryRate?, oxygenSaturation? }, ageYears: number|null): VitalSignsAlert[]
// VitalSignsAlert: { type: 'critical'|'warning'|'normal', message: string, field: string }

// BP parsing for validateVitalSigns: split formData.bloodPressure on "/"
// e.g. const [sys, dia] = formData.bloodPressure.split("/").map(Number)
// Pass numFloat(formData.temperature) for temperature, numInt(formData.heartRate) for heartRate, etc.
```

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| CREATE | `components/doctor/consultation-tabs/consultation-tab.tsx` | Vitals form, symptoms/diagnosis/treatment/notes, AlertDialog for critical vitals |
| CREATE | `components/doctor/consultation-tabs/prescription-tab.tsx` | Visit type selector, medication list, save via `/api/medical/prescriptions` |
| CREATE | `components/doctor/consultation-tabs/labs-tab.tsx` | Lab results table, order dialog, SSE updates, mark-reviewed, PDF download |
| CREATE | `components/doctor/consultation-tabs/history-tab.tsx` | Obstetric assessments, medical records history, edit dialogs |
| CREATE | `components/doctor/consultation-tabs/dental-tab.tsx` | Dental records for Dentist role, edit/delete dialogs |
| REWRITE | `components/doctor/patient-consultation.tsx` | Shell only (~120 lines): patient fetch, SSE ref, sticky header, tab bar, print section |
| REDESIGN | `components/doctor/patient-queue.tsx` | Teal theme, shadcn Table replacing raw `<table>` |
| REDESIGN | `components/dashboards/doctor-dashboard.tsx` | Teal hero, stat cards with `border-t-4`, Sheet replacing Dialog, live clock |

---

## Task 1: ConsultationTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/consultation-tab.tsx`

### What this component does

Renders the vitals form (BP, temp, HR, RR, SpO2), plus symptoms, diagnosis, treatment, and notes textareas. On submit, it runs `validateVitalSigns()` — if critical alerts exist, shows an `AlertDialog` before proceeding. Saves via `addMedicalRecord()` from `useMedical()`. Ctrl+Enter keyboard shortcut submits.

### TypeScript contract (define first, then implement)

- [ ] **Step 1: Write the type contract at the top of the file**

```typescript
"use client"
import { useState, useCallback } from "react"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2 } from "@/lib/vital-formatting"
import { numFloat, numInt } from "@/lib/vital-formatting"
import { validateVitalSigns } from "@/lib/vital-signs-validation"
import type { VitalSignsAlert } from "@/lib/vital-signs-validation"
import { toast } from "sonner"

interface ConsultationTabProps {
  patient: Patient
  user: User
  onSaved?: () => void
}

interface ConsultationFormData {
  bloodPressure: string
  temperature: string
  heartRate: string
  respiratoryRate: string
  oxygenSaturation: string
  symptoms: string
  diagnosis: string
  treatmentPlan: string
  notes: string
}
```

- [ ] **Step 2: Implement the component**

```typescript
const EMPTY_FORM: ConsultationFormData = {
  bloodPressure: "", temperature: "", heartRate: "",
  respiratoryRate: "", oxygenSaturation: "",
  symptoms: "", diagnosis: "", treatmentPlan: "", notes: "",
}

export function ConsultationTab({ patient, user, onSaved }: ConsultationTabProps) {
  const { addMedicalRecord } = useMedical()
  const [form, setForm] = useState<ConsultationFormData>(EMPTY_FORM)
  const [showCriticalAlert, setShowCriticalAlert] = useState(false)
  const [criticalAlerts, setCriticalAlerts] = useState<VitalSignsAlert[]>([])

  const set = (field: keyof ConsultationFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  // Parse string form values into numbers for validateVitalSigns
  const getVitalNumbers = () => {
    const [sys, dia] = form.bloodPressure.split("/").map((s) => numFloat(s))
    return {
      systolicBP: sys ?? null,
      diastolicBP: dia ?? null,
      temperature: numFloat(form.temperature),
      heartRate: numInt(form.heartRate),
      respiratoryRate: numInt(form.respiratoryRate),
      oxygenSaturation: numInt(form.oxygenSaturation),
    }
  }

  const doSave = useCallback(() => {
    if (!form.diagnosis.trim() && !form.symptoms.trim()) {
      toast.error("Enter at least symptoms or diagnosis before saving.")
      return
    }
    addMedicalRecord({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorName: user.name,
      date: new Date().toISOString().split("T")[0],
      diagnosis: form.diagnosis,
      symptoms: form.symptoms,
      treatment: form.treatmentPlan,
      notes: form.notes,
      vitalSigns: {
        bloodPressure: form.bloodPressure,
        temperature: form.temperature,
        heartRate: form.heartRate,
        respiratoryRate: form.respiratoryRate,
        oxygenSaturation: form.oxygenSaturation,
      },
    })
    setForm(EMPTY_FORM)
    setCriticalAlerts([])
    setShowCriticalAlert(false)
    toast.success("Consultation saved successfully!")
    onSaved?.()
  }, [form, patient, user, addMedicalRecord, onSaved])

  const handleSubmit = useCallback(() => {
    const ageYears = patient.ageYears ?? null
    const alerts = validateVitalSigns(getVitalNumbers(), ageYears)
    const criticals = alerts.filter((a) => a.type === "critical")
    if (criticals.length > 0) {
      setCriticalAlerts(criticals)
      setShowCriticalAlert(true)
      return
    }
    doSave()
  }, [form, patient, doSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleSubmit() }
    },
    [handleSubmit],
  )

  const inputCls = "focus-visible:ring-teal-400"
  const skyBorder = "border-l-4 border-sky-400 pl-3"
  const amberBorder = "border-l-4 border-amber-400 pl-3"

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* Vital Signs */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-500">Vital Signs</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="bp">Blood Pressure</Label>
            <Input id="bp" placeholder="120/80" value={form.bloodPressure}
              onChange={set("bloodPressure")}
              onBlur={(e) => setForm((f) => ({ ...f, bloodPressure: fmtBP(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", amberBorder)}>
            <Label htmlFor="temp">Temperature</Label>
            <Input id="temp" placeholder="36.5" value={form.temperature}
              onChange={set("temperature")}
              onBlur={(e) => setForm((f) => ({ ...f, temperature: fmtTemp(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="hr">Heart Rate</Label>
            <Input id="hr" placeholder="72 bpm" value={form.heartRate}
              onChange={set("heartRate")}
              onBlur={(e) => setForm((f) => ({ ...f, heartRate: fmtBpm(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="rr">Respiratory Rate</Label>
            <Input id="rr" placeholder="16/min" value={form.respiratoryRate}
              onChange={set("respiratoryRate")}
              onBlur={(e) => setForm((f) => ({ ...f, respiratoryRate: fmtRR(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="spo2">Oxygen Saturation</Label>
            <Input id="spo2" placeholder="98%" value={form.oxygenSaturation}
              onChange={set("oxygenSaturation")}
              onBlur={(e) => setForm((f) => ({ ...f, oxygenSaturation: fmtSpO2(e.target.value) }))}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* Clinical Fields */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-500">Clinical Notes</p>
        {(["symptoms", "diagnosis", "treatmentPlan", "notes"] as const).map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field} className="capitalize">{field === "treatmentPlan" ? "Treatment Plan" : field}</Label>
            <Textarea
              id={field}
              value={form[field]}
              onChange={set(field)}
              className={cn("min-h-[80px]", inputCls)}
              placeholder={
                field === "symptoms" ? "Chief complaint and symptoms…" :
                field === "diagnosis" ? "Clinical diagnosis…" :
                field === "treatmentPlan" ? "Treatment plan and instructions…" :
                "Additional notes…"
              }
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} className="w-full bg-teal-700 text-white hover:bg-teal-800">
        Save Consultation <span className="ml-2 text-xs opacity-70">(Ctrl+Enter)</span>
      </Button>

      {/* Critical Vitals AlertDialog */}
      <AlertDialog open={showCriticalAlert} onOpenChange={setShowCriticalAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-700">Critical Vital Signs Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                One or more vital signs are outside safe ranges. Proceed with saving?
                <ul className="mt-2 space-y-1 text-rose-600">
                  {criticalAlerts.map((a) => (
                    <li key={a.field}>⚠ {a.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review vitals</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={doSave}>
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero errors (or only pre-existing errors unrelated to this file)

- [ ] **Step 4: Commit**

```bash
git add components/doctor/consultation-tabs/consultation-tab.tsx
git commit -m "feat(doctor): add ConsultationTab component"
```

---

## Task 2: PrescriptionTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/prescription-tab.tsx`

### What this component does

Renders a visit-type segmented button (OPD / INPATIENT / EMERGENCY), a dynamic list of medication cards, and saves via `POST /api/medical/prescriptions`. Surfaces drug interaction warnings via sonner toasts — this logic is ported exactly from the existing `handleSavePrescription` in `patient-consultation.tsx:207-278`.

- [ ] **Step 1: Write the type contract**

```typescript
"use client"
import { useState } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PrescriptionTabProps {
  patient: Patient
  user: User
  onSaved?: () => void
}

interface MedicationItem {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

interface PrescriptionFormData {
  visitType: "OPD" | "INPATIENT" | "EMERGENCY"
  medications: MedicationItem[]
}

const EMPTY_MED: MedicationItem = { name: "", dosage: "", frequency: "", duration: "", instructions: "" }
```

- [ ] **Step 2: Implement the component**

```typescript
export function PrescriptionTab({ patient, user, onSaved }: PrescriptionTabProps) {
  const { refreshMedicalData } = useMedical()
  const [form, setForm] = useState<PrescriptionFormData>({
    visitType: "OPD",
    medications: [{ ...EMPTY_MED }],
  })
  const [saving, setSaving] = useState(false)

  const addMed = () => setForm((f) => ({ ...f, medications: [...f.medications, { ...EMPTY_MED }] }))
  const removeMed = (i: number) =>
    setForm((f) => ({ ...f, medications: f.medications.filter((_, idx) => idx !== i) }))
  const setMed = (i: number, field: keyof MedicationItem, value: string) =>
    setForm((f) => {
      const meds = [...f.medications]
      meds[i] = { ...meds[i], [field]: value }
      return { ...f, medications: meds }
    })

  const handleSave = async () => {
    const valid = form.medications.filter((m) => m.name && m.dosage)
    if (valid.length === 0) { toast.error("Add at least one medication with name and dosage."); return }
    setSaving(true)
    try {
      const res = await fetch("/api/medical/prescriptions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          visitType: form.visitType,
          medications: valid.map((m) => ({ ...m, quantity: 1 })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      const validations: Array<{ severity?: string; message?: string }> = Array.isArray(data.validations) ? data.validations : []
      const hasCritical = data.hasCritical === true
      if (!res.ok) { toast.error(data.error || "Failed to save prescription"); return }
      if (hasCritical && validations.some((v) => v.severity === "Critical")) {
        toast.error("Prescription saved with critical warnings – please review.", { duration: 8000 })
      } else if (validations.length > 0) {
        toast.warning(`Prescription saved with ${validations.length} warning(s). Review recommended.`, { duration: 6000 })
      } else {
        toast.success("Prescription saved successfully!")
      }
      validations.slice(0, 5).forEach((v) => {
        if (v.severity === "Critical") toast.error(v.message || "Critical validation", { duration: 6000 })
        else if (v.severity === "Warning") toast.warning(v.message || "Warning", { duration: 5000 })
        else toast.info(v.message || "Info", { duration: 4000 })
      })
      if (form.visitType === "OPD") toast.info("Bill sent to cashier for payment collection.", { duration: 4000 })
      await refreshMedicalData()
      setForm({ visitType: "OPD", medications: [{ ...EMPTY_MED }] })
      onSaved?.()
    } catch {
      toast.error("Failed to save prescription")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Visit Type Segmented Selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Visit Type</p>
        <div className="flex overflow-hidden rounded-lg border border-teal-200">
          {(["OPD", "INPATIENT", "EMERGENCY"] as const).map((vt) => (
            <button
              key={vt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, visitType: vt }))}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                form.visitType === vt
                  ? "bg-teal-700 text-white"
                  : "border-teal-300 text-teal-700 hover:bg-teal-50",
              )}
            >
              {vt === "INPATIENT" ? "Inpatient" : vt === "EMERGENCY" ? "Emergency" : "OPD"}
            </button>
          ))}
        </div>
      </div>

      {/* Medication Cards */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Medications</p>
        {form.medications.map((med, i) => (
          <div key={i} className="rounded-xl border-l-4 border-amber-400 bg-amber-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-700">Medication {i + 1}</span>
              {form.medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="text-xs text-rose-600 hover:text-rose-800"
                  aria-label="Remove medication"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["name", "dosage", "frequency", "duration"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="capitalize">{field}</Label>
                  <Input
                    value={med[field]}
                    onChange={(e) => setMed(i, field, e.target.value)}
                    placeholder={
                      field === "name" ? "Drug name…" :
                      field === "dosage" ? "e.g. 500mg" :
                      field === "frequency" ? "e.g. TDS" : "e.g. 7 days"
                    }
                    className="focus-visible:ring-amber-400"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Instructions</Label>
              <Textarea
                value={med.instructions}
                onChange={(e) => setMed(i, "instructions", e.target.value)}
                placeholder="Take after meals…"
                className="min-h-[60px] focus-visible:ring-amber-400"
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addMed}
          className="border-dashed border-amber-400 text-amber-700 hover:bg-amber-50"
        >
          + Add Medication
        </Button>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-amber-600 text-white hover:bg-amber-700"
      >
        {saving ? "Saving…" : "Save Prescription"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/doctor/consultation-tabs/prescription-tab.tsx
git commit -m "feat(doctor): add PrescriptionTab component"
```

---

## Task 3: LabsTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/labs-tab.tsx`

### What this component does

Shows the patient's lab results in a shadcn `Table`. Accepts an `EventSource` ref from the shell for SSE live updates. Lets the doctor order a new lab test (existing `OrderLabTest` dialog), mark results reviewed (`PATCH /api/lab-tests/[id]`), and download PDF (`/api/lab-tests/pdf`). A result-detail `Dialog` shows full notes/results when a row is clicked.

- [ ] **Step 1: Write the type contract**

```typescript
"use client"
import { useState, useEffect } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrderLabTest } from "@/components/doctor/order-lab-test"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LabsTabProps {
  patient: Patient
  user: User
  labStream?: EventSource | null
}

// Shape of each lab result as returned by the SSE stream and API
interface LabRow {
  id: string
  testType?: string
  testName?: string
  status: string
  results?: string | null
  notes?: string | null
  is_critical?: boolean
  orderedAt?: string | null
  orderedDate?: string | null
  completedAt?: string | null
  completedDate?: string | null
  doctorName?: string | null
  orderedBy?: string | null
}
```

- [ ] **Step 2: Implement the component**

```typescript
export function LabsTab({ patient, user, labStream }: LabsTabProps) {
  const { tests } = useLab()
  const { updateLabResult } = useMedical()
  const [labResults, setLabResults] = useState<LabRow[]>(
    () => tests.filter((t) => t.patientId === patient.id) as LabRow[],
  )
  const [orderOpen, setOrderOpen] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  // SSE live updates
  useEffect(() => {
    if (!labStream) return
    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        if (Array.isArray(data.tests)) {
          setLabResults(data.tests.filter((t: LabRow & { patientId?: string }) => t.patientId === patient.id))
        } else if (data.id) {
          setLabResults((prev) => prev.map((r) => (r.id === data.id ? { ...r, ...data } : r)))
        }
      } catch {}
    }
    labStream.addEventListener("message", handler)
    return () => labStream.removeEventListener("message", handler)
  }, [labStream, patient.id])

  const handleMarkReviewed = async (id: string) => {
    setReviewing(id)
    try {
      const res = await fetch(`/api/lab-tests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Reviewed" }),
      })
      if (!res.ok) throw new Error("Failed to mark reviewed")
      updateLabResult(id, { status: "Reviewed" })
      setLabResults((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Reviewed" } : r)))
      toast.success("Result marked as reviewed.")
    } catch {
      toast.error("Failed to update lab result.")
    } finally {
      setReviewing(null)
    }
  }

  const statusBadgeCls = (status: string) => {
    if (status === "Reviewed") return "bg-teal-100 text-teal-700"
    if (status === "Completed") return "bg-emerald-100 text-emerald-700"
    return "bg-amber-100 text-amber-700" // Pending
  }

  const selectedLab = labResults.find((l) => l.id === selectedLabId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Lab Results</p>
        <Button
          size="sm"
          className="bg-violet-700 text-white hover:bg-violet-800"
          onClick={() => setOrderOpen(true)}
        >
          Order Lab Test
        </Button>
      </div>

      {labResults.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 className="h-8 w-8 text-violet-300" />
          <p className="text-sm text-slate-500">No lab results for this patient yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-violet-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Test</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Ordered</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labResults.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "cursor-pointer",
                    row.is_critical ? "bg-rose-50 border-l-[3px] border-rose-500" : "",
                  )}
                  onClick={() => setSelectedLabId(row.id)}
                >
                  <TableCell className="font-medium text-slate-900">
                    {row.testName || row.testType || "—"}
                    {row.is_critical && (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Critical</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusBadgeCls(row.status))}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {row.orderedAt ? new Date(row.orderedAt).toLocaleDateString() : (row.orderedDate ?? "—")}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {row.status !== "Reviewed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewing === row.id}
                          onClick={() => handleMarkReviewed(row.id)}
                          className="border-teal-400 text-teal-700 hover:bg-teal-50"
                        >
                          {reviewing === row.id ? "…" : "Mark Reviewed"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-violet-400 text-violet-700 hover:bg-violet-50"
                      >
                        <a
                          href={`/api/lab-tests/pdf?id=${row.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          PDF
                        </a>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order Lab Test dialog (existing component) */}
      <OrderLabTest
        open={orderOpen}
        onClose={() => setOrderOpen(false)}
        patientId={patient.id}
        doctorName={user.name}
      />

      {/* Result detail dialog */}
      <Dialog open={!!selectedLabId} onOpenChange={(o) => { if (!o) setSelectedLabId(null) }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>Lab Result Details</DialogTitle>
            <DialogDescription>Full result, status, and notes for this test.</DialogDescription>
          </DialogHeader>
          {selectedLab && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div><span className="text-slate-500">Test:</span> <span>{selectedLab.testName || selectedLab.testType}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="capitalize">{selectedLab.status}</span></div>
                <div><span className="text-slate-500">Ordered by:</span> <span>{selectedLab.doctorName || selectedLab.orderedBy || "—"}</span></div>
                <div><span className="text-slate-500">Ordered:</span> <span>{selectedLab.orderedAt ? new Date(selectedLab.orderedAt).toLocaleString() : (selectedLab.orderedDate ?? "—")}</span></div>
                {(selectedLab.completedAt || selectedLab.completedDate) && (
                  <div><span className="text-slate-500">Completed:</span> <span>{selectedLab.completedAt ? new Date(selectedLab.completedAt).toLocaleString() : selectedLab.completedDate}</span></div>
                )}
              </div>
              {selectedLab.results && (
                <div>
                  <div className="mb-1 font-medium">Results</div>
                  <div className="rounded border bg-slate-50 p-3 whitespace-pre-wrap">{selectedLab.results}</div>
                </div>
              )}
              {selectedLab.notes && (
                <div>
                  <div className="mb-1 font-medium">Notes</div>
                  <div className="rounded border bg-slate-50 p-3 whitespace-pre-wrap">{selectedLab.notes}</div>
                </div>
              )}
              <div className="text-right">
                <Button onClick={() => setSelectedLabId(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/doctor/consultation-tabs/labs-tab.tsx
git commit -m "feat(doctor): add LabsTab component"
```

---

## Task 4: HistoryTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/history-tab.tsx`

### What this component does

Two sections: (A) Obstetric Assessments — shows history fetched from `/api/obstetrics/assessments`, add-new form, edit dialog. (B) Medical Records — shows `getPatientMedicalRecords(patientId)` from context. The obstetric section is always rendered; for Midwife users it gets the most prominence. Medical records are always visible to all roles.

**Port exactly from the existing `patient-consultation.tsx`:**
- `validateObstetricForm()` (lines 281–298)
- `handleSaveObstetricAssessment()` (lines 301–350)
- `openEditObstetric()` (lines 352–365)
- `handleSaveObstetricEdit()` (lines 367–408)
- The obstetric edit `Dialog` JSX (lines 1422–1464)
- The useEffect that fetches obstetric history on mount (lines 515–534)

- [ ] **Step 1: Write the type contract**

```typescript
"use client"
import { useState, useEffect } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface HistoryTabProps {
  patient: Patient
  user: User
}

interface ObstetricFormState {
  visitDate: string
  gravida: string
  parity: string
  gestationalAgeWeeks: string
  edd: string
  fundalHeightCm: string
  fetalHeartRate: string
  presentation: string
  notes: string
}

// Shape of obstetric assessment rows returned by API
interface ObstetricRecord {
  id: string
  visit_date?: string | null
  gravida?: number | null
  parity?: number | null
  gestational_age_weeks?: number | null
  edd?: string | null
  fundal_height_cm?: number | null
  fetal_heart_rate?: number | null
  presentation?: string | null
  notes?: string | null
}

const EMPTY_OB_FORM: ObstetricFormState = {
  visitDate: "", gravida: "", parity: "", gestationalAgeWeeks: "",
  edd: "", fundalHeightCm: "", fetalHeartRate: "", presentation: "", notes: "",
}
```

- [ ] **Step 2: Implement the component — obstetric section**

```typescript
function validateObstetricForm(form: ObstetricFormState): string | null {
  const ga = form.gestationalAgeWeeks ? Number(form.gestationalAgeWeeks) : null
  if (ga != null && (ga < 0 || ga > 44)) return "Gestational age should be between 0 and 44 weeks"
  const fhr = form.fetalHeartRate ? Number(form.fetalHeartRate) : null
  if (fhr != null && (fhr < 80 || fhr > 220)) return "Fetal heart rate should be between 80 and 220 bpm"
  if (form.edd) {
    const edd = new Date(form.edd)
    const now = new Date()
    const diff = (edd.getFullYear() - now.getFullYear()) * 12 + (edd.getMonth() - now.getMonth())
    if (diff < -12 || diff > 6) return "EDD should be within 12 months past or 6 months future"
  }
  return null
}

export function HistoryTab({ patient, user }: HistoryTabProps) {
  const { getPatientMedicalRecords } = useMedical()
  const medicalHistory = getPatientMedicalRecords(patient.id)

  const [obstetricHistory, setObstetricHistory] = useState<ObstetricRecord[]>([])
  const [obsForm, setObsForm] = useState<ObstetricFormState>(EMPTY_OB_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ObstetricFormState>(EMPTY_OB_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  // Fetch obstetric history on mount
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(
          `/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`,
          { credentials: "include" },
        )
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
        }
      } catch { setObstetricHistory([]) }
    })()
  }, [patient.id])

  const handleSaveObstetric = async () => {
    const err = validateObstetricForm(obsForm)
    if (err) { toast.error(err); return }
    try {
      const payload: Record<string, unknown> = {
        patientId: patient.id,
        notes: obsForm.notes || null,
        presentation: obsForm.presentation || null,
      }
      if (obsForm.visitDate) payload.visitDate = obsForm.visitDate
      if (obsForm.gravida) payload.gravida = Number(obsForm.gravida)
      if (obsForm.parity) payload.parity = Number(obsForm.parity)
      if (obsForm.gestationalAgeWeeks) payload.gestationalAgeWeeks = Number(obsForm.gestationalAgeWeeks)
      if (obsForm.edd) payload.edd = obsForm.edd
      if (obsForm.fundalHeightCm) payload.fundalHeightCm = Number(obsForm.fundalHeightCm)
      if (obsForm.fetalHeartRate) payload.fetalHeartRate = Number(obsForm.fetalHeartRate)
      const res = await fetch("/api/obstetrics/assessments", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Obstetric assessment saved.")
      setObsForm(EMPTY_OB_FORM)
      const refetch = await fetch(
        `/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`,
        { credentials: "include" },
      )
      if (refetch.ok) {
        const data = await refetch.json().catch(() => ({}))
        setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save obstetric assessment")
    }
  }

  const openEdit = (a: ObstetricRecord) => {
    setEditingId(a.id)
    setEditForm({
      visitDate: a.visit_date ? String(a.visit_date).slice(0, 10) : "",
      gravida: a.gravida != null ? String(a.gravida) : "",
      parity: a.parity != null ? String(a.parity) : "",
      gestationalAgeWeeks: a.gestational_age_weeks != null ? String(a.gestational_age_weeks) : "",
      edd: a.edd ? String(a.edd).slice(0, 10) : "",
      fundalHeightCm: a.fundal_height_cm != null ? String(a.fundal_height_cm) : "",
      fetalHeartRate: a.fetal_heart_rate != null ? String(a.fetal_heart_rate) : "",
      presentation: a.presentation || "",
      notes: a.notes || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const err = validateObstetricForm(editForm)
    if (err) { toast.error(err); return }
    setSavingEdit(true)
    try {
      const payload: Record<string, unknown> = {
        presentation: editForm.presentation || null,
        notes: editForm.notes || null,
      }
      if (editForm.visitDate) payload.visitDate = editForm.visitDate
      if (editForm.gravida) payload.gravida = Number(editForm.gravida)
      if (editForm.parity) payload.parity = Number(editForm.parity)
      if (editForm.gestationalAgeWeeks) payload.gestationalAgeWeeks = Number(editForm.gestationalAgeWeeks)
      if (editForm.edd) payload.edd = editForm.edd
      if (editForm.fundalHeightCm) payload.fundalHeightCm = Number(editForm.fundalHeightCm)
      if (editForm.fetalHeartRate) payload.fetalHeartRate = Number(editForm.fetalHeartRate)
      const res = await fetch(`/api/obstetrics/assessments/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      toast.success("Obstetric assessment updated.")
      setEditingId(null)
      const refetch = await fetch(
        `/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`,
        { credentials: "include" },
      )
      if (refetch.ok) {
        const data = await refetch.json().catch(() => ({}))
        setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setSavingEdit(false) }
  }

  // Shared field list for both add and edit forms
  const obFields: Array<{ key: keyof ObstetricFormState; label: string; type?: string; placeholder?: string }> = [
    { key: "visitDate", label: "Visit Date", type: "date" },
    { key: "gravida", label: "Gravida", placeholder: "e.g. 2" },
    { key: "parity", label: "Parity", placeholder: "e.g. 1" },
    { key: "gestationalAgeWeeks", label: "Gestational Age (weeks)", placeholder: "e.g. 28" },
    { key: "edd", label: "EDD", type: "date" },
    { key: "fundalHeightCm", label: "Fundal Height (cm)", placeholder: "e.g. 28" },
    { key: "fetalHeartRate", label: "Fetal Heart Rate (bpm)", placeholder: "e.g. 140" },
    { key: "presentation", label: "Presentation", placeholder: "Cephalic, Breech…" },
  ]

  return (
    <div className="space-y-8">
      {/* Obstetric Assessments Section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Obstetric Assessments
        </p>

        {/* History cards */}
        {obstetricHistory.length > 0 && (
          <div className="mb-4 space-y-3">
            {obstetricHistory.map((a) => (
              <div key={a.id} className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm space-y-0.5">
                    {a.visit_date && <div className="font-medium">{String(a.visit_date).slice(0, 10)}</div>}
                    <div className="text-slate-600">
                      {[
                        a.gravida != null && `G${a.gravida}`,
                        a.parity != null && `P${a.parity}`,
                        a.gestational_age_weeks != null && `GA: ${a.gestational_age_weeks}wks`,
                        a.fetal_heart_rate != null && `FHR: ${a.fetal_heart_rate} bpm`,
                        a.presentation && `Presentation: ${a.presentation}`,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    {a.notes && <div className="text-slate-500 italic">{a.notes}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New assessment form */}
        <div className="rounded-xl border border-emerald-100 p-4 space-y-3">
          <p className="text-sm font-medium text-emerald-700">New Assessment</p>
          {obstetricHistory.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const last = obstetricHistory[0]
                setObsForm({
                  visitDate: last.visit_date ? String(last.visit_date).slice(0, 10) : "",
                  gravida: last.gravida != null ? String(last.gravida) : "",
                  parity: last.parity != null ? String(last.parity) : "",
                  gestationalAgeWeeks: last.gestational_age_weeks != null ? String(last.gestational_age_weeks) : "",
                  edd: last.edd ? String(last.edd).slice(0, 10) : "",
                  fundalHeightCm: last.fundal_height_cm != null ? String(last.fundal_height_cm) : "",
                  fetalHeartRate: last.fetal_heart_rate != null ? String(last.fetal_heart_rate) : "",
                  presentation: last.presentation || "",
                  notes: last.notes || "",
                })
                toast.success("Form filled from last assessment")
              }}
            >
              Copy from last assessment
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {obFields.map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={obsForm[key]}
                  onChange={(e) => setObsForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="focus-visible:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={obsForm.notes}
              onChange={(e) => setObsForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[60px] focus-visible:ring-emerald-400"
            />
          </div>
          <Button onClick={handleSaveObstetric} className="bg-emerald-600 text-white hover:bg-emerald-700">
            Save Assessment
          </Button>
        </div>
      </div>

      {/* Medical Records History */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-500">
          Recent Medical Records
        </p>
        {medicalHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No medical records yet.</p>
        ) : (
          <div className="space-y-3">
            {[...medicalHistory].reverse().slice(0, 10).map((record) => (
              <div key={record.id} className="rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium text-slate-900">{record.date}</div>
                    <div className="text-slate-700">{record.diagnosis}</div>
                    {record.symptoms && <div className="text-slate-500">Symptoms: {record.symptoms}</div>}
                  </div>
                  <div className="text-xs text-slate-400">{record.doctorName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit obstetric dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Obstetric Assessment</DialogTitle>
            <DialogDescription>Update this obstetric visit record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {obFields.map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={editForm[key]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="focus-visible:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              className="focus-visible:ring-emerald-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/doctor/consultation-tabs/history-tab.tsx
git commit -m "feat(doctor): add HistoryTab component"
```

---

## Task 5: DentalTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/dental-tab.tsx`

### What this component does

Shows dental records for the patient. Only rendered when `user.role === "Dentist"` (the shell also guards this, but the component itself is safe to render for any role). Add-new form, edit dialog (ported from `patient-consultation.tsx:1466–1513`), delete with confirmation. All via `/api/dental/records`.

**Port exactly from the existing `patient-consultation.tsx`:**
- `loadDentalHistory()` useCallback (lines 411–426)
- `handleSaveDental()` — the POST logic
- `handleSaveDentalEdit()` — the PATCH logic
- `handleDeleteDental()` — the DELETE logic (lines 494–513)
- The edit `Dialog` JSX (lines 1466–1513)
- The fetch useEffect for dental history (line 534: `void loadDentalHistory(patient.id)`)

- [ ] **Step 1: Write the type contract**

```typescript
"use client"
import { useState, useEffect, useCallback } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface DentalTabProps {
  patient: Patient
  user: User
  /** Called after any add/edit/delete so shell can refresh dental summary for print. */
  onRecordsChange?: (records: DentalRecord[]) => void
}

interface DentalRecord {
  id: string
  diagnosis?: string | null
  procedure_performed?: string | null
  visit_date?: string | null
  notes?: string | null
  tooth_chart?: { notes?: string } | null
}

interface DentalFormState {
  diagnosis: string
  procedurePerformed: string
  toothNotes: string
  visitDate: string
}

const EMPTY_DENTAL: DentalFormState = { diagnosis: "", procedurePerformed: "", toothNotes: "", visitDate: "" }
```

- [ ] **Step 2: Implement the component**

```typescript
export function DentalTab({ patient, user, onRecordsChange }: DentalTabProps) {
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [form, setForm] = useState<DentalFormState>(EMPTY_DENTAL)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DentalFormState>(EMPTY_DENTAL)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadRecords = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/dental/records?patientId=${encodeURIComponent(pid)}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const recs = Array.isArray(data.records) ? data.records : []
        setRecords(recs)
        onRecordsChange?.(recs)
      }
    } catch {}
  }, [onRecordsChange])

  useEffect(() => { void loadRecords(patient.id) }, [patient.id, loadRecords])

  const handleSave = async () => {
    if (!form.diagnosis.trim() && !form.procedurePerformed.trim()) {
      toast.error("Enter diagnosis or procedure before saving."); return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        patientId: patient.id,
        diagnosis: form.diagnosis || null,
        procedurePerformed: form.procedurePerformed || null,
        toothNotes: form.toothNotes || null,
      }
      if (form.visitDate) payload.visitDate = form.visitDate
      const res = await fetch("/api/dental/records", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Dental record saved.")
      setForm(EMPTY_DENTAL)
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save dental record")
    } finally { setSaving(false) }
  }

  const openEdit = (r: DentalRecord) => {
    setEditingId(r.id)
    const toothNotes = typeof r.tooth_chart?.notes === "string" ? r.tooth_chart.notes : (r.notes || "")
    setEditForm({
      diagnosis: r.diagnosis || "",
      procedurePerformed: r.procedure_performed || "",
      toothNotes,
      visitDate: r.visit_date ? String(r.visit_date).slice(0, 16) : "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      const payload: Record<string, unknown> = {
        diagnosis: editForm.diagnosis || null,
        procedurePerformed: editForm.procedurePerformed || null,
        toothNotes: editForm.toothNotes || null,
      }
      if (editForm.visitDate) payload.visitDate = editForm.visitDate
      const res = await fetch(`/api/dental/records/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      toast.success("Dental record updated.")
      setEditingId(null)
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally { setSavingEdit(false) }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/dental/records/${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete")
      }
      toast.success("Dental record deleted.")
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    } finally { setDeletingId(null) }
  }

  const canEdit = user.role === "Dentist" || user.role === "Hospital Admin"

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Dental Records</p>

      {/* Existing records */}
      {records.length > 0 && (
        <div className="space-y-3">
          {records.map((r) => {
            const toothNotes = typeof r.tooth_chart?.notes === "string" ? r.tooth_chart.notes : r.notes
            return (
              <div key={r.id} className="rounded-xl border-l-4 border-indigo-400 bg-indigo-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 text-sm">
                    {r.visit_date && <div className="font-medium">{String(r.visit_date).slice(0, 10)}</div>}
                    {r.diagnosis && <div className="text-slate-700">Dx: {r.diagnosis}</div>}
                    {r.procedure_performed && <div className="text-slate-700">Procedure: {r.procedure_performed}</div>}
                    {toothNotes && <div className="text-slate-500 italic">{toothNotes}</div>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deletingId === r.id}
                        onClick={() => handleDelete(r.id)}
                        className="border-rose-300 text-rose-600 hover:bg-rose-50"
                      >
                        {deletingId === r.id ? "…" : "Delete"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New record form (Dentist only) */}
      {user.role === "Dentist" && (
        <div className="rounded-xl border border-indigo-100 p-4 space-y-3">
          <p className="text-sm font-medium text-indigo-700">New Dental Record</p>
          <div className="space-y-1">
            <Label>Visit Date</Label>
            <Input
              type="datetime-local"
              value={form.visitDate}
              onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
              className="focus-visible:ring-indigo-400"
            />
          </div>
          <div className="space-y-1">
            <Label>Dental Diagnosis</Label>
            <Textarea
              value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Caries, pulpitis, periodontal disease…"
              className="min-h-[60px] focus-visible:ring-indigo-400"
            />
          </div>
          <div className="space-y-1">
            <Label>Procedure Performed</Label>
            <Textarea
              value={form.procedurePerformed}
              onChange={(e) => setForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
              placeholder="Extraction, filling, root canal, scaling…"
              className="min-h-[60px] focus-visible:ring-indigo-400"
            />
          </div>
          <div className="space-y-1">
            <Label>Tooth / Chart Notes</Label>
            <Textarea
              value={form.toothNotes}
              onChange={(e) => setForm((f) => ({ ...f, toothNotes: e.target.value }))}
              placeholder="Tooth numbers and specific findings…"
              className="focus-visible:ring-indigo-400"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {saving ? "Saving…" : "Save Dental Record"}
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Dental Record</DialogTitle>
            <DialogDescription>Update visit date, diagnosis, procedure, and tooth chart notes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Visit Date</Label>
              <Input
                type="datetime-local"
                value={editForm.visitDate}
                onChange={(e) => setEditForm((f) => ({ ...f, visitDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Dental Diagnosis</Label>
              <Textarea value={editForm.diagnosis} onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Procedure Performed</Label>
              <Textarea value={editForm.procedurePerformed} onChange={(e) => setEditForm((f) => ({ ...f, procedurePerformed: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Tooth / Chart Notes</Label>
              <Textarea value={editForm.toothNotes} onChange={(e) => setEditForm((f) => ({ ...f, toothNotes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/doctor/consultation-tabs/dental-tab.tsx
git commit -m "feat(doctor): add DentalTab component"
```

---

## Task 6: Patient Consultation Shell Rewrite

**Files:**
- Rewrite: `components/doctor/patient-consultation.tsx` (currently 1,557 lines → ~120 lines)

### What this component does

The shell owns: (1) patient fetch from context, (2) SSE stream ref, (3) sticky patient header, (4) pill-style tab bar, (5) mounting active tab component, (6) the `.only-print` print section. It does NOT own any form state or API calls.

**Print section needs:**
- `latestRecord`: from `useMedical().getPatientMedicalRecords(patientId)` → last element
- `prescriptions`: from `useMedical().getPatientPrescriptions(patientId)`
- `labResults`: from `useLab().tests.filter(t => t.patientId)`
- `dentalHistory`: via `onRecordsChange` callback from `DentalTab`

**IMPORTANT:** `onBack` prop is renamed to `onClose` in the shell. `doctor-dashboard.tsx` must also be updated to pass `onClose` instead of `onBack`.

- [ ] **Step 1: Read the current file's imports and print section carefully**

Current print section location: lines 567–644
Current print section uses: `latestRecord`, `user`, `patient`, `dentalHistory`, `labResults`, `prescriptions`

- [ ] **Step 2: Write the new shell**

```typescript
"use client"
import { useState, useEffect, useRef } from "react"
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
  onClose: () => void
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

export function PatientConsultation({ patientId, onClose, initialTab = "consultation" }: PatientConsultationProps) {
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

  // SSE stream for live lab updates
  const labStreamRef = useRef<EventSource | null>(null)
  useEffect(() => {
    const es = new EventSource(`/api/lab-tests/stream?patientId=${patientId}`, { withCredentials: true })
    labStreamRef.current = es
    return () => { es.close(); labStreamRef.current = null }
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
              <span className="font-mono text-sm text-teal-600">P.ID: {pid ? `P.${pid}` : "—"}</span>
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
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close consultation panel">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Pill tab bar */}
      <div className="no-print flex gap-1 overflow-x-auto border-b border-teal-100 px-6 pb-0 pt-4">
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
        {activeTab === "labs" && <LabsTab patient={patient} user={user} labStream={labStreamRef.current} />}
        {activeTab === "history" && <HistoryTab patient={patient} user={user} />}
        {activeTab === "dental" && user.role === "Dentist" && (
          <DentalTab patient={patient} user={user} onRecordsChange={setDentalHistory} />
        )}
      </div>

      {/* Print section — preserved from original */}
      <div className="only-print hidden border rounded p-4 text-sm space-y-2 bg-white">
        <h2 className="text-lg font-semibold">Clinician Summary</h2>
        <div>Patient: {patient.firstName} {patient.lastName} (PID: {pid ? `P.${pid}` : "—"})</div>
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
            {labResults.length === 0 ? "—" : labResults.map((l) => `${(l as { testName?: string; testType?: string }).testName || (l as { testType?: string }).testType || ""}: ${(l as { results?: string; status?: string }).results || (l as { status?: string }).status || ""}`).join("; ")}
          </div>
        </div>
        <div>
          <div className="font-semibold">Prescriptions</div>
          <div className="border p-2 rounded min-h-[40px]">
            {prescriptions.length === 0 ? "—" : prescriptions.map((p) =>
              (p.medications as Array<{ name?: string; dosage?: string; frequency?: string; duration?: string }>)
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
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors. If there are type errors from the print section's dynamic property access, cast via `as Record<string, unknown>` or define narrow inline types.

- [ ] **Step 4: Commit**

```bash
git add components/doctor/patient-consultation.tsx
git commit -m "feat(doctor): rewrite consultation shell — split into tab components"
```

---

## Task 7: Patient Queue Redesign

**Files:**
- Modify: `components/doctor/patient-queue.tsx` (109 lines → redesigned)

### What this component does

Same functionality as before: search + list of patients with a "Consult" button. Changes: teal theme, shadcn `Table` replacing raw `<table>`, proper empty/loading states.

**IMPORTANT — preserve these props exactly** (dashboard passes them):
```typescript
interface PatientQueueProps {
  onSelectPatient: (patientId: string) => void
  filterPatientIds?: string[] | null
  filterEmptyMessage?: string
}
```

Note: The dashboard currently calls `onSelectPatient(patient.id)` passing only a patient ID (no tab). The spec's `ConsultTab` second argument is optional. The queue component does NOT need to know about tabs — the dashboard handles that by always opening on the "consultation" tab by default.

- [ ] **Step 1: Read current `patient-queue.tsx` fully**

Open `components/doctor/patient-queue.tsx` — it's 109 lines. Note the existing search logic and the `filterPatientIds` guard.

- [ ] **Step 2: Rewrite the file**

```typescript
"use client"
import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { formatPatientNumber } from "@/lib/patients"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Search, Stethoscope, Users, Loader2 } from "lucide-react"

interface PatientQueueProps {
  onSelectPatient: (patientId: string) => void
  filterPatientIds?: string[] | null
  filterEmptyMessage?: string
}

export function PatientQueue({ onSelectPatient, filterPatientIds, filterEmptyMessage }: PatientQueueProps) {
  const { patients, searchPatients } = usePatients()
  const [search, setSearch] = useState("")

  const baseList = search ? searchPatients(search) : patients
  const displayedPatients =
    filterPatientIds != null
      ? baseList.filter((p) => filterPatientIds.includes(p.id))
      : baseList

  return (
    <Card className="rounded-2xl border-l-4 border-teal-600 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search patients by name, ID, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 focus-visible:ring-teal-400"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-teal-300" />
            <p className="text-sm text-slate-500">
              {filterPatientIds != null
                ? (filterEmptyMessage ?? "No patients in today's queue.")
                : search
                ? "No patients match your search."
                : "No patients in queue."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {["P.ID", "Name", "Age", "Sex", "Blood", "Phone", "Action"].map((h) => (
                  <TableHead key={h} className={`text-xs font-semibold uppercase tracking-widest text-teal-400 ${h === "Action" ? "text-right" : ""}`}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedPatients.map((patient) => {
                const pid = formatPatientNumber(patient.patientNumber)
                const derivedAge =
                  patient.dateOfBirth && !Number.isNaN(new Date(patient.dateOfBirth).getTime())
                    ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear())
                    : null
                const age = patient.ageYears ?? derivedAge ?? "—"
                const allergyStr = patient.allergies?.trim()
                const hasAllergy = !!allergyStr && allergyStr.toLowerCase() !== "none"

                return (
                  <TableRow key={patient.id} className="hover:bg-teal-50/40">
                    <TableCell className="font-mono text-sm text-teal-600">{pid ? `P.${pid}` : "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </div>
                      {hasAllergy && (
                        <span className="mt-0.5 inline-block rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          Allergies
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">{age}</TableCell>
                    <TableCell className="capitalize text-slate-600">{patient.gender || "—"}</TableCell>
                    <TableCell className="text-slate-600">{patient.bloodGroup || "—"}</TableCell>
                    <TableCell className="text-slate-600">{patient.phone || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        className="bg-teal-700 text-white hover:bg-teal-800"
                        onClick={() => onSelectPatient(patient.id)}
                      >
                        <Stethoscope className="mr-1.5 h-4 w-4" />
                        Consult
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/doctor/patient-queue.tsx
git commit -m "feat(doctor): redesign patient queue — shadcn Table + teal theme"
```

---

## Task 8: Doctor Dashboard Redesign

**Files:**
- Modify: `components/dashboards/doctor-dashboard.tsx` (243 lines → redesigned)

### What this component does

Teal hero banner (with clock), 4 stat cards with `border-t-4` accents, Today's Appointments card, Recent Medical Records list — then a Patient Queue section. A `Sheet` (replacing `Dialog`) slides in from the right when a patient is selected. The `openClinicianConsult` CustomEvent listener is preserved exactly.

**Dev text to audit and remove** (check each line):
- Line 233–242: The dead IIFE at the bottom of the file (attaches nothing — remove entirely)
- Line 72–76: decorative background blobs — remove (hero will have its own)
- `"dev only"` strings, `console.log` calls: grep the file to confirm none exist

**CRITICAL — prop changes to `PatientConsultation`:**
The current dashboard passes `onBack={() => setSelectedPatientId(null)}`. The new shell uses `onClose`. Update this prop name.

- [ ] **Step 1: Grep for dev text**

Run: `grep -n "console\.\|TODO\|dev only\|test patient\|hardcoded" components/dashboards/doctor-dashboard.tsx`
Document any findings. They'll go in the PR description.

- [ ] **Step 2: Rewrite the file**

```typescript
"use client"
import { useEffect, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { PatientConsultation } from "@/components/doctor/patient-consultation"
import type { ConsultTab } from "@/components/doctor/patient-consultation"
import { PatientQueue } from "@/components/doctor/patient-queue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useLab } from "@/lib/lab-context"
import { Users, Stethoscope, Pill, FlaskConical, Calendar } from "lucide-react"
import Link from "next/link"

interface DoctorDashboardProps {
  title?: string
  showDentalQueueFilter?: boolean
}

export function DoctorDashboard({ title, showDentalQueueFilter }: DoctorDashboardProps) {
  const { patients, getAppointmentsByDoctor } = usePatients()
  const { medicalRecords, prescriptions } = useMedical()
  const { user } = useAuth()

  const todayStr = new Date().toISOString().split("T")[0]
  const todayAppointments = user?.name ? getAppointmentsByDoctor(user.name, todayStr) : []
  const todayDentalAppointments = todayAppointments.filter(
    (a) => (a.department || "").toLowerCase() === "dental",
  )
  const dentalQueuePatientIds = todayDentalAppointments.map((a) => a.patientId)
  const [queueView, setQueueView] = useState<"all" | "dental">("all")

  const todayRecords = medicalRecords.filter(
    (mr) => mr.date === todayStr && mr.doctorName === user?.name,
  )
  const activePrescriptions = prescriptions.filter(
    (p) => p.status === "active" && p.doctorName === user?.name,
  )

  // Pending lab reviews — labs with status "Completed" but not yet "Reviewed" for this doctor
  const { tests: allLabTests } = useLab()
  const pendingLabReviews = allLabTests.filter(
    (t) => t.status === "Completed" && (t as { doctorName?: string }).doctorName === user?.name,
  ).length

  // Consultation Sheet state
  interface SelectedPatient { id: string; tab: ConsultTab }
  const [selected, setSelected] = useState<SelectedPatient | null>(null)
  const [pendingNotifId, setPendingNotifId] = useState<string | null>(null)

  const handleSelectPatient = (patientId: string) => {
    setSelected({ id: patientId, tab: "consultation" })
  }
  const handleClose = () => setSelected(null)

  // Live clock
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(tick)
  }, [])

  // Portal title pill
  const portalTitle =
    user?.role === "Dentist" ? "Dentist Portal" :
    user?.role === "Midwife" ? "Midwifery Portal" :
    "Clinician Portal"

  // openClinicianConsult CustomEvent — MUST be preserved exactly
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {}
        if (detail.patientId) {
          setSelected({ id: detail.patientId, tab: (detail.initialTab as ConsultTab) || "labs" })
          if (detail.notificationId) setPendingNotifId(detail.notificationId)
        }
      } catch {}
    }
    window.addEventListener("openClinicianConsult", handler)
    return () => window.removeEventListener("openClinicianConsult", handler)
  }, [])

  // Auto-mark notification read when consultation opens
  useEffect(() => {
    if (selected && pendingNotifId) {
      ;(async () => {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [pendingNotifId] }),
          })
        } catch {}
        setPendingNotifId(null)
      })()
    }
  }, [selected, pendingNotifId])

  const statCards = [
    {
      label: "Total Patients",
      value: patients.length,
      accent: "border-teal-500",
      iconBg: "bg-teal-100",
      icon: <Users className="h-5 w-5 text-teal-600" />,
      sub: "Registered patients",
    },
    {
      label: "Today's Consultations",
      value: todayRecords.length,
      accent: "border-sky-500",
      iconBg: "bg-sky-100",
      icon: <Stethoscope className="h-5 w-5 text-sky-600" />,
      sub: "Completed today",
    },
    {
      label: "Active Prescriptions",
      value: activePrescriptions.length,
      accent: "border-amber-500",
      iconBg: "bg-amber-100",
      icon: <Pill className="h-5 w-5 text-amber-600" />,
      sub: "Currently active",
    },
    {
      label: "Pending Lab Reviews",
      value: pendingLabReviews,
      accent: "border-violet-500",
      iconBg: "bg-violet-100",
      icon: <FlaskConical className="h-5 w-5 text-violet-600" />,
      sub: "Awaiting review",
      pulse: pendingLabReviews > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-900 p-8 text-white shadow-xl">
        <div className="absolute -left-8 -top-8 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl" />
        <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium">
              <Stethoscope className="h-4 w-4" />
              {title || portalTitle}
            </span>
            <h1 className="text-3xl font-bold tracking-tight">
              Your patients. Your decisions. Your practice.
            </h1>
            <p className="mt-2 text-teal-200">
              Consultations, prescriptions, labs, and records — all in one place.
            </p>
          </div>
          {/* Shift Snapshot */}
          <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-4 text-white md:min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Shift Snapshot</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-teal-200">Consultations today</span>
                <span className="font-bold">{todayRecords.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-teal-200">Pending lab reviews</span>
                <span className="font-bold">{pendingLabReviews}</span>
              </div>
              <div className="mt-2 text-center font-mono text-lg font-bold">{clockTime}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className={`overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm border-t-4 ${card.accent}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">{card.label}</CardTitle>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>{card.icon}</div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold text-slate-900 ${card.pulse ? "animate-pulse" : ""}`}>
                {card.value}
              </div>
              <p className="text-xs text-slate-500">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Appointments */}
      <Card className="rounded-2xl border border-teal-100 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Today&apos;s Appointments</CardTitle>
          <Link href="/appointments/calendar" className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
            <Calendar className="h-3.5 w-3.5" />
            View calendar
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{todayAppointments.length}</div>
          <p className="text-xs text-slate-500">Scheduled for you today</p>
        </CardContent>
      </Card>

      {/* Recent Medical Records */}
      <Card className="rounded-2xl border border-teal-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Recent Medical Records</CardTitle>
        </CardHeader>
        <CardContent>
          {medicalRecords.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No medical records yet.</p>
          ) : (
            <div className="space-y-3">
              {[...medicalRecords].slice(-5).reverse().map((record) => (
                <div key={record.id} className="rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{record.patientName}</p>
                      <p className="text-sm text-slate-600">{record.diagnosis}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{record.date}</p>
                      <p className="text-xs text-slate-500">{record.doctorName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Queue */}
      <div>
        <h3 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Patient Queue</h3>
        {showDentalQueueFilter && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Queue:</span>
            <button
              type="button"
              onClick={() => setQueueView("all")}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${queueView === "all" ? "bg-teal-700 text-white border-teal-700" : "border-teal-200 text-teal-700 hover:bg-teal-50"}`}
            >
              All patients
            </button>
            <button
              type="button"
              onClick={() => setQueueView("dental")}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${queueView === "dental" ? "bg-teal-700 text-white border-teal-700" : "border-teal-200 text-teal-700 hover:bg-teal-50"}`}
            >
              Today&apos;s dental appointments ({dentalQueuePatientIds.length})
            </button>
          </div>
        )}
        <PatientQueue
          onSelectPatient={handleSelectPatient}
          filterPatientIds={showDentalQueueFilter && queueView === "dental" ? dentalQueuePatientIds : undefined}
          filterEmptyMessage="No patients with dental appointments today."
        />
      </div>

      {/* Consultation Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) handleClose() }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:w-[85vw] sm:max-w-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Patient Consultation</SheetTitle>
            <SheetDescription>Consultation, prescription, labs, and patient history.</SheetDescription>
          </SheetHeader>
          {selected && (
            <PatientConsultation
              key={selected.id}
              patientId={selected.id}
              initialTab={selected.tab}
              onClose={handleClose}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `pnpm tsc --noEmit`
Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add components/dashboards/doctor-dashboard.tsx
git commit -m "feat(doctor): Consultation Room dashboard redesign — hero, stats, Sheet"
```

---

## Task 9: Build Gate

**Files:**
- No file changes — verification only

This task confirms the full build passes after all changes. `pnpm build` runs TypeScript compilation, dead-code elimination, and page rendering checks. Zero errors = done.

- [ ] **Step 1: Run the full build**

```bash
pnpm build
```

Expected output:
```
✓ Compiled successfully
✓ Linting and checking validity of types
   Route (pages/app) ...
```

No TypeScript errors. No "Module not found" errors.

- [ ] **Step 2: If build fails — common causes to check**

| Error | Likely cause |
|---|---|
| `Cannot find module './consultation-tabs/consultation-tab'` | File created in wrong directory or wrong export name |
| `Property 'onClose' does not exist` | Dashboard still passing `onBack` instead of `onClose` |
| `Type 'string' is not assignable to type 'ConsultTab'` | Initial tab string not narrowed to `ConsultTab` type |
| `Object is possibly 'null'` | SSE ref passed to LabsTab before stream opens |
| `Property 'X' does not exist on type 'Patient'` | Accessing a field not in the `Patient` interface |

- [ ] **Step 3: Audit duplicate API routes**

```bash
ls app/api/doctor-schedules app/api/clinician-schedules 2>/dev/null || echo "paths not found — adjust for your structure"
```

Document findings in the commit message or PR body. Do NOT delete either route this sprint.

- [ ] **Step 4: Commit build verification**

```bash
git commit --allow-empty -m "chore: verify build passes post-doctor-portal-redesign"
```

---

## Dependency Summary

```
Tasks 1–5  →  independent (can be reviewed in parallel)
Task 6     →  depends on Tasks 1–5 (imports all tab components)
Task 7     →  independent of Task 6
Task 8     →  depends on Task 6 (imports ConsultTab type, uses onClose prop)
Task 9     →  depends on Tasks 6–8
```

---

*Plan authored: 2026-03-21 — Dayspring HIS Doctor Portal "Consultation Room" Redesign*
