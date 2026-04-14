# Clinical UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 reported issues across the Dayspring HIS — navbar gaps, mobile layout, baby age support, clinical notes restructure, specimen multi-select, lab parameter grid, mark-reviewed 400 error, and consultation save fire-and-forget — plus sweep remaining console warnings.

**Architecture:** Each task is independently shippable. Bug fixes (Tasks 1–2) land first, then layout (Tasks 3–4), then form improvements (Tasks 5–7), then the lab parameter feature (Tasks 8–10), then console warnings sweep (Task 11).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, PostgreSQL (via `@/lib/db`), Tailwind CSS, shadcn/ui components, Sonner toasts.

---

## File Map

| File | Action | Task |
|------|--------|------|
| `components/doctor/consultation-tabs/labs-tab.tsx` | Modify (1-line fix) | 1 |
| `lib/medical-context.tsx` | Modify — return Promise, fix save | 2 |
| `components/doctor/consultation-tabs/consultation-tab.tsx` | Modify — async doSave | 2 |
| `app/clinician/page.tsx` | Modify — add DashboardLayout | 3 |
| `app/appointments/book/page.tsx` | Modify — add DashboardLayout | 3 |
| `app/appointments/calendar/page.tsx` | Modify — add DashboardLayout | 3 |
| `app/clinician/schedules/page.tsx` | Modify — add DashboardLayout | 3 |
| `components/dashboard-layout.tsx` | Modify — responsive header | 4 |
| `app/api/migrate/route.ts` | Modify — add age_unit + history + impression + loinc_panels migrations | 5, 6, 8 |
| `lib/patient-context.tsx` | Modify — add ageUnit to Patient type | 5 |
| `app/api/patients/route.ts` | Modify — accept ageValue + ageUnit | 5 |
| `components/patient/patient-registration.tsx` | Modify — unit selector | 5 |
| `lib/medical-context.tsx` | Modify — add history + impression fields | 6 |
| `app/api/medical/records/route.ts` | Modify — accept + return history + impression | 6 |
| `components/doctor/consultation-tabs/consultation-tab.tsx` | Modify — new fields, renamed label | 6 |
| `components/doctor/order-lab-test.tsx` | Modify — specimen multi-select | 7 |
| `lib/lab-parameters.ts` | **Create** — hardcoded parameter templates | 8 |
| `app/api/lab-panels/route.ts` | **Create** — panel lookup (DB + NLM fallback) | 9 |
| `components/lab/lab-test-details.tsx` | Modify — replace structured form with parameter grid | 10 |

---

## Task 1 — Fix "Mark Reviewed" 400 error (1-line fix)

**Files:**
- Modify: `components/doctor/consultation-tabs/labs-tab.tsx:56`

- [ ] **Step 1: Open the file and locate the bug**

In `labs-tab.tsx`, find `handleMarkReviewed`. The fetch body currently sends `{ status: "Reviewed" }`, but the API PATCH handler only marks a test reviewed when it receives `{ reviewed: true }`. Sending `status: "Reviewed"` hits the wrong branch and fails with 400.

- [ ] **Step 2: Apply the fix**

