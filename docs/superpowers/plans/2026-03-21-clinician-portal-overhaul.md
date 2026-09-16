# Clinician Portal Full Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Doctor/Clinician portal to production quality: fix a bug in the documents API, add four new consultation tabs (Allergies, Chronic Conditions, Immunizations, Documents), create a dedicated `/clinician` home page with exports, add a clinician notification bell, and add medical-records + prescriptions export datasets.

**Architecture:** Tasks 1–2 are quick fixes. Tasks 3–6 build the four new consultation tabs independently and wire them into the shell. Task 7 creates the dedicated clinician home page with export UI. Task 8 adds the two new export datasets (required by Task 7). Task 9 adds the notification bell. Task 10 is the build gate. Each task is a standalone commit.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui (Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Textarea, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Card, CardContent, CardHeader, CardTitle, Separator), `useMedical()` from `@/lib/medical-context`, `sonner` (toast), `lucide-react`, zod (for export dataset filters).

---

## Key Types (Read Before Starting)

```typescript
// lib/medical-context.tsx — all via useMedical()
interface Allergy {
  id: string; patientId: string; allergen: string; reaction: string
  severity: "mild" | "moderate" | "severe"; diagnosedDate: string; notes?: string
}
interface ChronicCondition {
  id: string; patientId: string; condition: string; diagnosedDate: string
  status: "active" | "managed" | "resolved"; medications?: string[]; notes?: string
}
interface Immunization {
  id: string; patientId: string; vaccineName: string; dateAdministered: string
  nextDueDate?: string; administeredBy: string; batchNumber?: string; notes?: string
}
interface MedicalDocument {
  id: string; patientId: string; patientName: string
  documentType: "lab-report" | "xray" | "scan" | "prescription" | "consent-form" | "other"
  fileName: string; fileUrl: string; uploadedBy: string; uploadedDate: string; notes?: string
}

// Functions returned by useMedical():
getPatientAllergies(patientId: string): Allergy[]
addAllergy(a: Omit<Allergy,"id">): Promise<void>
getPatientChronicConditions(patientId: string): ChronicCondition[]
addChronicCondition(c: Omit<ChronicCondition,"id">): Promise<void>
updateChronicCondition(id: string, updates: Partial<ChronicCondition>): Promise<void>
getPatientImmunizations(patientId: string): Immunization[]
addImmunization(i: Omit<Immunization,"id">): Promise<void>
getPatientDocuments(patientId: string): MedicalDocument[]
addMedicalDocument(d: Omit<MedicalDocument,"id">): Promise<void>

// lib/auth-context.tsx
import type { User } from "@/lib/auth-context"  // { id, name, role, email }

// lib/patient-context.tsx
import type { Patient } from "@/lib/patient-context"

// ConsultTab type lives in components/doctor/patient-consultation.tsx
export type ConsultTab = "consultation" | "prescription" | "labs" | "history" | "dental"
// Will be extended in Task 6 to include 4 new IDs
```

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| MODIFY | `app/api/medical/documents/route.ts` | Fix wrong permission check on POST |
| CREATE | `components/doctor/consultation-tabs/allergies-tab.tsx` | Allergy list + add allergy dialog |
| CREATE | `components/doctor/consultation-tabs/chronic-conditions-tab.tsx` | Chronic conditions list + add/update status dialog |
| CREATE | `components/doctor/consultation-tabs/immunizations-tab.tsx` | Immunization list + add immunization dialog |
| CREATE | `components/doctor/consultation-tabs/documents-tab.tsx` | Document list + add document URL dialog |
| MODIFY | `components/doctor/patient-consultation.tsx` | Extend ConsultTab type, import + mount 4 new tabs |
| CREATE | `app/clinician/page.tsx` | Dedicated clinician home with export UI |
| CREATE | `lib/exports/datasets/medical-records.ts` | MedicalRecordsDataset class |
| CREATE | `lib/exports/datasets/prescriptions.ts` | PrescriptionsDataset class |
| MODIFY | `lib/exports/registry.ts` | Register medical_records + prescriptions datasets |
| MODIFY | `app/api/exports/direct/route.ts` | Add medical_records + prescriptions to z.enum |
| CREATE | `components/doctor/clinician-notification-bell.tsx` | Notification bell for clinician portal |
| MODIFY | `components/dashboards/doctor-dashboard.tsx` | Mount notification bell in header |

---

## Task 1: Fix Documents API Permission Bug

**Files:**
- Modify: `app/api/medical/documents/route.ts`

The POST handler uses `can(auth.role, "medical", "read")` (should be `"create"`), which blocks writing documents for roles that can write but not necessarily have extra read grants.

