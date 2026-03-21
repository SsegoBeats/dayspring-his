# Doctor Portal — "Consultation Room" Redesign
## Design Specification

**Date:** 2026-03-21
**Sprint:** Doctor Portal Redesign
**Theme:** Consultation Room — Deep Teal
**Roles in scope:** Clinician, Dentist, Midwife
**Status:** Approved for implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Color System](#2-color-system)
3. [File Structure](#3-file-structure)
4. [Section 1 — Dashboard Redesign](#4-section-1--dashboard-redesign-doctor-dashboardtsx)
5. [Section 2 — Patient Queue Redesign](#5-section-2--patient-queue-redesign-patient-queuetsx)
6. [Section 3 — Consultation Shell Rewrite](#6-section-3--patient-consultation-shell-rewrite)
7. [Section 4 — Tab Components](#7-section-4--tab-components)
8. [Section 5 — Bug Fixes](#8-section-5--bug-fixes)
9. [Section 6 — Implementation Order](#9-section-6--implementation-order)
10. [API Routes](#10-api-routes)

---

## 1. Overview

The Doctor Portal currently serves three roles — **Clinician**, **Dentist**, and **Midwife** — all sharing one monolithic `doctor-dashboard.tsx` (243 lines) and `patient-consultation.tsx` (1,557 lines). This redesign sprint:

- Applies a unified "Consultation Room" deep teal visual identity across all three role variants
- Splits `patient-consultation.tsx` into five focused tab components plus a thin shell (~120 lines)
- Upgrades the consultation panel from a full-screen `Dialog` to a side `Sheet` (85vw, right-anchored)
- Replaces raw HTML `<table>` in `patient-queue.tsx` with the shadcn `Table` component
- Resolves type safety issues (21+ `any` types), removes `window.confirm`, and eliminates manual SSE token extraction
- The split and visual redesign are performed in a single pass — no intermediate commits with a half-split state

All three roles share the same files. Role-specific UI (e.g. Dental tab, portal title pill) is conditionally rendered via the `user.role` prop.

---

## 2. Color System

### Token Map

| Token | Tailwind Class | Usage |
|---|---|---|
| Primary | `teal-700` / `teal-800` | Buttons, active tabs, card accents |
| Surface | `white` / `teal-50` | Card backgrounds |
| Vitals accent | `sky-500` | Vitals input borders, vitals history cards |
| Prescription accent | `amber-500` | Prescription inputs, Rx cards |
| Lab accent | `violet-500` | Lab order badges, lab history cards |
| Obstetric accent | `emerald-500` | Obstetric history cards |
| Dental accent | `indigo-500` | Dental records cards |
| Critical / Alert | `rose-600` | Critical vital alerts, allergy badges |
| Hero gradient | `from-teal-900 via-teal-800 to-cyan-900` | Dashboard hero banner |

### Typography & Shape Rules

| Element | Class(es) |
|---|---|
| Sectioned card | `rounded-2xl border-l-4 border-teal-600` |
| Sheet panel | `side="right" w-full sm:w-[85vw] sm:max-w-none overflow-y-auto p-0` |
| Active tab pill | `bg-teal-700 text-white` |
| Inactive tab pill | `text-teal-600 hover:bg-teal-50` |
| Stat card | `overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm` with `border-t-4` accent |
| Patient ID | `font-mono text-teal-600` |
| Info chip | `rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700` |
| Allergy badge | `rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700` |
| Section label | `text-xs font-semibold uppercase tracking-widest text-<accent>-500` |

---

## 3. File Structure

```
components/doctor/
  patient-consultation.tsx              ← Shell only (~120 lines, REWRITE)
  patient-queue.tsx                     ← Redesign (109 lines → shadcn Table)
  consultation-tabs/
    consultation-tab.tsx                ← CREATE: vitals + symptoms + diagnosis + treatment
    prescription-tab.tsx                ← CREATE: medications, visit type, billing
    labs-tab.tsx                        ← CREATE: order, view, review, PDF
    history-tab.tsx                     ← CREATE: obstetric assessments + medical records
    dental-tab.tsx                      ← CREATE: dental records (Dentist role only)

components/dashboards/
  doctor-dashboard.tsx                  ← Redesign (243 lines)
```

All new tab files live under `components/doctor/consultation-tabs/`. The shell `patient-consultation.tsx` remains at its current path — only its contents are rewritten.

---

## 4. Section 1 — Dashboard Redesign (`doctor-dashboard.tsx`)

### 4.1 Hero Banner

```tsx
<div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-900 p-8 text-white shadow-xl">
  {/* Decorative blobs */}
  <div className="absolute -left-8 -top-8 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl" />
  <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />

  {/* Portal pill — role-aware */}
  <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium">
    <Stethoscope className="h-4 w-4" />
    {portalTitle}  {/* "Clinician Portal" | "Dentist Portal" | "Midwifery Portal" */}
  </span>

  <h1 className="text-3xl font-bold tracking-tight">
    Your patients. Your decisions. Your practice.
  </h1>
  <p className="mt-2 text-teal-200">
    Consultations, prescriptions, labs, and records — all in one place.
  </p>

  {/* Quick action cards — right column */}
  {/* Shift Snapshot card */}
</div>
```

**Portal pill derivation:** The `title` prop is passed from the parent page. Default is `"Clinician Portal"`. Map `"Dentist"` role → `"Dentist Portal"`, `"Midwife"` role → `"Midwifery Portal"`.

**Quick action cards:** Frosted-glass style matching the nurse portal — `border border-white/15 bg-white/10 rounded-xl p-4 text-white`.

**Shift Snapshot card (right column):**
- Today's consultation count
- Pending lab reviews count
- Live clock (`clockTime` state, updated every second via `setInterval`)

### 4.2 Clock State

```typescript
const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())

useEffect(() => {
  const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
  return () => clearInterval(tick)
}, [])
```

### 4.3 Stat Cards (4-card grid)

Layout: `grid gap-4 md:grid-cols-4`

Each card: `overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm` with a `border-t-4` top accent.

| # | Label | Accent | Icon | Icon bg |
|---|---|---|---|---|
| 1 | Total Patients | `border-teal-500` | `Users` | `bg-teal-100` |
| 2 | Today's Consultations | `border-sky-500` | `Stethoscope` | `bg-sky-100` |
| 3 | Active Prescriptions | `border-amber-500` | `Pill` | `bg-amber-100` |
| 4 | Pending Lab Reviews | `border-violet-500` | `FlaskConical` | `bg-violet-100` |

Card 4 (Pending Lab Reviews): add `animate-pulse` to the count value when count > 0.

### 4.4 Patient Queue Section

```tsx
<h3 className="text-xl font-bold tracking-tight text-slate-900">Patient Queue</h3>
<div className="mt-4 rounded-2xl border-l-4 border-teal-600">
  <PatientQueue onSelectPatient={handleSelectPatient} />
</div>
```

No Badge, no dev/placeholder text in this heading or its container.

### 4.5 Dialog → Sheet Migration

**Remove these imports:**
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
```

**Add these imports:**
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
```

**Replace Dialog JSX with:**
```tsx
<Sheet open={!!selected} onOpenChange={handleClose}>
  <SheetContent side="right" className="w-full sm:w-[85vw] sm:max-w-none overflow-y-auto p-0">
    <SheetHeader className="sr-only">
      <SheetTitle>Patient Consultation</SheetTitle>
      <SheetDescription>Consultation, prescription, labs, and patient history.</SheetDescription>
    </SheetHeader>
    {selected && (
      <PatientConsultation
        patientId={selected.id}
        initialTab={selected.tab}
        onClose={handleClose}
      />
    )}
  </SheetContent>
</Sheet>
```

The `SheetHeader` is `sr-only` (screen-reader only) because the visible patient header is rendered inside `PatientConsultation` itself.

### 4.6 CustomEvent Listener — Must Preserve

The `openClinicianConsult` custom event listener MUST be preserved exactly as-is:

```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const { patientId, initialTab, notificationId } = (e as CustomEvent).detail
    setSelected({ id: patientId, tab: initialTab })
    // mark notification read if notificationId present
  }
  window.addEventListener("openClinicianConsult", handler)
  return () => window.removeEventListener("openClinicianConsult", handler)
}, [])
```

This event is fired from the notifications panel to deep-link directly into a patient consultation at a specific tab. Breaking this listener will silently break notification-driven navigation.

### 4.7 Dev Text Removal

During implementation, audit both `doctor-dashboard.tsx` and `patient-consultation.tsx` for any placeholder or debug strings (e.g. `// TODO`, `"dev only"`, console.log calls, hardcoded test patient IDs). Document each occurrence with file path and line number in the PR description before removing.

---

## 5. Section 2 — Patient Queue Redesign (`patient-queue.tsx`)

### 5.1 Component Props (preserved exactly)

```typescript
interface PatientQueueProps {
  onSelectPatient: (patientId: string, tab?: ConsultTab) => void
  filterPatientIds?: string[]
  emptyMessage?: string
}
```

### 5.2 Card Wrapper

```tsx
<Card className="rounded-2xl border-l-4 border-teal-600 bg-white shadow-sm">
  <CardHeader>
    {/* Search input */}
    <Input
      placeholder="Search patients..."
      className="focus-visible:ring-teal-400"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </CardHeader>
  <CardContent className="p-0">
    {/* Table */}
  </CardContent>
</Card>
```

### 5.3 Table (shadcn)

Replace raw `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` with:

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="text-xs font-semibold uppercase tracking-widest text-teal-400">Patient</TableHead>
      <TableHead className="text-xs font-semibold uppercase tracking-widest text-teal-400">ID</TableHead>
      <TableHead className="text-xs font-semibold uppercase tracking-widest text-teal-400">Age / Gender</TableHead>
      <TableHead className="text-xs font-semibold uppercase tracking-widest text-teal-400">Allergies</TableHead>
      <TableHead className="text-xs font-semibold uppercase tracking-widest text-teal-400">Action</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {patients.map((p) => (
      <TableRow key={p.id}>
        <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
        <TableCell className="font-mono text-sm text-teal-600">{p.patient_id}</TableCell>
        <TableCell className="text-slate-600">{p.age} / {p.gender}</TableCell>
        <TableCell>
          {p.allergies?.length ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
              {p.allergies.join(", ")}
            </span>
          ) : (
            <span className="text-xs text-slate-400">None</span>
          )}
        </TableCell>
        <TableCell>
          <Button
            size="sm"
            className="bg-teal-700 hover:bg-teal-800 text-white"
            onClick={() => onSelectPatient(p.id)}
          >
            Consult
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### 5.4 Empty State

```tsx
{patients.length === 0 && (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <Users className="h-10 w-10 text-teal-300" />
    <p className="text-sm text-slate-500">{emptyMessage ?? "No patients in queue."}</p>
  </div>
)}
```

### 5.5 Loading State

```tsx
{loading && (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
  </div>
)}
```

---

## 6. Section 3 — Patient Consultation Shell Rewrite

### 6.1 Responsibilities (~120 lines total)

The shell owns:
1. Fetching patient data (single `useEffect` on `patientId`)
2. Rendering the sticky patient header
3. Rendering the pill-style tab bar
4. Initializing the SSE stream (passed as prop to `LabsTab`)
5. Rendering the active tab component
6. Rendering the `.only-print` print section

The shell does NOT own any tab-specific state, form state, or API calls.

### 6.2 Props

```typescript
interface PatientConsultationProps {
  patientId: string
  initialTab?: ConsultTab
  onClose: () => void
}
```

### 6.3 ConsultTab Type

```typescript
type ConsultTab = "consultation" | "prescription" | "labs" | "history" | "dental"
```

Export this type from `patient-consultation.tsx` so `doctor-dashboard.tsx` and `patient-queue.tsx` can import it.

### 6.4 Sticky Patient Header

This is a plain `<div>`, NOT a `<SheetHeader>` — the SheetHeader in the dashboard is `sr-only` for accessibility. The sticky header renders inside the scrollable SheetContent.

```tsx
<div className="sticky top-0 z-10 border-b border-teal-100 bg-white px-6 py-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1.5">
      <h2 className="text-lg font-bold text-slate-900">{patient.name}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-teal-600">P.ID: {patient.patient_id}</span>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
          {patient.age} yrs
        </span>
        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
          {patient.gender}
        </span>
        {patient.blood_group && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700">
            {patient.blood_group}
          </span>
        )}
        {patient.allergies?.length > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
            ⚠ Allergies: {patient.allergies.join(", ")}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="mr-1.5 h-4 w-4" />
        Print
      </Button>
      <Button variant="ghost" size="icon" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  </div>
</div>
```

### 6.5 Pill-Style Tab Bar

```tsx
<div className="flex gap-1 border-b border-teal-100 px-6 pt-4 pb-0 overflow-x-auto">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        "whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
        activeTab === tab.id
          ? "bg-teal-700 text-white"
          : "text-teal-600 hover:bg-teal-50"
      )}
    >
      {tab.label}
    </button>
  ))}
</div>
```

**Tab list:**
```typescript
const tabs = [
  { id: "consultation", label: "Consultation" },
  { id: "prescription",  label: "Prescription" },
  { id: "labs",          label: "Labs" },
  { id: "history",       label: "History" },
  // Dental only shown when role === "Dentist":
  ...(user.role === "Dentist" ? [{ id: "dental", label: "Dental" }] : []),
] as const
```

### 6.6 SSE Stream Setup

```typescript
const labStreamRef = useRef<EventSource | null>(null)

useEffect(() => {
  const es = new EventSource(`/api/lab-tests/stream?patientId=${patientId}`, {
    withCredentials: true,   // credentials: "include" equivalent
  })
  labStreamRef.current = es
  return () => { es.close(); labStreamRef.current = null }
}, [patientId])
```

Pass `labStreamRef.current` as the `labStream` prop to `<LabsTab>`. Do NOT manually extract or forward auth tokens — `withCredentials: true` handles session cookies.

### 6.7 Tab Content Area

```tsx
<div className="px-6 py-6">
  {activeTab === "consultation" && (
    <ConsultationTab patient={patient} user={user} />
  )}
  {activeTab === "prescription" && (
    <PrescriptionTab patient={patient} user={user} />
  )}
  {activeTab === "labs" && (
    <LabsTab patient={patient} user={user} labStream={labStreamRef.current} />
  )}
  {activeTab === "history" && (
    <HistoryTab patient={patient} user={user} />
  )}
  {activeTab === "dental" && user.role === "Dentist" && (
    <DentalTab patient={patient} user={user} />
  )}
</div>
```

### 6.8 Print Section

Preserve the `.only-print` div from the original `patient-consultation.tsx`. It must remain as a direct child of the shell's root element, not wrapped inside the tab area.

---

## 7. Section 4 — Tab Components

### 7.1 ConsultationTab (`consultation-tabs/consultation-tab.tsx`)

**Props:**
```typescript
interface ConsultationTabProps {
  patient: Patient
  user: AuthUser
  onSaved?: () => void
}
```

**Form data type:**
```typescript
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

**Vitals form layout:** 2-column grid (`grid gap-4 sm:grid-cols-2`)

Vitals input accent classes:
- BP, HR, RR, SpO2: `border-l-4 border-sky-400 pl-3`
- Temperature: `border-l-4 border-amber-400 pl-3`
- All inputs: `focus-visible:ring-teal-400`

**onBlur formatters** (imported from `@/lib/vital-formatting`):
- `fmtBP` — formats blood pressure string
- `fmtTemp` — formats temperature with unit
- `fmtBpm` — formats heart/respiratory rate
- `fmtRR` — formats respiratory rate
- `fmtSpO2` — formats oxygen saturation percentage

**Critical vital alerts:**
- Source: `validateVitalSigns(formData)` from `@/lib/vital-signs-validation`
- Rendered inline above the submit button as: `<p className="text-rose-600 text-sm">⚠ {alert}</p>`

**Critical vitals confirmation dialog:**

Replace `window.confirm` with a shadcn `AlertDialog`:

```tsx
<AlertDialog open={showCriticalAlert} onOpenChange={setShowCriticalAlert}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="text-rose-700">Critical Vital Signs Detected</AlertDialogTitle>
      <AlertDialogDescription>
        One or more vital signs are outside safe ranges. Do you want to proceed with saving?
        <ul className="mt-2 space-y-1 text-rose-600">
          {criticalAlerts.map((a) => <li key={a}>⚠ {a}</li>)}
        </ul>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Review vitals</AlertDialogCancel>
      <AlertDialogAction
        className="bg-rose-600 hover:bg-rose-700 text-white"
        onClick={confirmSave}
      >
        Save anyway
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Keyboard shortcut:** Ctrl+Enter submits the form. Implement with `useCallback` to prevent stale closure:

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.ctrlKey && e.key === "Enter") {
    e.preventDefault()
    handleSubmit()
  }
}, [handleSubmit])
```

**Symptom / Diagnosis / Treatment / Notes fields:** Full-width textareas, `focus-visible:ring-teal-400`, `min-h-[80px]`.

**Submit button:** `bg-teal-700 hover:bg-teal-800 w-full text-white`.

---

### 7.2 PrescriptionTab (`consultation-tabs/prescription-tab.tsx`)

**Props:**
```typescript
interface PrescriptionTabProps {
  patient: Patient
  user: AuthUser
  onSaved?: () => void
}
```

**Form data types:**
```typescript
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
  notes: string
}
```

**Visit type selector:** Segmented button group — NOT a `<Select>`. Three adjacent buttons:

```tsx
<div className="flex rounded-lg border border-teal-200 overflow-hidden">
  {(["OPD", "INPATIENT", "EMERGENCY"] as const).map((vt) => (
    <button
      key={vt}
      type="button"
      onClick={() => setVisitType(vt)}
      className={cn(
        "flex-1 px-4 py-2 text-sm font-medium transition-colors",
        visitType === vt
          ? "bg-teal-700 text-white border border-teal-700"
          : "border border-teal-300 text-teal-700 hover:bg-teal-50"
      )}
    >
      {vt === "INPATIENT" ? "Inpatient" : vt === "EMERGENCY" ? "Emergency" : "OPD"}
    </button>
  ))}
</div>
```

**Medication cards:**
```tsx
<div className="rounded-xl border-l-4 border-amber-400 bg-amber-50/30 p-4">
  {/* medication fields */}
</div>
```

**Add medication button:**
```tsx
<Button variant="outline" className="border-dashed border-amber-400 text-amber-700 hover:bg-amber-50">
  + Add Medication
</Button>
```

**Save button:** `bg-amber-600 hover:bg-amber-700 text-white w-full`

**Validation:** Preserve all existing drug interaction / critical drug warning toasts. Surface them via `sonner` toast, not `window.alert` or `window.confirm`.

---

### 7.3 LabsTab (`consultation-tabs/labs-tab.tsx`)

**Props:**
```typescript
interface LabsTabProps {
  patient: Patient
  user: AuthUser
  labStream?: EventSource | null
}
```

**Lab row type:**
```typescript
interface LabRow {
  id: string
  test_name: string
  status: "Pending" | "Completed" | "Reviewed"
  result?: string
  is_critical?: boolean
  ordered_at: string
  reviewed_by?: string
}
```

**Order Lab Test button:** `bg-violet-700 hover:bg-violet-800 text-white`

**Results table:** Use shadcn `Table` (same import as patient-queue).

**Status badge classes:**
| Status | Class |
|---|---|
| Pending | `bg-amber-100 text-amber-700` |
| Completed | `bg-emerald-100 text-emerald-700` |
| Reviewed | `bg-teal-100 text-teal-700` |

**Critical result rows:**
```tsx
<TableRow className={row.is_critical ? "bg-rose-50 border-l-[3px] border-rose-500" : ""}>
```

**Action buttons:**
- Mark Reviewed: `variant="outline"` + `border-teal-400 text-teal-700 hover:bg-teal-50`
- Download PDF: `variant="outline"` + `border-violet-400 text-violet-700 hover:bg-violet-50`
- Batch print: preserved as-is

**SSE update handling:**
```typescript
useEffect(() => {
  if (!labStream) return
  const handler = (e: MessageEvent) => {
    const updated: LabRow = JSON.parse(e.data)
    setLabResults((prev) =>
      prev.map((r) => r.id === updated.id ? { ...r, ...updated } : r)
    )
  }
  labStream.addEventListener("message", handler)
  return () => labStream.removeEventListener("message", handler)
}, [labStream])
```

---

### 7.4 HistoryTab (`consultation-tabs/history-tab.tsx`)

**Props:**
```typescript
interface HistoryTabProps {
  patient: Patient
  user: AuthUser
}
```

**Obstetric assessment type:**
```typescript
interface ObstetricAssessment {
  id: string
  gravida?: number
  parity?: number
  gestationalAge?: string
  edd?: string
  fundalHeight?: string
  fetalHeartRate?: string
  presentation?: string
  notes?: string
  created_at: string
}
```

**Obstetric section label:** `text-xs font-semibold uppercase tracking-widest text-emerald-500`

**Obstetric assessment cards:**
```tsx
<div className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/30 p-4">
```

**Add Assessment button:** `bg-emerald-600 hover:bg-emerald-700 text-white`

**Edit dialog:** Preserved as-is from the original. A small form inside a shadcn `Dialog` is appropriate here (it's a focused edit action, not a full panel).

**Recent medical records section label:** `text-xs font-semibold uppercase tracking-widest text-teal-500`

**Medical record cards:**
```tsx
<div className="rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-4">
```

---

### 7.5 DentalTab (`consultation-tabs/dental-tab.tsx`)

**Rendered only when:** `user.role === "Dentist"` (guard exists in shell; DentalTab itself need not re-check, but may defensively check for safety).

**Props:**
```typescript
interface DentalTabProps {
  patient: Patient
  user: AuthUser
}
```

**Dental record type:**
```typescript
interface DentalRecord {
  id: string
  diagnosis: string
  procedure: string
  toothChartNotes?: string
  created_at: string
  created_by: string
}
```

**Record cards:**
```tsx
<div className="rounded-xl border-l-4 border-indigo-400 bg-indigo-50/30 p-4">
```

**Add Dental Record button:** `bg-indigo-600 hover:bg-indigo-700 text-white`

**Edit / Delete visibility:** Only shown when `user.role === "Dentist"` or `user.role === "Hospital Admin"`.

**Edit dialog:** Preserved as-is from the original.

**Tooth chart notes:** Plain `<Textarea>` with `focus-visible:ring-indigo-400`.

---

## 8. Section 5 — Bug Fixes

| # | Issue | Fix | Scope |
|---|---|---|---|
| 1 | Raw HTML `<table>` in `patient-queue.tsx` | Replace with shadcn `Table` | `patient-queue.tsx` |
| 2 | 21+ `any` types in `patient-consultation.tsx` | Typed interfaces per tab (listed in §7) | All tab files |
| 3 | Inline IIFEs used for rendering | Replace with named functions or `useMemo` | `consultation-tab.tsx`, `labs-tab.tsx` |
| 4 | Manual SSE token extraction (`Authorization: Bearer ...`) | Remove; use `withCredentials: true` only | Shell |
| 5 | Duplicate save-handler pattern (multiple `handleSave` in one file) | One `handleSave` per tab component | All tab files |
| 6 | `window.confirm` for critical vitals | shadcn `AlertDialog` with rose accent | `consultation-tab.tsx` |
| 7 | Duplicate API routes (`/api/doctor-schedules` + `/api/clinician-schedules`) | Audit + flag in PR description; no deletion this sprint | Audit only |

---

## 9. Section 6 — Implementation Order

Each task produces a standalone commit. The app must build and function correctly after every task.

| Task | Action | Commit message |
|---|---|---|
| 1 | Create `consultation-tab.tsx` | `feat(doctor): add ConsultationTab component` |
| 2 | Create `prescription-tab.tsx` | `feat(doctor): add PrescriptionTab component` |
| 3 | Create `labs-tab.tsx` | `feat(doctor): add LabsTab component` |
| 4 | Create `history-tab.tsx` | `feat(doctor): add HistoryTab component` |
| 5 | Create `dental-tab.tsx` | `feat(doctor): add DentalTab component` |
| 6 | Rewrite `patient-consultation.tsx` shell | `feat(doctor): rewrite consultation shell — split into tab components` |
| 7 | Redesign `patient-queue.tsx` | `feat(doctor): redesign patient queue — shadcn Table + teal theme` |
| 8 | Redesign `doctor-dashboard.tsx` | `feat(doctor): Consultation Room dashboard redesign — hero, stats, Sheet` |
| 9 | Build gate | `chore: verify build passes post-doctor-portal-redesign` |

**Dependency chain:**
- Tasks 1–5 are independent of each other and can be reviewed in parallel
- Task 6 depends on Tasks 1–5 (imports all tab components)
- Tasks 7 and 8 are independent of Task 6 but should come after to allow for any shared type adjustments
- Task 9 is a final build verification — `pnpm build` with zero TypeScript errors

---

## 10. API Routes

All existing API routes are preserved as-is. No route changes in this sprint.

| Route | Methods | Notes |
|---|---|---|
| `/api/medical/prescriptions` | POST, PATCH | Used by PrescriptionTab |
| `/api/lab-tests/stream` | GET (SSE) | Used by shell (stream) + LabsTab (receive) |
| `/api/lab-tests/[id]` | PATCH | Mark reviewed — used by LabsTab |
| `/api/lab-tests/pdf` | GET | Download PDF — used by LabsTab |
| `/api/lab-catalog` | GET | Lab test catalog for order dialog |
| `/api/obstetrics/assessments` | GET, POST, PATCH | Used by HistoryTab |
| `/api/dental/records` | GET, POST, PATCH, DELETE | Used by DentalTab |
| `/api/notifications` | PATCH | Mark notification read after openClinicianConsult event |
| `/api/doctor-schedules` | — | **Flagged:** possible duplicate of `/api/clinician-schedules` — audit in Task 9, do not delete this sprint |
| `/api/clinician-schedules` | — | **Flagged:** see above |

---

## Appendix A — Component Import Reference

```typescript
// Shell imports
import { ConsultationTab } from "./consultation-tabs/consultation-tab"
import { PrescriptionTab }  from "./consultation-tabs/prescription-tab"
import { LabsTab }          from "./consultation-tabs/labs-tab"
import { HistoryTab }       from "./consultation-tabs/history-tab"
import { DentalTab }        from "./consultation-tabs/dental-tab"

// Dashboard imports
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { PatientQueue }         from "@/components/doctor/patient-queue"
import { PatientConsultation }  from "@/components/doctor/patient-consultation"
import type { ConsultTab }      from "@/components/doctor/patient-consultation"

// Tab shared imports
import { cn }     from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input }  from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
         AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
         AlertDialogTitle } from "@/components/ui/alert-dialog"
```

---

## Appendix B — Accessibility Checklist

- [ ] Sheet has `sr-only` SheetHeader with descriptive title and description
- [ ] Close button has `aria-label="Close consultation panel"`
- [ ] Tab buttons use `role="tab"` and `aria-selected`
- [ ] Critical alert dialog has focus trap (handled by shadcn AlertDialog)
- [ ] Allergy badge has `title` attribute with full allergy list
- [ ] Loading states include `aria-busy="true"` on the container
- [ ] All icon-only buttons have `aria-label`

---

*Spec authored: 2026-03-21 — Dayspring HIS Doctor Portal "Consultation Room" Redesign*