Change line 56:
```tsx
// BEFORE
body: JSON.stringify({ status: "Reviewed" }),

// AFTER
body: JSON.stringify({ reviewed: true }),
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
cd dayspring-his && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual verification**

Open clinician portal → select a patient with completed lab results → click "Mark Reviewed". The badge should change to "Reviewed" with no toast error.

- [ ] **Step 5: Commit**

```bash
git add components/doctor/consultation-tabs/labs-tab.tsx
git commit -m "fix: mark reviewed sends reviewed:true instead of status:Reviewed (400 error)"
```

---

## Task 2 — Fix consultation save fire-and-forget

**Files:**
- Modify: `lib/medical-context.tsx` (the `addMedicalRecord` function, ~lines 341–369)
- Modify: `components/doctor/consultation-tabs/consultation-tab.tsx` (the `doSave` callback)

**Root cause:** `addMedicalRecord` is a fire-and-forget async IIFE. `doSave` shows `toast.success(...)` synchronously before the API call completes or is checked. Any API failure is silently swallowed.

- [ ] **Step 1: Update `addMedicalRecord` to return a Promise**

In `lib/medical-context.tsx`, find `addMedicalRecord` and replace it:

```tsx
const addMedicalRecord = async (record: Omit<MedicalRecord, "id">): Promise<boolean> => {
  const newRecord: MedicalRecord = {
    ...record,
    id: `MR${String(medicalRecords.length + 1).padStart(3, "0")}`,
  }
  setMedicalRecords((prev) => [...prev, newRecord])
  try {
    const res = await fetch("/api/medical/records", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: record.patientId,
        chiefComplaint: record.symptoms,
        diagnosis: record.diagnosis,
        treatmentPlan: record.treatment,
        notes: record.notes,
        ...(record.vitalSigns && Object.keys(record.vitalSigns).length > 0
          ? { vitalSigns: record.vitalSigns }
          : {}),
      }),
    })
    if (res.ok) {
      await loadMedicalData()
      return true
    }
    return false
  } catch {
    return false
  }
}
```

Also update the context type to reflect the new signature. Find the interface or type that declares `addMedicalRecord`:
```tsx
// Change from:
addMedicalRecord: (record: Omit<MedicalRecord, "id">) => void
// To:
addMedicalRecord: (record: Omit<MedicalRecord, "id">) => Promise<boolean>
```

- [ ] **Step 2: Update `doSave` in consultation-tab.tsx to be async**

Find `doSave` in `components/doctor/consultation-tabs/consultation-tab.tsx` and replace it:

```tsx
const doSave = useCallback(async () => {
  if (!form.diagnosis.trim() && !form.symptoms.trim()) {
    toast.error("Enter at least complaints or diagnosis before saving.")
    return
  }
  const ok = await addMedicalRecord({
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
  if (ok) {
    setForm(EMPTY_FORM)
    setCriticalAlerts([])
    setShowCriticalAlert(false)
    toast.success("Consultation saved successfully!")
    onSaved?.()
  } else {
    toast.error("Failed to save consultation. Please try again.")
  }
}, [form, patient, user, addMedicalRecord, onSaved])
```

- [ ] **Step 3: Update `handleSubmit` — it calls `doSave` which is now async**

`handleSubmit` calls `doSave()` directly. Make sure it awaits:

```tsx
const handleSubmit = useCallback(async () => {
  const parts = form.bloodPressure.split("/")
  const vitalNumbers = {
    systolicBP: numFloat(parts[0] ?? "") ?? null,
    diastolicBP: numFloat(parts[1] ?? "") ?? null,
    temperature: numFloat(form.temperature),
    heartRate: numInt(form.heartRate),
    respiratoryRate: numInt(form.respiratoryRate),
    oxygenSaturation: numInt(form.oxygenSaturation),
  }
  const ageYears = patient.ageYears ?? null
  const alerts = validateVitalSigns(vitalNumbers, ageYears)
  const criticals = alerts.filter((a) => a.type === "critical")
  if (criticals.length > 0) {
    setCriticalAlerts(criticals)
    setShowCriticalAlert(true)
    return
  }
  await doSave()
}, [form, patient, doSave])
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual verification**

Log in as clinician → open a patient → Consultation tab → fill in Complaints + vitals → Save. The toast should say "Consultation saved successfully!" only after the API responds. Refresh the page; the record should still be there.

- [ ] **Step 6: Commit**

```bash
git add lib/medical-context.tsx components/doctor/consultation-tabs/consultation-tab.tsx
git commit -m "fix: consultation save awaits API before showing success toast"
```

---

## Task 3 — Add missing navbar to portals

**Files:**
- Modify: `app/clinician/page.tsx`
- Modify: `app/appointments/book/page.tsx`
- Modify: `app/appointments/calendar/page.tsx`
- Modify: `app/clinician/schedules/page.tsx`

- [ ] **Step 1: Fix `app/clinician/page.tsx`**

The page currently wraps content in `<>...</>`. Replace the fragment with `DashboardLayout`. The import for `DashboardLayout` is already present. Find the return statement and change:

```tsx
// BEFORE
return (
  <>
    <EmailVerificationModal ... />
    <div className="space-y-6">
      ...
    </div>
  </>
)

// AFTER
return (
  <DashboardLayout>
    <EmailVerificationModal ... />
    <div className="space-y-6">
      ...
    </div>
  </DashboardLayout>
)
```

- [ ] **Step 2: Fix `app/appointments/book/page.tsx`**

Add `DashboardLayout` import and wrap the returned JSX:

```tsx
import { DashboardLayout } from "@/components/dashboard-layout"

// In BookAppointmentInner's return (or the page's return):
return (
  <DashboardLayout>
    {/* existing content */}
  </DashboardLayout>
)
```

- [ ] **Step 3: Fix `app/appointments/calendar/page.tsx`**

Add `DashboardLayout` import and wrap the returned JSX:

```tsx
import { DashboardLayout } from "@/components/dashboard-layout"

return (
  <DashboardLayout>
    {/* existing content — the PatientProvider + AppointmentCalendar */}
  </DashboardLayout>
)
```

- [ ] **Step 4: Fix `app/clinician/schedules/page.tsx`**

Add `DashboardLayout` import and wrap:

```tsx
import { DashboardLayout } from "@/components/dashboard-layout"

return (
  <DashboardLayout>
    {/* existing content */}
  </DashboardLayout>
)
```

- [ ] **Step 5: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual verification**

Visit `/clinician`, `/appointments/book`, `/appointments/calendar`, `/clinician/schedules` — each should now show the header bar with the hospital logo, user name, and Logout button.

- [ ] **Step 7: Commit**

```bash
git add app/clinician/page.tsx app/appointments/book/page.tsx app/appointments/calendar/page.tsx app/clinician/schedules/page.tsx
git commit -m "fix: wrap clinician, appointments, and schedules pages in DashboardLayout"
```

---

## Task 4 — Mobile-responsive header

**Files:**
- Modify: `components/dashboard-layout.tsx` (the header section, ~lines 54–96)

- [ ] **Step 1: Update the header layout**

In `dashboard-layout.tsx`, find the `<header>` element and replace the inner div structure:

```tsx
<header className="sticky top-0 z-50 border-b border-border bg-card print:hidden">
  <div className="flex min-h-16 items-center justify-between gap-3 px-3 py-2 md:px-6 md:py-0 md:h-16 flex-wrap">
    {/* Logo + org name — always visible */}
    <div className="flex items-center gap-3 shrink-0">
      <Image
        src={ORG_LOGO_PATH}
        alt={`${ORG_NAME} logo`}
        width={32}
        height={32}
        className="h-8 w-8 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
      />
      <div>
        <h1 className="text-base font-semibold text-foreground leading-tight">{ORG_NAME}</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">{ORG_SUBTITLE}</p>
      </div>
    </div>

    {/* Right-side controls — wrap on small screens */}
    <div className="flex flex-wrap items-center gap-2 justify-end">
      <div className="hidden sm:block text-right">
        <p className="text-sm font-medium text-foreground leading-tight">{user?.name}</p>
        <p className="text-xs text-muted-foreground">{user && getRoleLabel(user.role)}</p>
      </div>
      <NotificationsBell userRole={user?.role} />
      {showAncLink && (
        <Button asChild variant="ghost" size="sm">
          <Link href="/midwife">Midwifery Portal</Link>
        </Button>
      )}
      {showSchedulesLink && (
        <Button asChild variant="ghost" size="sm">
          <Link href="/clinician/schedules">Schedules</Link>
        </Button>
      )}
      <Button asChild variant="secondary" size="sm">
        <Link href="/settings">Settings</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Logout</span>
        <span className="sm:hidden sr-only">Logout</span>
      </Button>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual verification**

Resize the browser to 375px width (mobile). The header should wrap cleanly — logo and org name on the left, controls wrapping below on small screens. At ≥640px (sm breakpoint) the user name and full Logout text should reappear.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard-layout.tsx
git commit -m "fix: responsive dashboard header — wraps buttons on mobile screens"
```

---

## Task 5 — Baby age support (months / days) in patient registration

**Files:**
- Modify: `app/api/migrate/route.ts` — add `age_unit` column migration
- Modify: `lib/patient-context.tsx` — add `ageUnit` to `Patient` type
- Modify: `app/api/patients/route.ts` — accept + store `ageUnit`
- Modify: `components/patient/patient-registration.tsx` — unit selector UI

### Step A — DB migration

- [ ] **Step 1: Find where to add the migration in `app/api/migrate/route.ts`**

Open the file and search for the block containing `age_years`. Append the following idempotent SQL immediately after it (inside the same migration transaction or as a new step):

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patients' AND column_name = 'age_unit'
  ) THEN
    ALTER TABLE patients
      ADD COLUMN age_unit TEXT DEFAULT 'years'
      CHECK (age_unit IN ('years', 'months', 'days'));
  END IF;
END $$;
```

- [ ] **Step 2: Run the migration**

Visit `/run-migrations` in the browser while logged in as admin, or hit the migration endpoint. Verify no errors appear.

### Step B — Update `Patient` type

- [ ] **Step 3: Add `ageUnit` to Patient in `lib/patient-context.tsx`**

Find the `Patient` interface/type definition. Add:
```tsx
ageUnit?: "years" | "months" | "days" | null
```

In the mapping where patients are converted from DB rows (search for `ageYears: typeof p.age_years`), add:
```tsx
ageUnit: (p.age_unit as "years" | "months" | "days") || "years",
```

### Step C — Update the API

- [ ] **Step 4: Update `app/api/patients/route.ts`**

Find the Zod schema at the top. The current field is `ageYears`. Add:
```ts
ageUnit: z.enum(["years", "months", "days"]).default("years").optional(),
```

Update validation — find the `ageYears` range check and replace with:
```ts
if (val.ageYears !== undefined && val.ageYears !== null) {
  const unit = val.ageUnit ?? "years"
  const max = unit === "years" ? 130 : unit === "months" ? 11 : 30
  if (val.ageYears < 0 || val.ageYears > max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageYears"], message: `Age must be 0–${max} for unit "${unit}"` })
  }
}
```

In the INSERT statement, add `age_unit` to the column list and `p.ageUnit ?? "years"` as the parameter. In the UPDATE statement (for PATCH), add:
```ts
['age_unit', has('ageUnit') ? (body.ageUnit ?? 'years') : undefined],
```

In the SELECT (GET) response mapping, add:
```ts
ageUnit: p.age_unit || "years",
```

### Step D — Update the registration form

- [ ] **Step 5: Update `components/patient/patient-registration.tsx`**

Add `ageUnit` to form state (alongside `ageYears`):
```tsx
// In the initial state object
ageYears: "",
ageUnit: "years" as "years" | "months" | "days",
```

Replace the single "Age (years)" field with a two-control row:
```tsx
<div className="space-y-2">
  <Label>Age *</Label>
  <div className="flex gap-2">
    <Input
      id="ageValue"
      name="ageValue"
      autoComplete="off"
      type="number"
      min={0}
      max={formData.ageUnit === "years" ? 130 : formData.ageUnit === "months" ? 11 : 30}
      value={formData.ageYears}
      onChange={(e) => setFormData({ ...formData, ageYears: e.target.value.replace(/[^0-9]/g, "") })}
      className="w-24"
      placeholder="0"
    />
    <Select
      value={formData.ageUnit}
      onValueChange={(v) => setFormData({ ...formData, ageUnit: v as "years" | "months" | "days" })}
    >
      <SelectTrigger id="ageUnit" className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="years">Years</SelectItem>
        <SelectItem value="months">Months</SelectItem>
        <SelectItem value="days">Days</SelectItem>
      </SelectContent>
    </Select>
  </div>
  {errors.ageYears && <div className="text-xs text-red-600">{errors.ageYears}</div>}
</div>
```

In the submit handler, pass `ageUnit` alongside `ageYears`:
```tsx
ageYears: formData.ageYears ? Number(formData.ageYears) : null,
ageUnit: formData.ageUnit,
```

- [ ] **Step 6: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Manual verification**

Register a new patient, set age to "2" + "Months". Confirm the patient card shows "2 months". Register another with "5" + "Days". Confirm "5 days".

- [ ] **Step 8: Commit**

```bash
git add app/api/migrate/route.ts lib/patient-context.tsx app/api/patients/route.ts components/patient/patient-registration.tsx
git commit -m "feat: add months/days age support for infant patient registration"
```

---

## Task 6 — Clinical notes restructure (Complaints, History, Impression)

**Files:**
- Modify: `app/api/migrate/route.ts` — add `history` + `impression` columns
- Modify: `lib/medical-context.tsx` — add fields to `MedicalRecord` type and `addMedicalRecord`
- Modify: `app/api/medical/records/route.ts` — POST + GET for new fields
- Modify: `components/doctor/consultation-tabs/consultation-tab.tsx` — new field order

### Step A — DB migration

- [ ] **Step 1: Append to `app/api/migrate/route.ts`**

Add after the age_unit migration:
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medical_records' AND column_name = 'history'
  ) THEN
    ALTER TABLE medical_records ADD COLUMN history TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medical_records' AND column_name = 'impression'
  ) THEN
    ALTER TABLE medical_records ADD COLUMN impression TEXT;
  END IF;
END $$;
```

- [ ] **Step 2: Run the migration** via `/run-migrations`.

### Step B — Update `MedicalRecord` type

- [ ] **Step 3: Update `lib/medical-context.tsx`**

Add fields to the `MedicalRecord` interface:
```tsx
history?: string
impression?: string
```

In `addMedicalRecord`, add to the `fetch` body:
```tsx
history: record.history || null,
impression: record.impression || null,
```

In the mapping that converts DB rows to `MedicalRecord` objects (search for `symptoms: r.chief_complaint`), add:
```tsx
history: r.history || "",
impression: r.impression || "",
```

### Step C — Update the API

- [ ] **Step 4: Update `app/api/medical/records/route.ts`**

In the `POST` handler, add to the `body` type:
```ts
history?: string
impression?: string
```

Add local variables:
```ts
const history = body.history || null
const impression = body.impression || null
```

Add to the INSERT columns: `history, impression`
Add to the INSERT values: `history, impression`
Update the RETURNING clause to include `history, impression`.

In the GET handler (if it exists in the same file), add `history` and `impression` to the SELECT and the mapped response object.

### Step D — Update consultation form

- [ ] **Step 5: Update `components/doctor/consultation-tabs/consultation-tab.tsx`**

Add new fields to `ConsultationFormData`:
```tsx
interface ConsultationFormData {
  bloodPressure: string
  temperature: string
  heartRate: string
  respiratoryRate: string
  oxygenSaturation: string
  complaints: string    // renamed from symptoms
  history: string       // new
  impression: string    // new
  treatmentPlan: string
  diagnosis: string
  notes: string
}

const EMPTY_FORM: ConsultationFormData = {
  bloodPressure: "", temperature: "", heartRate: "",
  respiratoryRate: "", oxygenSaturation: "",
  complaints: "", history: "", impression: "",
  treatmentPlan: "", diagnosis: "", notes: "",
}
```

Update validation in `doSave`:
```tsx
if (!form.diagnosis.trim() && !form.complaints.trim() && !form.impression.trim()) {
  toast.error("Enter at least Complaints, Impression, or Diagnosis before saving.")
  return
}
```

Update the `addMedicalRecord` call to pass the renamed/new fields:
```tsx
symptoms: form.complaints,   // complaints maps to chief_complaint via the context
history: form.history,
impression: form.impression,
```

Replace the clinical notes fields loop. Remove the current `(["symptoms", "diagnosis", "treatmentPlan", "notes"] as const).map(...)` and replace with explicit fields in the correct order:

```tsx
{/* Clinical Notes */}
<div className="space-y-4">
  <p className="text-xs font-semibold uppercase tracking-widest text-teal-500">Clinical Notes</p>

  {/* 1. Complaints */}
  <div className="space-y-1.5">
    <Label htmlFor="complaints">Complaints</Label>
    <Textarea
      id="complaints"
      name="complaints"
      autoComplete="off"
      value={form.complaints}
      onChange={set("complaints")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Chief complaint — what the patient presents with…"
    />
  </div>

  {/* 2. Patient History */}
  <div className="space-y-1.5">
    <Label htmlFor="history">Patient History</Label>
    <Textarea
      id="history"
      name="history"
      autoComplete="off"
      value={form.history}
      onChange={set("history")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Relevant past medical, surgical, family, or social history…"
    />
  </div>

  {/* 3. Impression */}
  <div className="space-y-1.5">
    <Label htmlFor="impression">Impression / Clinical Suspicion</Label>
    <Textarea
      id="impression"
      name="impression"
      autoComplete="off"
      value={form.impression}
      onChange={set("impression")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Working diagnosis or differential — what you suspect before investigations…"
    />
  </div>

  {/* 4. Treatment Plan */}
  <div className="space-y-1.5">
    <Label htmlFor="treatmentPlan">Treatment Plan</Label>
    <Textarea
      id="treatmentPlan"
      name="treatmentPlan"
      autoComplete="off"
      value={form.treatmentPlan}
      onChange={set("treatmentPlan")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Immediate treatment plan and instructions…"
    />
  </div>

  {/* 5. Diagnosis */}
  <div className="space-y-1.5">
    <Label htmlFor="diagnosis">Diagnosis</Label>
    <Textarea
      id="diagnosis"
      name="diagnosis"
      autoComplete="off"
      value={form.diagnosis}
      onChange={set("diagnosis")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Confirmed clinical diagnosis (post-investigation)…"
    />
  </div>

  {/* 6. Notes */}
  <div className="space-y-1.5">
    <Label htmlFor="clinicalNotes">Notes</Label>
    <Textarea
      id="clinicalNotes"
      name="clinicalNotes"
      autoComplete="off"
      value={form.notes}
      onChange={set("notes")}
      className={cn("min-h-[80px]", inputCls)}
      placeholder="Additional notes…"
    />
  </div>
</div>
```

- [ ] **Step 6: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Manual verification**

Log in as clinician → open a patient → Consultation tab. Verify fields appear in order: Complaints, Patient History, Impression, Treatment Plan, Diagnosis, Notes. Save a consultation, refresh the page, open the patient record again — all fields should persist.

- [ ] **Step 8: Commit**

```bash
git add app/api/migrate/route.ts lib/medical-context.tsx app/api/medical/records/route.ts components/doctor/consultation-tabs/consultation-tab.tsx
git commit -m "feat: restructure clinical notes — Complaints, History, Impression, Treatment Plan, Diagnosis"
```

---

## Task 7 — Specimen multi-select in order lab test

**Files:**
- Modify: `components/doctor/order-lab-test.tsx`

- [ ] **Step 1: Change specimen state from `string` to `string[]`**

Find `const [specimenType, setSpecimenType] = useState("Blood")` and replace:
```tsx
const [specimenTypes, setSpecimenTypes] = useState<string[]>(["Blood"])
```

Update the `submit` call to serialise:
```tsx
specimenType: specimenTypes.join(", "),
// and inside tests.map:
specimenType: specimenTypes.join(", "),
```

- [ ] **Step 2: Replace the `<Select>` with a checkbox group**

Add this import at the top if not present:
```tsx
import { Checkbox } from "@/components/ui/checkbox"
```

Find the `<div className="space-y-1">` wrapping the Specimen `<Select>` and replace the entire block:

```tsx
<div className="space-y-1 md:col-span-2">
  <Label id="specimen-label">Specimen Type(s)</Label>
  {specimenTypes.length > 0 && (
    <div className="flex flex-wrap gap-1 mb-2">
      {specimenTypes.map((s) => (
        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800">
          {s}
          <button
            type="button"
            onClick={() => setSpecimenTypes((prev) => prev.filter((x) => x !== s))}
            aria-label={`Remove ${s}`}
            className="ml-0.5 text-sky-600 hover:text-sky-900"
          >×</button>
        </span>
      ))}
    </div>
  )}
  <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-labelledby="specimen-label">
    {["Blood", "Serum", "Plasma", "Urine", "Stool", "Sputum", "Swab", "CSF"].map((opt) => (
      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <Checkbox
          id={`specimen-${opt}`}
          checked={specimenTypes.includes(opt)}
          onCheckedChange={(checked) =>
            setSpecimenTypes((prev) =>
              checked ? [...prev, opt] : prev.filter((s) => s !== opt)
            )
          }
        />
        {opt}
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verification**

Order a lab test — the Specimen field should show checkboxes. Select "Blood" + "Serum". The order should save with `specimenType = "Blood, Serum"`. Verify it shows correctly in the lab-tech view.

- [ ] **Step 5: Commit**

```bash
git add components/doctor/order-lab-test.tsx
git commit -m "feat: specimen multi-select in lab test order form"
```

---

## Task 8 — Lab parameter templates (`lib/lab-parameters.ts`)

**Files:**
- Create: `lib/lab-parameters.ts`

- [ ] **Step 1: Create the file**

Create `dayspring-his/lib/lab-parameters.ts` with the following content:

```ts
export interface LabParameter {
  name: string
  units: string
  reference: string
}

export interface ParameterRow extends LabParameter {
  value: string
  flag: "Normal" | "Low" | "High" | "Critical" | ""
  active: boolean  // whether this row is checked/selected by the lab tech
}

/** Compute flag from numeric value vs reference string "low–high" */
export function computeFlag(value: string, reference: string): "Normal" | "Low" | "High" | "Critical" | "" {
  const num = parseFloat(value)
  if (isNaN(num) || !reference) return ""
  const match = reference.match(/([\d.]+)\s*[–\-]\s*([\d.]+)/)
  if (!match) return ""
  const lo = parseFloat(match[1])
  const hi = parseFloat(match[2])
  if (isNaN(lo) || isNaN(hi)) return ""
  if (num < lo * 0.8 || num > hi * 1.5) return "Critical"
  if (num < lo) return "Low"
  if (num > hi) return "High"
  return "Normal"
}

export function buildParameterRows(params: LabParameter[]): ParameterRow[] {
  return params.map((p) => ({ ...p, value: "", flag: "", active: true }))
}

const TEMPLATES: Record<string, LabParameter[]> = {
  "cbc": [
    { name: "WBC", units: "10³/µL", reference: "4.0–11.0" },
    { name: "RBC", units: "10⁶/µL", reference: "3.8–5.4" },
    { name: "Hemoglobin", units: "g/dL", reference: "11.5–17.5" },
    { name: "Hematocrit", units: "%", reference: "34–50" },
    { name: "MCV", units: "fL", reference: "80–100" },
    { name: "MCH", units: "pg", reference: "27–33" },
    { name: "MCHC", units: "g/dL", reference: "32–36" },
    { name: "Platelets", units: "10³/µL", reference: "150–400" },
    { name: "Neutrophils", units: "%", reference: "40–70" },
    { name: "Lymphocytes", units: "%", reference: "20–40" },
    { name: "Monocytes", units: "%", reference: "2–10" },
    { name: "Eosinophils", units: "%", reference: "1–4" },
  ],
  "complete blood count": [],  // alias
  "lft": [
    { name: "ALT (SGPT)", units: "U/L", reference: "7–56" },
    { name: "AST (SGOT)", units: "U/L", reference: "10–40" },
    { name: "ALP", units: "U/L", reference: "44–147" },
    { name: "GGT", units: "U/L", reference: "9–48" },
    { name: "Total Bilirubin", units: "mg/dL", reference: "0.2–1.2" },
    { name: "Direct Bilirubin", units: "mg/dL", reference: "0.0–0.3" },
    { name: "Indirect Bilirubin", units: "mg/dL", reference: "0.1–1.0" },
    { name: "Total Protein", units: "g/dL", reference: "6.3–8.2" },
    { name: "Albumin", units: "g/dL", reference: "3.5–5.0" },
  ],
  "liver function": [],  // alias
  "liver function test": [],  // alias
  "rft": [
    { name: "Urea", units: "mg/dL", reference: "7–20" },
    { name: "Creatinine", units: "mg/dL", reference: "0.6–1.35" },
    { name: "eGFR", units: "mL/min/1.73m²", reference: ">60" },
    { name: "Uric Acid", units: "mg/dL", reference: "3.4–7.0" },
    { name: "Sodium", units: "mmol/L", reference: "136–145" },
    { name: "Potassium", units: "mmol/L", reference: "3.5–5.1" },
    { name: "Chloride", units: "mmol/L", reference: "98–107" },
    { name: "Bicarbonate", units: "mmol/L", reference: "22–29" },
  ],
  "renal function": [],
  "urea and electrolytes": [],
  "u&e": [],
  "lipid panel": [
    { name: "Total Cholesterol", units: "mg/dL", reference: "<200" },
    { name: "LDL Cholesterol", units: "mg/dL", reference: "<100" },
    { name: "HDL Cholesterol", units: "mg/dL", reference: ">40" },
    { name: "Triglycerides", units: "mg/dL", reference: "<150" },
    { name: "VLDL", units: "mg/dL", reference: "5–40" },
  ],
  "lipid profile": [],
  "thyroid": [
    { name: "TSH", units: "mIU/L", reference: "0.4–4.0" },
    { name: "T3 (Total)", units: "ng/dL", reference: "80–200" },
    { name: "T4 (Total)", units: "µg/dL", reference: "5.0–12.0" },
    { name: "Free T3", units: "pg/mL", reference: "2.3–4.2" },
    { name: "Free T4", units: "ng/dL", reference: "0.8–1.8" },
  ],
  "thyroid function": [],
  "thyroid panel": [],
  "urinalysis": [
    { name: "Color", units: "", reference: "Yellow" },
    { name: "Clarity", units: "", reference: "Clear" },
    { name: "pH", units: "", reference: "4.5–8.0" },
    { name: "Specific Gravity", units: "", reference: "1.001–1.035" },
    { name: "Protein", units: "", reference: "Negative" },
    { name: "Glucose", units: "", reference: "Negative" },
    { name: "Ketones", units: "", reference: "Negative" },
    { name: "Blood", units: "", reference: "Negative" },
    { name: "Nitrites", units: "", reference: "Negative" },
    { name: "Leukocyte Esterase", units: "", reference: "Negative" },
    { name: "Bilirubin", units: "", reference: "Negative" },
    { name: "Urobilinogen", units: "", reference: "Normal" },
  ],
  "electrolytes": [
    { name: "Sodium", units: "mmol/L", reference: "136–145" },
    { name: "Potassium", units: "mmol/L", reference: "3.5–5.1" },
    { name: "Chloride", units: "mmol/L", reference: "98–107" },
    { name: "Bicarbonate", units: "mmol/L", reference: "22–29" },
    { name: "Calcium", units: "mg/dL", reference: "8.5–10.2" },
    { name: "Phosphate", units: "mg/dL", reference: "2.5–4.5" },
    { name: "Magnesium", units: "mg/dL", reference: "1.7–2.2" },
  ],
  "abg": [
    { name: "pH", units: "", reference: "7.35–7.45" },
    { name: "PaCO₂", units: "mmHg", reference: "35–45" },
    { name: "PaO₂", units: "mmHg", reference: "80–100" },
    { name: "HCO₃", units: "mmol/L", reference: "22–26" },
    { name: "Base Excess", units: "mmol/L", reference: "-2–+2" },
    { name: "O₂ Saturation", units: "%", reference: "95–100" },
  ],
  "arterial blood gas": [],
  "blood gas": [],
  "crp": [
    { name: "C-Reactive Protein", units: "mg/L", reference: "<10" },
  ],
  "c-reactive protein": [],
  "esr": [
    { name: "ESR", units: "mm/hr", reference: "<20" },
  ],
  "coagulation": [
    { name: "PT", units: "seconds", reference: "11–13.5" },
    { name: "INR", units: "", reference: "0.8–1.1" },
    { name: "APTT", units: "seconds", reference: "25–35" },
    { name: "Fibrinogen", units: "mg/dL", reference: "200–400" },
  ],
  "pt/inr": [],
  "fbs": [
    { name: "Fasting Blood Sugar", units: "mg/dL", reference: "70–100" },
  ],
  "hba1c": [
    { name: "HbA1c", units: "%", reference: "<5.7" },
  ],
  "fasting blood sugar": [],
  "malaria rdt": [
    { name: "P. falciparum", units: "", reference: "Negative" },
    { name: "P. vivax/malariae", units: "", reference: "Negative" },
  ],
  "malaria": [],
  "hiv rapid": [
    { name: "HIV 1/2 Antibodies", units: "", reference: "Non-reactive" },
  ],
  "hiv": [],
  "widal": [
    { name: "S. typhi H", units: "titre", reference: "<1:80" },
    { name: "S. typhi O", units: "titre", reference: "<1:80" },
    { name: "S. paratyphi AH", units: "titre", reference: "<1:80" },
    { name: "S. paratyphi BH", units: "titre", reference: "<1:80" },
  ],
  "pregnancy test": [
    { name: "β-hCG", units: "", reference: "Negative" },
  ],
  "urine hcg": [],
  "sickle cell": [
    { name: "Sickle Cell Screen", units: "", reference: "Negative" },
  ],
  "haemoglobin electrophoresis": [
    { name: "HbA", units: "%", reference: "95–98" },
    { name: "HbA2", units: "%", reference: "1.5–3.5" },
    { name: "HbF", units: "%", reference: "<2.0" },
    { name: "HbS", units: "%", reference: "0" },
  ],
}

// Fill aliases: empty arrays inherit from the canonical key above them
;(function resolveAliases() {
  const keys = Object.keys(TEMPLATES)
  let lastFull: LabParameter[] = []
  for (const k of keys) {
    if (TEMPLATES[k].length > 0) lastFull = TEMPLATES[k]
    else TEMPLATES[k] = lastFull
  }
})()

/**
 * Return parameter templates for a test, or [] if unknown.
 * Matching is case-insensitive and strips trailing punctuation.
 */
export function getTemplateForTest(testName: string): LabParameter[] {
  const key = testName.toLowerCase().replace(/[^\w\s&/]/g, "").trim()
  // Exact match
  if (TEMPLATES[key]) return TEMPLATES[key]
  // Substring match
  for (const [k, v] of Object.entries(TEMPLATES)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return []
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/lab-parameters.ts
git commit -m "feat: add hardcoded lab parameter templates for 20+ common tests"
```

---

## Task 9 — LOINC panel lookup API endpoint

**Files:**
- Modify: `app/api/migrate/route.ts` — add `loinc_panels` table migration
- Create: `app/api/lab-panels/route.ts`

### Step A — DB migration

- [ ] **Step 1: Add migration to `app/api/migrate/route.ts`**

Append:
```sql
CREATE TABLE IF NOT EXISTS loinc_panels (
  panel_loinc_code TEXT NOT NULL,
  member_loinc_code TEXT NOT NULL,
  member_name       TEXT NOT NULL,
  units             TEXT,
  reference         TEXT,
  sort_order        INT DEFAULT 0,
  PRIMARY KEY (panel_loinc_code, member_loinc_code)
);
CREATE INDEX IF NOT EXISTS idx_loinc_panels_code ON loinc_panels(panel_loinc_code);
```

- [ ] **Step 2: Run migration** via `/run-migrations`.

### Step B — API route

- [ ] **Step 3: Create `app/api/lab-panels/route.ts`**

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const loincCode = (url.searchParams.get("loincCode") || "").trim()
    if (!loincCode) return NextResponse.json({ parameters: [] })

    // Check DB cache first
    const cached = await query(
      `SELECT member_name, units, reference FROM loinc_panels
        WHERE panel_loinc_code = $1
        ORDER BY sort_order ASC, member_name ASC`,
      [loincCode],
    )
    if (cached.rows.length > 0) {
      return NextResponse.json({
        parameters: cached.rows.map((r: any) => ({
          name: r.member_name,
          units: r.units || "",
          reference: r.reference || "",
        })),
      })
    }

    // Fallback: NLM Clinical Tables API (free, no key required)
    const nlmUrl =
      `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search` +
      `?terms=${encodeURIComponent(loincCode)}&df=LOINC_NUM,LONG_COMMON_NAME,COMPONENT,EXAMPLE_UNITS&maxList=40`

    const nlmRes = await fetch(nlmUrl, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    }).catch(() => null)

    if (!nlmRes || !nlmRes.ok) {
      return NextResponse.json({ parameters: [] })
    }

    const nlmData = await nlmRes.json().catch(() => null)
    // NLM response: [total, codes, extra, rows]
    // rows is array of [LOINC_NUM, LONG_COMMON_NAME, COMPONENT, EXAMPLE_UNITS]
    const rows: string[][] = Array.isArray(nlmData?.[3]) ? nlmData[3] : []
    if (!rows.length) return NextResponse.json({ parameters: [] })

    const parameters = rows.map((r) => ({
      name: r[2] || r[1] || r[0],  // COMPONENT > LONG_COMMON_NAME > code
      units: r[3] || "",
      reference: "",
    }))

    // Cache in DB for future lookups
    for (let i = 0; i < parameters.length; i++) {
      const p = parameters[i]
      if (!p.name) continue
      await query(
        `INSERT INTO loinc_panels (panel_loinc_code, member_loinc_code, member_name, units, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [loincCode, rows[i][0] || `${loincCode}-${i}`, p.name, p.units, i],
      ).catch(() => {})  // non-fatal
    }

    return NextResponse.json({ parameters })
  } catch (e) {
    console.error("GET /api/lab-panels failed:", e)
    return NextResponse.json({ parameters: [] })
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/migrate/route.ts app/api/lab-panels/route.ts
git commit -m "feat: add loinc_panels table and /api/lab-panels lookup endpoint (NLM fallback)"
```

---

## Task 10 — Lab parameter grid in LabTestDetails

**Files:**
- Modify: `components/lab/lab-test-details.tsx`

This is the largest change. The "Structured Result Entry" section (rendered when status is "In Progress") is replaced with a parameter grid that auto-loads from templates or LOINC lookup.

- [ ] **Step 1: Add imports**

At the top of `lab-test-details.tsx`, add:
```tsx
import { getTemplateForTest, buildParameterRows, computeFlag, type ParameterRow } from "@/lib/lab-parameters"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2 } from "lucide-react"
```

- [ ] **Step 2: Replace `StructuredResult` state with `ParameterRow[]` state**

Remove:
```tsx
interface StructuredResult { value: string; units: string; interpretation: string; reference: string }
function buildStructuredResult(...) { ... }
const [structured, setStructured] = useState<StructuredResult>(buildStructuredResult(contextTest))
```

Add:
```tsx
const [parameters, setParameters] = useState<ParameterRow[]>([])
const [paramsLoading, setParamsLoading] = useState(false)
```

- [ ] **Step 3: Load parameters when a test opens**

Replace the `useEffect` that calls `buildStructuredResult` with:
```tsx
useEffect(() => {
  if (!test) return
  setResults(test.results || "")
  setNotes(test.notes || "")
  setSpecimenType(test.specimenType || "")
  setVerified(test.status.toLowerCase() === "completed")
  setRejectionReason(DEFAULT_REJECTION_REASON)
  setCustomRejectionReason("")

  // Load saved parameters from resultJson if available
  const saved = test.resultJson as any
  if (Array.isArray(saved?.parameters) && saved.parameters.length > 0) {
    setParameters(
      saved.parameters.map((p: any) => ({
        name: p.name || "",
        units: p.units || "",
        reference: p.reference || "",
        value: p.value || "",
        flag: p.flag || "",
        active: p.active !== false,
      }))
    )
    return
  }

  // Try hardcoded template first
  const template = getTemplateForTest(test.testName || "")
  if (template.length > 0) {
    setParameters(buildParameterRows(template))
    return
  }

  // Fall back to LOINC lookup if test has a LOINC code
  if (test.loincCode) {
    setParamsLoading(true)
    fetch(`/api/lab-panels?loincCode=${encodeURIComponent(test.loincCode)}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { parameters: [] })
      .then((data) => {
        if (Array.isArray(data.parameters) && data.parameters.length > 0) {
          setParameters(buildParameterRows(data.parameters))
        } else {
          // No template found — start with one blank row
          setParameters([{ name: "", units: "", reference: "", value: "", flag: "", active: true }])
        }
      })
      .catch(() => {
        setParameters([{ name: "", units: "", reference: "", value: "", flag: "", active: true }])
      })
      .finally(() => setParamsLoading(false))
  } else {
    // Custom test, no LOINC — one blank row
    setParameters([{ name: "", units: "", reference: "", value: "", flag: "", active: true }])
  }
}, [test])
```

- [ ] **Step 4: Update `buildCompiledResults` to use the parameter grid**

Replace the existing `buildCompiledResults` function:
```tsx
const buildCompiledResults = () => {
  const activeRows = parameters.filter((p) => p.active && p.value.trim())
  const paramLines = activeRows.map((p) => {
    const flagText = p.flag ? ` [${p.flag.toUpperCase()}]` : ""
    const ref = p.reference ? ` (Ref: ${p.reference})` : ""
    return `${p.name}: ${p.value}${p.units ? " " + p.units : ""}${ref}${flagText}`
  })
  return [...paramLines, results.trim()].filter(Boolean).join("\n")
}
```

- [ ] **Step 5: Update `handleSubmitResults` to save parameters in `resultJson`**

Change the `resultJson` field in the PATCH body:
```tsx
resultJson: { parameters: parameters.filter((p) => p.active) },
```

- [ ] **Step 6: Replace the "Structured Result Entry" JSX block**

Find the `<Card>` with `<CardTitle className="text-sm">Structured Result Entry</CardTitle>` and replace its entire `<CardContent>` block:

```tsx
<CardContent className="space-y-3">
  {paramsLoading && (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading parameters…
    </div>
  )}

  {!paramsLoading && (
    <>
      {/* Parameter grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="w-8 pb-1 text-left font-medium">Run</th>
              <th className="pb-1 text-left font-medium pl-1">Parameter</th>
              <th className="pb-1 text-left font-medium pl-2">Value</th>
              <th className="pb-1 text-left font-medium pl-2 hidden sm:table-cell">Units</th>
              <th className="pb-1 text-left font-medium pl-2 hidden md:table-cell">Reference</th>
              <th className="pb-1 text-left font-medium pl-2">Flag</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {parameters.map((row, idx) => (
              <tr key={idx} className={row.active ? "" : "opacity-40"}>
                <td className="py-1.5 pr-1">
                  <Checkbox
                    id={`param-active-${idx}`}
                    checked={row.active}
                    onCheckedChange={(checked) =>
                      setParameters((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, active: checked === true } : r)
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pl-1">
                  <Input
                    id={`param-name-${idx}`}
                    name={`paramName-${idx}`}
                    autoComplete="off"
                    value={row.name}
                    onChange={(e) =>
                      setParameters((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)
                      )
                    }
                    placeholder="Parameter"
                    className="h-7 text-sm px-2 min-w-[120px]"
                    disabled={!row.active}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <Input
                    id={`param-value-${idx}`}
                    name={`paramValue-${idx}`}
                    autoComplete="off"
                    value={row.value}
                    onChange={(e) => {
                      const value = e.target.value
                      const flag = computeFlag(value, row.reference)
                      setParameters((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, value, flag } : r)
                      )
                    }}
                    placeholder="—"
                    className="h-7 text-sm px-2 w-24"
                    disabled={!row.active}
                  />
                </td>
                <td className="py-1.5 pl-2 hidden sm:table-cell">
                  <Input
                    id={`param-units-${idx}`}
                    name={`paramUnits-${idx}`}
                    autoComplete="off"
                    value={row.units}
                    onChange={(e) =>
                      setParameters((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, units: e.target.value } : r)
                      )
                    }
                    placeholder="units"
                    className="h-7 text-sm px-2 w-24"
                    disabled={!row.active}
                  />
                </td>
                <td className="py-1.5 pl-2 hidden md:table-cell">
                  <Input
                    id={`param-ref-${idx}`}
                    name={`paramRef-${idx}`}
                    autoComplete="off"
                    value={row.reference}
                    onChange={(e) => {
                      const reference = e.target.value
                      const flag = computeFlag(row.value, reference)
                      setParameters((prev) =>
                        prev.map((r, i) => i === idx ? { ...r, reference, flag } : r)
                      )
                    }}
                    placeholder="e.g. 4.0–11.0"
                    className="h-7 text-sm px-2 w-28"
                    disabled={!row.active}
                  />
                </td>
                <td className="py-1.5 pl-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    row.flag === "Normal" ? "bg-emerald-100 text-emerald-800" :
                    row.flag === "Low" ? "bg-sky-100 text-sky-800" :
                    row.flag === "High" ? "bg-amber-100 text-amber-800" :
                    row.flag === "Critical" ? "bg-red-100 text-red-700 font-bold" :
                    "text-muted-foreground"
                  }`}>
                    {row.flag || "—"}
                  </span>
                </td>
                <td className="py-1.5 pl-1">
                  <button
                    type="button"
                    onClick={() => setParameters((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-red-600 p-0.5"
                    aria-label="Remove parameter"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add custom row */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() =>
          setParameters((prev) => [
            ...prev,
            { name: "", units: "", reference: "", value: "", flag: "", active: true },
          ])
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Add parameter row
      </Button>
    </>
  )}

  {/* Interpretation / free-text area — kept for narrative findings */}
  <div className="space-y-1">
    <Label className="text-xs">Interpretation / Narrative Findings</Label>
    <Textarea
      rows={2}
      value={results}
      onChange={(e) => setResults(e.target.value)}
      placeholder="Clinical interpretation or analyzer output — appended to the parameter grid on submit"
    />
  </div>
</CardContent>
```

- [ ] **Step 7: Remove any remaining references to `structured` state** 

Search the file for `structured` and ensure no remaining uses. The `buildStructuredResult` call in the second `useEffect` (which syncs `loincUnits`) should also be removed or updated:

```tsx
// Remove the useEffect that previously did:
// setStructured((current) => ({ ...current, units: current.units || test?.loincUnits || "" }))
```

- [ ] **Step 8: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: Manual verification**

Log in as lab tech → open a pending CBC test → click it to open details → Start Collection → the parameter grid should show all 12 CBC parameters with units and reference ranges pre-filled. Enter values → flags auto-calculate → Submit Results → verify the compiled result text in the patient record shows each parameter line.

Then open a custom-named test (no LOINC code) — should show one blank row + "Add parameter row" button.

- [ ] **Step 10: Commit**

```bash
git add components/lab/lab-test-details.tsx
git commit -m "feat: replace single-value result entry with auto-loading parameter grid for lab tests"
```

---

## Task 11 — Console warnings sweep

**Files:** Any component with remaining `id`/`name`/`autoComplete` gaps found during implementation. New fields added by Tasks 5–7 already have correct attributes.

- [ ] **Step 1: Scan for remaining warnings**

Open the browser console on each portal while logged in. Look for:
- "A form field element should have an id or name attribute"
- "An element doesn't have an autocomplete attribute set"

Fix each occurrence: add `id="..."`, `name="..."`, and `autoComplete="off"` (for non-password, non-address fields) to the input.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit (if any files changed)**

```bash
git add <changed files>
git commit -m "fix: remaining form field accessibility attributes (console warnings)"
```

---

## Task 12 — Final verification and push

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Smoke test each portal**

| Portal | What to verify |
|--------|---------------|
| Clinician | Navbar visible; consultation form shows Complaints/History/Impression/TreatmentPlan/Diagnosis; saving shows success only after API responds; mark reviewed works |
| Lab Tech | CBC test opens with 12 parameter rows pre-filled; flags calculate; submit works |
| Receptionist | Navbar visible on appointments pages |
| Patient registration | Age shows years/months/days selector; "2 months" saves and displays correctly |

- [ ] **Step 3: Push to origin**

```bash
git push
```