- [ ] **Step 1: Read the file to find the exact line**

```bash
grep -n '"read"' app/api/medical/documents/route.ts
```

Expected output: one line near line 51 with `can(auth.role, "medical", "read")` inside the POST handler.

- [ ] **Step 2: Apply the fix**

In `app/api/medical/documents/route.ts`, change the POST permission check from `"read"` to `"create"`:

```typescript
// BEFORE (inside POST handler, after auth check):
if (!can(auth.role, "medical", "read"))

// AFTER:
if (!can(auth.role, "medical", "create"))
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add app/api/medical/documents/route.ts
git commit -m "fix(api): correct documents POST permission check (read → create)"
```

---

## Task 2: AllergiesTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/allergies-tab.tsx`

Displays patient allergies in a table. Severity is color-coded: `severe` = rose, `moderate` = amber, `mild` = emerald. "Add Allergy" button opens a dialog to record a new allergen.

- [ ] **Step 1: Create the file**

```typescript
"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, ShieldAlert } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const severityVariant: Record<string, string> = {
  severe: "bg-rose-100 text-rose-800 border-rose-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  mild: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export function AllergiesTab({ patient, user }: Props) {
  const { getPatientAllergies, addAllergy } = useMedical()
  const allergies = getPatientAllergies(patient.id)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    allergen: "", reaction: "", severity: "mild" as "mild" | "moderate" | "severe",
    diagnosedDate: "", notes: "",
  })

  function resetForm() {
    setForm({ allergen: "", reaction: "", severity: "mild", diagnosedDate: "", notes: "" })
  }

  async function handleSave() {
    if (!form.allergen.trim() || !form.reaction.trim()) {
      toast.error("Allergen and reaction are required")
      return
    }
    setSaving(true)
    try {
      await addAllergy({
        patientId: patient.id,
        allergen: form.allergen.trim(),
        reaction: form.reaction.trim(),
        severity: form.severity,
        diagnosedDate: form.diagnosedDate || new Date().toISOString().slice(0, 10),
        notes: form.notes.trim() || undefined,
      })
      toast.success("Allergy recorded")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save allergy")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-rose-800">
          <ShieldAlert className="h-4 w-4" />
          Allergies
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Allergy
        </Button>
      </div>

      {allergies.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No allergies on record.</p>
      ) : (
        <div className="rounded-xl border border-rose-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-rose-50">
                <TableHead className="text-rose-700">Allergen</TableHead>
                <TableHead className="text-rose-700">Severity</TableHead>
                <TableHead className="text-rose-700">Reaction</TableHead>
                <TableHead className="text-rose-700">Diagnosed</TableHead>
                <TableHead className="text-rose-700">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allergies.map((a) => (
                <TableRow key={a.id} className="hover:bg-rose-50/40">
                  <TableCell className="font-medium">{a.allergen}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${severityVariant[a.severity] ?? ""}`}>
                      {a.severity}
                    </span>
                  </TableCell>
                  <TableCell>{a.reaction}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{a.diagnosedDate ? String(a.diagnosedDate).slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Allergy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="allergen">Allergen *</Label>
              <Input id="allergen" value={form.allergen} onChange={(e) => setForm((p) => ({ ...p, allergen: e.target.value }))} placeholder="e.g. Penicillin" />
            </div>
            <div>
              <Label htmlFor="reaction">Reaction *</Label>
              <Input id="reaction" value={form.reaction} onChange={(e) => setForm((p) => ({ ...p, reaction: e.target.value }))} placeholder="e.g. Hives, Anaphylaxis" />
            </div>
            <div>
              <Label htmlFor="sev">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((p) => ({ ...p, severity: v as typeof form.severity }))}>
                <SelectTrigger id="sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="diagDate">Diagnosed Date</Label>
              <Input id="diagDate" type="date" value={form.diagnosedDate} onChange={(e) => setForm((p) => ({ ...p, diagnosedDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="algNotes">Notes</Label>
              <Textarea id="algNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-rose-600 hover:bg-rose-700 text-white">
              {saving ? "Saving…" : "Save Allergy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 3: Commit**

```bash
git add components/doctor/consultation-tabs/allergies-tab.tsx
git commit -m "feat(doctor): add AllergiesTab consultation component"
```

---

## Task 3: ChronicConditionsTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/chronic-conditions-tab.tsx`

Lists chronic conditions. Status badges: `active` = rose, `managed` = amber, `resolved` = emerald. Allows adding a new condition and updating the status of existing ones via PATCH.

- [ ] **Step 1: Create the file**

```typescript
"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Activity } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const statusVariant: Record<string, string> = {
  active: "bg-rose-100 text-rose-800 border-rose-200",
  managed: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export function ChronicConditionsTab({ patient, user }: Props) {
  const { getPatientChronicConditions, addChronicCondition, updateChronicCondition } = useMedical()
  const conditions = getPatientChronicConditions(patient.id)

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    condition: "", diagnosedDate: "", status: "active" as "active" | "managed" | "resolved",
    medications: "", notes: "",
  })

  function resetForm() {
    setForm({ condition: "", diagnosedDate: "", status: "active", medications: "", notes: "" })
  }

  async function handleAdd() {
    if (!form.condition.trim()) { toast.error("Condition name is required"); return }
    setSaving(true)
    try {
      await addChronicCondition({
        patientId: patient.id,
        condition: form.condition.trim(),
        diagnosedDate: form.diagnosedDate || new Date().toISOString().slice(0, 10),
        status: form.status,
        medications: form.medications.trim() ? form.medications.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success("Condition recorded")
      setAddOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save condition")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: "active" | "managed" | "resolved") {
    setUpdatingId(id)
    try {
      await updateChronicCondition(id, { status: newStatus })
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
          <Activity className="h-4 w-4" />
          Chronic Conditions
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No chronic conditions on record.</p>
      ) : (
        <div className="rounded-xl border border-amber-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-50">
                <TableHead className="text-amber-700">Condition</TableHead>
                <TableHead className="text-amber-700">Status</TableHead>
                <TableHead className="text-amber-700">Diagnosed</TableHead>
                <TableHead className="text-amber-700">Medications</TableHead>
                <TableHead className="text-amber-700">Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((c) => (
                <TableRow key={c.id} className="hover:bg-amber-50/40">
                  <TableCell className="font-medium">{c.condition}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusVariant[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{c.diagnosedDate ? String(c.diagnosedDate).slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">
                    {c.medications?.length ? c.medications.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{c.notes || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={c.status}
                      disabled={updatingId === c.id}
                      onValueChange={(v) => handleStatusChange(c.id, v as typeof c.status)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="managed">Managed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Chronic Condition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cond">Condition *</Label>
              <Input id="cond" value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. Type 2 Diabetes" />
            </div>
            <div>
              <Label htmlFor="condStatus">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as typeof form.status }))}>
                <SelectTrigger id="condStatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="managed">Managed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="condDiag">Diagnosed Date</Label>
              <Input id="condDiag" type="date" value={form.diagnosedDate} onChange={(e) => setForm((p) => ({ ...p, diagnosedDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="condMeds">Medications (comma-separated)</Label>
              <Input id="condMeds" value={form.medications} onChange={(e) => setForm((p) => ({ ...p, medications: e.target.value }))} placeholder="e.g. Metformin, Insulin" />
            </div>
            <div>
              <Label htmlFor="condNotes">Notes</Label>
              <Textarea id="condNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? "Saving…" : "Save Condition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/doctor/consultation-tabs/chronic-conditions-tab.tsx
git commit -m "feat(doctor): add ChronicConditionsTab consultation component"
```

---

## Task 4: ImmunizationsTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/immunizations-tab.tsx`

Displays immunization records. Rows where `nextDueDate` is in the past are highlighted with an amber warning. "Add Immunization" button opens a dialog.

- [ ] **Step 1: Create the file**

```typescript
"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Syringe, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

export function ImmunizationsTab({ patient, user }: Props) {
  const { getPatientImmunizations, addImmunization } = useMedical()
  const immunizations = getPatientImmunizations(patient.id)
  const today = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vaccineName: "", dateAdministered: today, nextDueDate: "",
    administeredBy: "", batchNumber: "", notes: "",
  })

  function resetForm() {
    setForm({ vaccineName: "", dateAdministered: today, nextDueDate: "", administeredBy: "", batchNumber: "", notes: "" })
  }

  async function handleSave() {
    if (!form.vaccineName.trim() || !form.dateAdministered) {
      toast.error("Vaccine name and date administered are required")
      return
    }
    setSaving(true)
    try {
      await addImmunization({
        patientId: patient.id,
        vaccineName: form.vaccineName.trim(),
        dateAdministered: form.dateAdministered,
        nextDueDate: form.nextDueDate || undefined,
        administeredBy: form.administeredBy.trim() || user.name,
        batchNumber: form.batchNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success("Immunization recorded")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save immunization")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-teal-800">
          <Syringe className="h-4 w-4" />
          Immunizations
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Immunization
        </Button>
      </div>

      {immunizations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No immunization records on file.</p>
      ) : (
        <div className="rounded-xl border border-teal-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-teal-50">
                <TableHead className="text-teal-700">Vaccine</TableHead>
                <TableHead className="text-teal-700">Administered</TableHead>
                <TableHead className="text-teal-700">Next Due</TableHead>
                <TableHead className="text-teal-700">Administered By</TableHead>
                <TableHead className="text-teal-700">Batch #</TableHead>
                <TableHead className="text-teal-700">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {immunizations.map((imm) => {
                const overdue = !!imm.nextDueDate && String(imm.nextDueDate).slice(0, 10) < today
                return (
                  <TableRow key={imm.id} className={cn("hover:bg-teal-50/40", overdue && "bg-amber-50/50")}>
                    <TableCell className="font-medium">{imm.vaccineName}</TableCell>
                    <TableCell className="text-sm">{String(imm.dateAdministered).slice(0, 10)}</TableCell>
                    <TableCell className="text-sm">
                      {imm.nextDueDate ? (
                        <span className={cn("flex items-center gap-1", overdue && "text-amber-700 font-medium")}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {String(imm.nextDueDate).slice(0, 10)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{imm.administeredBy || "—"}</TableCell>
                    <TableCell className="text-slate-500 text-sm font-mono text-xs">{imm.batchNumber || "—"}</TableCell>
                    <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{imm.notes || "—"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Immunization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="vax">Vaccine Name *</Label>
              <Input id="vax" value={form.vaccineName} onChange={(e) => setForm((p) => ({ ...p, vaccineName: e.target.value }))} placeholder="e.g. Hepatitis B" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dateAdm">Date Administered *</Label>
                <Input id="dateAdm" type="date" value={form.dateAdministered} onChange={(e) => setForm((p) => ({ ...p, dateAdministered: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nextDue">Next Due Date</Label>
                <Input id="nextDue" type="date" value={form.nextDueDate} onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="admBy">Administered By</Label>
              <Input id="admBy" value={form.administeredBy} onChange={(e) => setForm((p) => ({ ...p, administeredBy: e.target.value }))} placeholder={user.name} />
            </div>
            <div>
              <Label htmlFor="batch">Batch Number</Label>
              <Input id="batch" value={form.batchNumber} onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="immNotes">Notes</Label>
              <Textarea id="immNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-teal-700 hover:bg-teal-800 text-white">
              {saving ? "Saving…" : "Save Immunization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/doctor/consultation-tabs/immunizations-tab.tsx
git commit -m "feat(doctor): add ImmunizationsTab consultation component"
```

---

## Task 5: DocumentsTab Component

**Files:**
- Create: `components/doctor/consultation-tabs/documents-tab.tsx`

Lists clinical documents for the patient. Each row has a download link (if `fileUrl` is set). "Add Document" button opens a dialog that accepts a URL (not a file upload widget—the API stores fileUrl references). Document types from the context interface: `"lab-report" | "xray" | "scan" | "prescription" | "consent-form" | "other"`.

- [ ] **Step 1: Create the file**

```typescript
"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, FileText, ExternalLink } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const DOC_TYPES = [
  { value: "lab-report", label: "Lab Report" },
  { value: "xray", label: "X-Ray" },
  { value: "scan", label: "Scan" },
  { value: "prescription", label: "Prescription" },
  { value: "consent-form", label: "Consent Form" },
  { value: "other", label: "Other" },
] as const

export function DocumentsTab({ patient, user }: Props) {
  const { getPatientDocuments, addMedicalDocument } = useMedical()
  const documents = getPatientDocuments(patient.id)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    documentType: "other" as "lab-report" | "xray" | "scan" | "prescription" | "consent-form" | "other",
    fileName: "", fileUrl: "", notes: "",
  })

  function resetForm() {
    setForm({ documentType: "other", fileName: "", fileUrl: "", notes: "" })
  }

  async function handleSave() {
    if (!form.fileUrl.trim()) { toast.error("File URL is required"); return }
    setSaving(true)
    try {
      await addMedicalDocument({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        documentType: form.documentType,
        fileName: form.fileName.trim() || form.fileUrl.split("/").pop() || "document",
        fileUrl: form.fileUrl.trim(),
        uploadedBy: user.name,
        uploadedDate: new Date().toISOString().slice(0, 10),
        notes: form.notes.trim() || undefined,
      })
      toast.success("Document added")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to add document")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-700">
          <FileText className="h-4 w-4" />
          Clinical Documents
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-slate-700 hover:bg-slate-800 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No documents on file.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Type</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {DOC_TYPES.find((t) => t.value === doc.documentType)?.label ?? doc.documentType}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{doc.fileName}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{String(doc.uploadedDate).slice(0, 10)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{doc.uploadedBy || "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{doc.notes || "—"}</TableCell>
                  <TableCell>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.fileName}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-teal-600 hover:text-teal-800">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Clinical Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="docType">Document Type</Label>
              <Select value={form.documentType} onValueChange={(v) => setForm((p) => ({ ...p, documentType: v as typeof form.documentType }))}>
                <SelectTrigger id="docType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fileUrl">File URL *</Label>
              <Input id="fileUrl" value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="fileName">Display Name</Label>
              <Input id="fileName" value={form.fileName} onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))} placeholder="Optional — defaults to filename from URL" />
            </div>
            <div>
              <Label htmlFor="docNotes">Notes</Label>
              <Textarea id="docNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-slate-700 hover:bg-slate-800 text-white">
              {saving ? "Saving…" : "Add Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/doctor/consultation-tabs/documents-tab.tsx
git commit -m "feat(doctor): add DocumentsTab consultation component"
```

---

## Task 6: Wire New Tabs into Patient Consultation Shell

**Files:**
- Modify: `components/doctor/patient-consultation.tsx`

Extend `ConsultTab` type with four new IDs. Import and mount the four new tabs. Add them to the tab bar (visible to all roles).

- [ ] **Step 1: Read the current shell**

Read `components/doctor/patient-consultation.tsx` in full (it is ~231 lines after the previous redesign).

- [ ] **Step 2: Apply all changes**

**2a — Extend ConsultTab type** (line 17, currently):
```typescript
// BEFORE:
export type ConsultTab = "consultation" | "prescription" | "labs" | "history" | "dental"

// AFTER:
export type ConsultTab = "consultation" | "prescription" | "labs" | "history" | "dental" | "allergies" | "conditions" | "immunizations" | "documents"
```

**2b — Add four imports** after `import { DentalTab }`:
```typescript
import { AllergiesTab } from "./consultation-tabs/allergies-tab"
import { ChronicConditionsTab } from "./consultation-tabs/chronic-conditions-tab"
import { ImmunizationsTab } from "./consultation-tabs/immunizations-tab"
import { DocumentsTab } from "./consultation-tabs/documents-tab"
```

**2c — Add four entries to the `tabs` array** (after the dental entry):
```typescript
// BEFORE (end of tabs array):
  ...(user.role === "Dentist" ? [{ id: "dental" as ConsultTab, label: "Dental" }] : []),
]

// AFTER:
  ...(user.role === "Dentist" ? [{ id: "dental" as ConsultTab, label: "Dental" }] : []),
  { id: "allergies" as ConsultTab, label: "Allergies" },
  { id: "conditions" as ConsultTab, label: "Conditions" },
  { id: "immunizations" as ConsultTab, label: "Immunizations" },
  { id: "documents" as ConsultTab, label: "Documents" },
]
```

**2d — Add four mount lines** in the tab content area (after the dental mount block):
```typescript
// After:
{activeTab === "dental" && user.role === "Dentist" && (
  <DentalTab patient={patient} user={user} onRecordsChange={setDentalHistory} />
)}

// Add:
{activeTab === "allergies" && <AllergiesTab patient={patient} user={user} />}
{activeTab === "conditions" && <ChronicConditionsTab patient={patient} user={user} />}
{activeTab === "immunizations" && <ImmunizationsTab patient={patient} user={user} />}
{activeTab === "documents" && <DocumentsTab patient={patient} user={user} />}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 4: Verify ESLint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/doctor/patient-consultation.tsx
git commit -m "feat(doctor): wire Allergies/Conditions/Immunizations/Documents tabs into consultation shell"
```

---

## Task 7: Export Datasets — MedicalRecords + Prescriptions

**Files:**
- Create: `lib/exports/datasets/medical-records.ts`
- Create: `lib/exports/datasets/prescriptions.ts`
- Modify: `lib/exports/registry.ts`
- Modify: `app/api/exports/direct/route.ts`

Add two new exportable datasets that DoctorDashboard (and the new `/clinician` page) will use.

### 7a — MedicalRecordsDataset

- [ ] **Step 1: Create `lib/exports/datasets/medical-records.ts`**

```typescript
import { z } from "zod"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

function getQuery(ctx: ExportContext) {
  return ctx.runQuery ?? (async (text: string, params?: any[]) => {
    const { query } = await import("@/lib/db")
    return query(text, params)
  })
}

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  recordedByUserId: z.boolean().optional(),
})

export class MedicalRecordsDataset implements Dataset {
  name = "medical_records"
  defaultColumns = [
    "record_date",
    "patient_number",
    "patient_name",
    "doctor_name",
    "diagnosis",
    "symptoms",
    "treatment",
    "bp",
    "temperature",
    "heart_rate",
    "notes",
  ]

  validateFilters(input: any) {
    return Filter.parse(input)
  }

  async queryPage(
    ctx: ExportContext,
    f: z.infer<typeof Filter>,
    cursor?: { after?: string },
    pageSize = 5000,
  ) {
    const after = cursor?.after ?? null
    const doctorId = f.recordedByUserId ? ctx.userId : null
    const run = getQuery(ctx)
    const { rows } = await run(
      `
      SELECT
        mr.date AS record_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        u.name AS doctor_name,
        mr.diagnosis,
        mr.symptoms,
        mr.treatment,
        mr.vital_signs->>'bloodPressure' AS bp,
        mr.vital_signs->>'temperature' AS temperature,
        mr.vital_signs->>'heartRate' AS heart_rate,
        mr.notes
      FROM medical_records mr
      JOIN patients p ON p.id = mr.patient_id
      LEFT JOIN users u ON u.id = mr.doctor_id
      WHERE ($1::timestamp IS NULL OR mr.date >= $1)
        AND ($2::timestamp IS NULL OR mr.date <= $2)
        AND ($3::timestamp IS NULL OR mr.date > $3)
        AND ($5::uuid IS NULL OR mr.doctor_id = $5)
      ORDER BY mr.date ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, doctorId],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].record_date } : undefined
    return { rows, nextCursor }
  }
}
```

### 7b — PrescriptionsDataset

- [ ] **Step 2: Create `lib/exports/datasets/prescriptions.ts`**

```typescript
import { z } from "zod"
import type { Dataset, ExportContext } from "@/lib/exports/registry"

function getQuery(ctx: ExportContext) {
  return ctx.runQuery ?? (async (text: string, params?: any[]) => {
    const { query } = await import("@/lib/db")
    return query(text, params)
  })
}

const Filter = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  recordedByUserId: z.boolean().optional(),
})

export class PrescriptionsDataset implements Dataset {
  name = "prescriptions"
  defaultColumns = [
    "prescription_date",
    "patient_number",
    "patient_name",
    "doctor_name",
    "visit_type",
    "medications",
  ]

  validateFilters(input: any) {
    return Filter.parse(input)
  }

  async queryPage(
    ctx: ExportContext,
    f: z.infer<typeof Filter>,
    cursor?: { after?: string },
    pageSize = 5000,
  ) {
    const after = cursor?.after ?? null
    const doctorId = f.recordedByUserId ? ctx.userId : null
    const run = getQuery(ctx)
    const { rows } = await run(
      `
      SELECT
        pr.created_at AS prescription_date,
        p.patient_number,
        CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
        u.name AS doctor_name,
        pr.visit_type,
        (
          SELECT STRING_AGG(
            CONCAT(m->>'name', COALESCE(' (' || m->>'dosage' || ')', ''), COALESCE(' ' || m->>'frequency', ''), COALESCE(' for ' || m->>'duration', '')),
            '; '
          )
          FROM jsonb_array_elements(pr.medications) AS m
        ) AS medications
      FROM prescriptions pr
      JOIN patients p ON p.id = pr.patient_id
      LEFT JOIN users u ON u.id = pr.doctor_id
      WHERE ($1::timestamp IS NULL OR pr.created_at >= $1)
        AND ($2::timestamp IS NULL OR pr.created_at <= $2)
        AND ($3::timestamp IS NULL OR pr.created_at > $3)
        AND ($5::uuid IS NULL OR pr.doctor_id = $5)
      ORDER BY pr.created_at ASC
      LIMIT $4
      `,
      [f.from ?? null, f.to ?? null, after, pageSize, doctorId],
    )
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].prescription_date } : undefined
    return { rows, nextCursor }
  }
}
```

### 7c — Register in registry.ts

- [ ] **Step 3: Modify `lib/exports/registry.ts`**

Add imports after the DentalDataset import (line 90):
```typescript
import { MedicalRecordsDataset } from "@/lib/exports/datasets/medical-records"
import { PrescriptionsDataset } from "@/lib/exports/datasets/prescriptions"
```

Add to the Datasets object (after `dental: new DentalDataset()`):
```typescript
  medical_records: new MedicalRecordsDataset(),
  prescriptions: new PrescriptionsDataset(),
```

### 7d — Add to z.enum in route

- [ ] **Step 4: Modify `app/api/exports/direct/route.ts`**

In the `Schema` z.enum array, add after `"dental"`:
```typescript
    "medical_records",
    "prescriptions",
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 6: Commit**

```bash
git add lib/exports/datasets/medical-records.ts lib/exports/datasets/prescriptions.ts lib/exports/registry.ts app/api/exports/direct/route.ts
git commit -m "feat(exports): add medical_records and prescriptions export datasets"
```

---

## Task 8: Dedicated /clinician Home Page

**Files:**
- Create: `app/clinician/page.tsx`

The clinician home page renders `DoctorDashboard` first, then below it adds an export panel with date range pickers + CSV/XLSX/PDF export buttons for the `medical_records` and `prescriptions` datasets (following the exact same pattern as `components/dashboards/dentist-dashboard.tsx`).

- [ ] **Step 1: Read dentist-dashboard.tsx to understand the exact export pattern**

Read `components/dashboards/dentist-dashboard.tsx` lines 1-120. Note:
- How it imports DoctorDashboard
- The date state (`from`, `to`)
- The `exportMineOnly` checkbox
- The `handleExport(format)` function that calls `POST /api/exports/direct`
- The `ExportCard` UI layout

- [ ] **Step 2: Create `app/clinician/page.tsx`**

The page must:
1. Be a client component (`"use client"`)
2. Check role — redirect to `/dashboard` if user is not a Clinician/Dentist/Midwife (roles that use the doctor dashboard)
3. Render a teal-themed export card below the DoctorDashboard
4. Use the `medical_records` and `prescriptions` datasets

```typescript
"use client"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Download, FileText, Table2 } from "lucide-react"

const CLINICIAN_ROLES = ["Clinician", "Dentist", "Midwife", "Hospital Admin"]

export default function ClinicianPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const todayStr = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(todayStr)
  const [to, setTo] = useState(todayStr)
  const [exportMineOnly, setExportMineOnly] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user && !CLINICIAN_ROLES.includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user, loading, router])

  async function handleExport(dataset: "medical_records" | "prescriptions", format: "csv" | "xlsx" | "pdf") {
    setExporting(`${dataset}-${format}`)
    try {
      const res = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          format,
          filters: {
            from: from ? `${from}T00:00:00.000Z` : undefined,
            to: to ? `${to}T23:59:59.999Z` : undefined,
            recordedByUserId: exportMineOnly || undefined,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error ?? "Export failed")
        return
      }
      const blob = await res.blob()
      const ext = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"
      const label = dataset === "medical_records" ? "medical-records" : "prescriptions"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${label}-${from}-to-${to}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  if (loading || !user) return null

  return (
    <div className="space-y-6">
      <DoctorDashboard />

      {/* Export Panel */}
      <div className="mx-auto max-w-6xl px-4 pb-8">
        <Card className="border border-teal-100 shadow-sm">
          <CardHeader className="border-b border-teal-50 bg-teal-50/40 pb-4">
            <CardTitle className="flex items-center gap-2 text-teal-900">
              <Download className="h-5 w-5" />
              Export Records
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            {/* Date range + filter */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="expFrom" className="text-teal-700">From</Label>
                <Input id="expFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expTo" className="text-teal-700">To</Label>
                <Input id="expTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 pb-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportMineOnly}
                  onChange={(e) => setExportMineOnly(e.target.checked)}
                  className="rounded border-teal-300 accent-teal-700"
                />
                My records only
              </label>
            </div>

            <Separator className="bg-teal-100" />

            {/* Medical Records exports */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <FileText className="h-4 w-4 text-teal-600" />
                Medical Records
              </p>
              <div className="flex flex-wrap gap-2">
                {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    disabled={!!exporting}
                    onClick={() => handleExport("medical_records", fmt)}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    {exporting === `medical_records-${fmt}` ? "Exporting…" : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Prescriptions exports */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Table2 className="h-4 w-4 text-teal-600" />
                Prescriptions
              </p>
              <div className="flex flex-wrap gap-2">
                {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    disabled={!!exporting}
                    onClick={() => handleExport("prescriptions", fmt)}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    {exporting === `prescriptions-${fmt}` ? "Exporting…" : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm tsc --noEmit
```

Expected: zero new errors

- [ ] **Step 4: Commit**

```bash
git add app/clinician/page.tsx
git commit -m "feat(clinician): add dedicated clinician home page with medical records + prescriptions export"
```

---

## Task 9: Clinician Notification Bell

**Files:**
- Create: `components/doctor/clinician-notification-bell.tsx`
- Modify: `components/dashboards/doctor-dashboard.tsx`

The bell polls `/api/notifications` every 60 seconds. It shows unread notifications relevant to clinicians: lab result notifications and patient-assignment notifications. Clicking a notification marks it read and emits the `openClinicianConsult` event when a `patientId` is available.

- [ ] **Step 1: Read the nurse notification bell for the pattern**

Read `components/nursing/nurse-notification-bell.tsx` lines 1-100 to understand:
- The polling useEffect with interval
- The Popover layout (Bell button + popover list)
- The `timeAgo()` helper
- How unread count badge works

- [ ] **Step 2: Create `components/doctor/clinician-notification-bell.tsx`**

```typescript
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface ClinicianNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

/** Returns true if the notification title/message is relevant to a clinician. */
function isClinicianNotif(n: ClinicianNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return (
    t.includes("lab") ||
    t.includes("result") ||
    t.includes("consult") ||
    t.includes("patient assigned") ||
    t.includes("triage") ||
    m.includes("lab") ||
    m.includes("result")
  )
}

export function ClinicianNotificationBell() {
  const [notifications, setNotifications] = useState<ClinicianNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: ClinicianNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isClinicianNotif))
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    intervalRef.current = setInterval(() => void fetchNotifications(), 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      )
    } catch {}
  }

  function handleNotifClick(n: ClinicianNotif) {
    if (!n.read_at) void markRead(n.id)
    const patientId = n.payload?.patientId
    if (patientId) {
      window.dispatchEvent(new CustomEvent("openClinicianConsult", { detail: { patientId, notifId: n.id } }))
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-teal-100 hover:bg-teal-800/60">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">Notifications</p>
          {unreadCount > 0 && (
            <p className="text-xs text-slate-500">{unreadCount} unread</p>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-teal-50/60",
                  !n.read_at && "bg-teal-50",
                )}
              >
                <p className={cn("text-sm font-medium", !n.read_at ? "text-teal-900" : "text-slate-700")}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 3: Read the doctor-dashboard.tsx header section**

Read `components/dashboards/doctor-dashboard.tsx` to find:
- The hero banner JSX (the `rounded-3xl bg-gradient-to-r` div)
- Where the shift clock and other header actions are rendered
- Where to insert the bell

- [ ] **Step 4: Mount the bell in doctor-dashboard.tsx**

In the hero banner's top-right action area, add the `ClinicianNotificationBell` import and mount it next to the existing actions.

Import at top of file:
```typescript
import { ClinicianNotificationBell } from "@/components/doctor/clinician-notification-bell"
```

In the hero banner JSX, find the flex row with the Settings/Print/Close buttons and add `<ClinicianNotificationBell />` as the first item in that row (or wherever a bell icon makes sense).

- [ ] **Step 5: Verify TypeScript and lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add components/doctor/clinician-notification-bell.tsx components/dashboards/doctor-dashboard.tsx
git commit -m "feat(clinician): add notification bell to clinician/doctor dashboard"
```

---

## Task 10: Build Gate

**Files:** None (validation only)

- [ ] **Step 1: Run full TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: zero errors

- [ ] **Step 2: Run ESLint**

```bash
pnpm lint
```

Expected: zero errors

- [ ] **Step 3: Run production build**

```bash
pnpm build
```

Expected: build completes with exit code 0. No type errors. No missing module errors.

- [ ] **Step 4: If build passes, commit a build-gate confirmation**

```bash
git add -A
git commit -m "chore(clinician): build gate — all TypeScript, lint, and build pass" --allow-empty
```

---

## Summary

| Task | Description | Key Files |
|---|---|---|
| 1 | Fix documents API bug | `app/api/medical/documents/route.ts` |
| 2 | AllergiesTab | `consultation-tabs/allergies-tab.tsx` |
| 3 | ChronicConditionsTab | `consultation-tabs/chronic-conditions-tab.tsx` |
| 4 | ImmunizationsTab | `consultation-tabs/immunizations-tab.tsx` |
| 5 | DocumentsTab | `consultation-tabs/documents-tab.tsx` |
| 6 | Wire 4 new tabs into shell | `patient-consultation.tsx` |
| 7 | Export datasets | `lib/exports/datasets/medical-records.ts`, `prescriptions.ts`, `registry.ts`, `route.ts` |
| 8 | Dedicated /clinician page | `app/clinician/page.tsx` |
| 9 | Notification bell | `clinician-notification-bell.tsx`, `doctor-dashboard.tsx` |
| 10 | Build gate | — |
