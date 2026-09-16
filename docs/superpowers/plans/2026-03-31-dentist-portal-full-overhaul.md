# Dentist Portal — Full Clinical Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Dentist portal with 5 bug fixes, a 5-tab sub-navigation shell, FDI tooth chart, clinical actions (Rx/lab/radiology), dedicated notification bell, and a cyan/pearl visual identity.

**Architecture:** Nine new components in `components/dentist/` replace the current flat single-page layout. Eight existing files are modified for bug fixes and API extensions. No new database tables — all clinical actions use existing permitted API endpoints.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Radix UI, Zod, sonner (toasts), Lucide React icons, direct `pg` queries via `queryWithSession`.

**Spec:** `docs/superpowers/specs/2026-03-31-dentist-portal-full-overhaul-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `components/dentist/fdi-tooth-chart.tsx` | Interactive 32-tooth FDI chart, pure UI component |
| `components/dentist/dentist-notification-bell.tsx` | SSE+polling notification bell, cyan badge |
| `components/dentist/dentist-exports.tsx` | Date-range CSV/XLSX/PDF exports tab |
| `components/dentist/dentist-schedule.tsx` | Today's header card + embedded DoctorDashboard |
| `components/dentist/dentist-overview.tsx` | 6-stat grid + quick actions + recent records |
| `components/dentist/dentist-patient-records.tsx` | Searchable record history with slide-over |
| `components/dentist/dentist-clinical-actions.tsx` | Write Rx + Order Lab + Request Radiology |
| `components/dentist/dental-visit-summary.tsx` | Per-visit composed record view (read/edit) |
| `components/dentist/dentist-shell.tsx` | 5-tab router + portal header |

### Modified files
| File | Change |
|---|---|
| `lib/security.ts` | Add `"delete"` to Dentist role's `medical` array |
| `app/api/dental/records/[id]/route.ts` | Fix B2 (toothNotes PATCH) + B3 (DELETE permission) |
| `app/api/dental/records/route.ts` | Fix B1 (toothNotes POST) + add `mode`/`search`/`page` params |
| `lib/exports/datasets/dental.ts` | Fix B4: cursor key → `id`, cast → `::uuid` |
| `app/api/dental/summary/route.ts` | Add 4 new stat fields |
| `components/doctor/consultation-tabs/dental-tab.tsx` | FDI chart + cyan theme |
| `components/dashboards/dentist-dashboard.tsx` | Thin wrapper — imports DentistShell |
| `app/dentist/settings/page.tsx` | Sparkles → Stethoscope icon |

---

## Task 1: Fix B3 — DELETE permission + security.ts

**Files:**
- Modify: `lib/security.ts`
- Modify: `app/api/dental/records/[id]/route.ts`

- [ ] **Step 1: Open `lib/security.ts` and find the Dentist role block**

Look for the object that starts with `Dentist: {`. It currently reads:
```ts
Dentist: {
  patients: ["read"],
  medical: ["read", "create", "update"],
  appointments: ["read", "update"],
  lab: ["read", "create"],
  radiology: ["read", "create"],
  pharmacy: ["read"],
  billing: ["create"],
  beds: ["read"],
  exports: ["create"],
},
```

- [ ] **Step 2: Add `"delete"` to the `medical` array**

Change `medical: ["read", "create", "update"]` to:
```ts
medical: ["read", "create", "update", "delete"],
```

- [ ] **Step 3: Fix the DELETE route permission check in `app/api/dental/records/[id]/route.ts` line 81**

Change:
```ts
if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```
To:
```ts
if (!can(auth.role, "medical", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```
This is inside the `DELETE` function only. The `PATCH` function's permission check stays as `"update"`.

- [ ] **Step 4: Verify manually**

Start the dev server (`npm run dev`), log in as a Dentist, navigate to a patient consultation with dental records, and confirm the Delete button no longer returns 403.

- [ ] **Step 5: Commit**

```bash
git add lib/security.ts app/api/dental/records/[id]/route.ts
git commit -m "fix(dental): add delete permission to Dentist role and fix DELETE route check"
```

---

## Task 2: Fix B1 — `toothNotes` silently dropped on POST

**Files:**
- Modify: `app/api/dental/records/route.ts`

- [ ] **Step 1: Update `CreateDentalSchema` to include `toothNotes`**

The current schema (lines 7–13) reads:
```ts
const CreateDentalSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
})
```

Replace with:
```ts
const CreateDentalSchema = z.object({
  patientId: z.string().min(1),
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
  toothNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})
```

- [ ] **Step 2: Merge `toothNotes` into `tooth_chart` JSONB on INSERT**

Find the INSERT query inside `POST`. The values array currently passes `input.toothChart ?? null` as `$5`. Change the tooth_chart value to merge toothNotes into the JSONB:

Replace the values array from:
```ts
[
  input.patientId,
  auth.userId,
  input.diagnosis ?? null,
  input.procedurePerformed ?? null,
  input.toothChart ?? null,
  input.notes ?? null,
]
```
To:
```ts
[
  input.patientId,
  auth.userId,
  input.diagnosis ?? null,
  input.procedurePerformed ?? null,
  input.toothNotes != null
    ? JSON.stringify({ ...(input.toothChart ?? {}), notes: input.toothNotes })
    : input.toothChart != null
      ? JSON.stringify(input.toothChart)
      : null,
  input.notes ?? null,
]
```

- [ ] **Step 3: Verify manually**

In the dental tab, add a new record with tooth notes text. After saving, reopen the patient — confirm the tooth notes appear.

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/records/route.ts
git commit -m "fix(dental): save toothNotes into tooth_chart JSONB on POST (B1)"
```

---

## Task 3: Fix B2 — `toothNotes` silently dropped on PATCH

**Files:**
- Modify: `app/api/dental/records/[id]/route.ts`

- [ ] **Step 1: Update `UpdateDentalSchema` to include `toothNotes`**

Current schema (lines 7–13):
```ts
const UpdateDentalSchema = z.object({
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
  visitDate: z.string().datetime().optional().nullable(),
})
```

Replace with:
```ts
const UpdateDentalSchema = z.object({
  diagnosis: z.string().optional().nullable(),
  procedurePerformed: z.string().optional().nullable(),
  toothChart: z.record(z.string(), z.any()).optional().nullable(),
  toothNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  visitDate: z.string().datetime().optional().nullable(),
})
```

- [ ] **Step 2: Add `toothNotes` case to the dynamic UPDATE builder**

In the `PATCH` handler, after the `if (input.toothChart !== undefined)` block (around line 43), add:

```ts
if (input.toothNotes !== undefined) {
  updates.push(`tooth_chart = jsonb_set(COALESCE(tooth_chart, '{}'), '{notes}', to_jsonb($${idx++}::text))`)
  values.push(input.toothNotes ?? "")
}
```

Place this block **after** the `toothChart` block so that if both `toothChart` and `toothNotes` are sent (unlikely but possible), `toothChart` sets the whole object first and `toothNotes` then surgical-updates just the `notes` key.

- [ ] **Step 3: Verify manually**

Edit an existing dental record, change the tooth notes, save. Reopen — confirm updated tooth notes persist.

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/records/[id]/route.ts
git commit -m "fix(dental): save toothNotes via jsonb_set on PATCH (B2)"
```

---

## Task 4: Fix B4 — Export cursor bug

**Files:**
- Modify: `lib/exports/datasets/dental.ts`

- [ ] **Step 1: Switch cursor from `visit_date` to `id`**

The current `queryPage` method has this SQL condition and order:
```sql
AND ($3::timestamp IS NULL OR dr.visit_date > $3)
ORDER BY dr.visit_date ASC
```
And this cursor construction:
```ts
const nextCursor =
  rows.length === pageSize ? { after: rows[rows.length - 1].visit_date } : undefined
```

Make three targeted changes:

**Change 1** — cursor condition (line with `$3::timestamp`):
```sql
AND ($3::uuid IS NULL OR dr.id > $3)
```

**Change 2** — ORDER BY:
```sql
ORDER BY dr.id ASC
```

**Change 3** — nextCursor construction:
```ts
const nextCursor =
  rows.length === pageSize ? { after: rows[rows.length - 1].id } : undefined
```

- [ ] **Step 2: Add `id` to the SELECT so the cursor value is available**

The current SELECT does not include `dr.id`. Add it:
```sql
SELECT
  dr.id,
  dr.visit_date,
  p.patient_number,
  ...
```

The `id` column will be present in rows but is not in `defaultColumns` so it won't appear in the exported file.

- [ ] **Step 3: Verify**

Run a dental export from the dashboard for a wide date range that would return more than 5000 records (or reduce `pageSize` temporarily to 2 and test with 3 records). Confirm no records are duplicated or skipped.

- [ ] **Step 4: Commit**

```bash
git add lib/exports/datasets/dental.ts
git commit -m "fix(dental): switch export cursor from visit_date to id to fix pagination skips (B4)"
```

---

## Task 5: Extend `/api/dental/summary` — 4 new stat fields (fixes B5)

**Files:**
- Modify: `app/api/dental/summary/route.ts`

- [ ] **Step 1: Add 4 new queries after the existing `recentRows` query**

After the `recentRecords` mapping block (around line 64), add:

```ts
// Procedures this week (non-null procedure_performed, by this dentist, this Mon–Sun)
const weekStart = new Date()
weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
weekStart.setHours(0, 0, 0, 0)
const weekEnd = new Date(weekStart)
weekEnd.setDate(weekStart.getDate() + 6)
weekEnd.setHours(23, 59, 59, 999)

const { rows: procRows } = await queryWithSession(session,
  onlyMine
    ? `SELECT COUNT(*) AS cnt FROM dental_records
       WHERE dentist_id = $1 AND procedure_performed IS NOT NULL
         AND visit_date >= $2::timestamp AND visit_date <= $3::timestamp`
    : `SELECT COUNT(*) AS cnt FROM dental_records
       WHERE procedure_performed IS NOT NULL
         AND visit_date >= $1::timestamp AND visit_date <= $2::timestamp`,
  onlyMine
    ? [auth.userId, weekStart.toISOString(), weekEnd.toISOString()]
    : [weekStart.toISOString(), weekEnd.toISOString()]
)
const proceduresThisWeek = parseInt(String(procRows[0]?.cnt ?? 0), 10)

// Pending follow-ups (dental dept appointments, status = 'pending' or 'scheduled')
const { rows: fuRows } = await queryWithSession(session,
  `SELECT COUNT(*) AS cnt FROM appointments
   WHERE LOWER(department) = 'dental'
     AND status IN ('pending', 'scheduled')
     AND appointment_date >= CURRENT_DATE`,
  []
)
const pendingFollowUps = parseInt(String(fuRows[0]?.cnt ?? 0), 10)

// Pending lab results (lab_tests ordered by this dentist, status != 'completed')
const { rows: labRows } = await queryWithSession(session,
  onlyMine
    ? `SELECT COUNT(*) AS cnt FROM lab_tests
       WHERE ordered_by = $1 AND status != 'completed'`
    : `SELECT COUNT(*) AS cnt FROM lab_tests WHERE status != 'completed'`,
  onlyMine ? [auth.userId] : []
)
const pendingLabResults = parseInt(String(labRows[0]?.cnt ?? 0), 10)

// Pending pre-auths (insurance_authorizations, status = 'pending', dental category)
// Falls back gracefully if table doesn't exist
let pendingPreAuths = 0
try {
  const { rows: paRows } = await queryWithSession(session,
    `SELECT COUNT(*) AS cnt FROM insurance_authorizations
     WHERE status = 'pending'
       AND LOWER(service_category) LIKE '%dental%'`,
    []
  )
  pendingPreAuths = parseInt(String(paRows[0]?.cnt ?? 0), 10)
} catch {
  // table may not exist yet — graceful fallback
  pendingPreAuths = 0
}
```

- [ ] **Step 2: Add the new fields to the JSON response**

Change the final `return NextResponse.json(...)` to include all new fields:

```ts
return NextResponse.json({
  visitsCount,
  patientsCount,
  proceduresThisWeek,
  pendingFollowUps,
  pendingLabResults,
  pendingPreAuths,
  recentRecords,
  ...(fromParam && toParam ? { from: fromParam, to: toParam } : {}),
})
```

- [ ] **Step 3: Verify**

Hit `GET /api/dental/summary?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z` while logged in as Dentist. Confirm the response contains all 6 numeric fields.

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/summary/route.ts
git commit -m "feat(dental): extend summary API with 4 new stat fields (proceduresThisWeek, pendingFollowUps, pendingLabResults, pendingPreAuths)"
```

---

## Task 6: Extend `GET /api/dental/records` — search, mode, page params

**Files:**
- Modify: `app/api/dental/records/route.ts`

- [ ] **Step 1: Parse new query params at the top of the `GET` handler**

After the existing `patientId` extraction, add:

```ts
const mode = url.searchParams.get("mode") || ""
const search = (url.searchParams.get("search") || "").trim()
const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
const limit = 20
const offset = (page - 1) * limit
```

- [ ] **Step 2: Make `patientId` optional and branch the query**

Replace the entire existing `if (!patientId)` guard and query with:

```ts
// patientId is required UNLESS mode=mine (dentist fetching their own cross-patient history)
if (!patientId && mode !== "mine") {
  return NextResponse.json({ error: "patientId or mode=mine is required" }, { status: 400 })
}

let rows: any[]
if (patientId) {
  // Original behaviour: fetch records for a specific patient (used by dental-tab.tsx)
  const result = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT id, patient_id, dentist_id, visit_date, diagnosis, procedure_performed, tooth_chart, notes
       FROM dental_records
      WHERE patient_id = $1
      ORDER BY visit_date DESC
      LIMIT 100`,
    [patientId],
  )
  rows = result.rows
} else {
  // mode=mine: dentist's full cross-patient history with optional search + pagination
  const searchParam = search ? `%${search}%` : null
  const result = await queryWithSession(
    { role: auth.role, userId: auth.userId },
    `SELECT dr.id, dr.patient_id, dr.dentist_id, dr.visit_date, dr.diagnosis,
            dr.procedure_performed, dr.tooth_chart, dr.notes,
            p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
      WHERE dr.dentist_id = $1
        AND ($2::text IS NULL
             OR p.first_name ILIKE $2
             OR p.last_name ILIKE $2
             OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $2
             OR p.patient_number ILIKE $2)
      ORDER BY dr.visit_date DESC
      LIMIT $3 OFFSET $4`,
    [auth.userId, searchParam, limit, offset],
  )
  rows = result.rows
}

return NextResponse.json({ records: rows })
```

- [ ] **Step 3: Verify**

- `GET /api/dental/records?patientId=<uuid>` → still works (existing dental-tab behaviour)
- `GET /api/dental/records?mode=mine` → returns current dentist's records
- `GET /api/dental/records?mode=mine&search=john` → filtered results
- `GET /api/dental/records?mode=mine&page=2` → offset pagination

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/records/route.ts
git commit -m "feat(dental): add mode=mine, search, and page params to GET /api/dental/records"
```

---

## Task 7: Build `fdi-tooth-chart.tsx` — pure UI component

**Files:**
- Create: `components/dentist/fdi-tooth-chart.tsx`

- [ ] **Step 1: Create the file with types and constants**

```tsx
"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "@/components/ui/textarea"

export type ToothState = "normal" | "caries" | "filled" | "crown" | "missing" | "extracted"

export type ToothChartData = {
  [toothId: string]: { state: ToothState; notes?: string }
  notes?: string
}

export interface FdiToothChartProps {
  value: ToothChartData
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}

const STATE_CYCLE: ToothState[] = ["normal", "caries", "filled", "crown", "missing", "extracted"]

const STATE_STYLES: Record<ToothState, string> = {
  normal:    "bg-white border-cyan-200 text-transparent",
  caries:    "bg-amber-100 border-amber-400 text-amber-700",
  filled:    "bg-blue-100 border-blue-400 text-blue-700",
  crown:     "bg-purple-100 border-purple-400 text-purple-700",
  missing:   "bg-slate-100 border-slate-400 text-slate-500",
  extracted: "bg-rose-100 border-rose-400 text-rose-600",
}

const STATE_CODES: Record<ToothState, string> = {
  normal: "·", caries: "C", filled: "F", crown: "Cr", missing: "M", extracted: "X",
}

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]

const LEGEND = Object.entries(STATE_CODES).filter(([k]) => k !== "normal") as [ToothState, string][]
```

- [ ] **Step 2: Add the helper to parse legacy `tooth_chart` shapes**

```tsx
function normaliseChart(raw: ToothChartData | null | undefined): ToothChartData {
  if (!raw) return {}
  // raw may be { notes: "text" } (legacy) or { "11": { state: "caries" }, notes: "..." } (new)
  return raw
}
```

- [ ] **Step 3: Add the main component**

```tsx
export function FdiToothChart({ value, onChange, readOnly = false }: FdiToothChartProps) {
  const chart = normaliseChart(value)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)

  function getState(id: number): ToothState {
    return chart[String(id)]?.state ?? "normal"
  }

  function cycleState(id: number, e: React.MouseEvent) {
    if (readOnly) return
    const key = String(id)
    const current = getState(id)
    const next = e.shiftKey
      ? "normal"
      : STATE_CYCLE[(STATE_CYCLE.indexOf(current) + 1) % STATE_CYCLE.length]
    const updated: ToothChartData = { ...chart }
    if (next === "normal") {
      delete updated[key]
    } else {
      updated[key] = { ...chart[key], state: next }
    }
    onChange(updated)
  }

  function handleToothClick(id: number, e: React.MouseEvent) {
    if (readOnly) return
    cycleState(id, e)
    setSelectedTooth(selectedTooth === String(id) ? null : String(id))
  }

  function updateToothNote(id: string, notes: string) {
    const updated: ToothChartData = { ...chart }
    updated[id] = { ...chart[id], state: chart[id]?.state ?? "normal", notes }
    onChange(updated)
  }

  function ToothBtn({ id }: { id: number }) {
    const state = getState(id)
    const isSelected = selectedTooth === String(id)
    return (
      <button
        type="button"
        title={readOnly ? `Tooth ${id}` : `Tooth ${id} — click to cycle, shift+click to reset`}
        onClick={(e) => handleToothClick(id, e)}
        className={cn(
          "w-8 h-8 rounded border text-[10px] font-bold flex items-center justify-center transition-all select-none",
          STATE_STYLES[state],
          isSelected && "ring-2 ring-cyan-500 ring-offset-1",
          readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80",
        )}
      >
        {STATE_CODES[state]}
      </button>
    )
  }

  function ToothRow({ teeth }: { teeth: number[] }) {
    return (
      <div className="flex gap-0.5">
        {teeth.map((id) => <ToothBtn key={id} id={id} />)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Upper arch */}
      <div className="flex gap-1 justify-center">
        <ToothRow teeth={UPPER_RIGHT} />
        <div className="w-px bg-cyan-200 mx-1" />
        <ToothRow teeth={UPPER_LEFT} />
      </div>
      {/* Arch labels */}
      <div className="flex justify-center gap-1">
        <span className="text-[9px] text-slate-400 w-[136px] text-right">Upper R</span>
        <span className="w-3" />
        <span className="text-[9px] text-slate-400 w-[136px]">Upper L</span>
      </div>
      {/* Lower arch */}
      <div className="flex gap-1 justify-center">
        <ToothRow teeth={LOWER_RIGHT} />
        <div className="w-px bg-cyan-200 mx-1" />
        <ToothRow teeth={LOWER_LEFT} />
      </div>
      <div className="flex justify-center gap-1">
        <span className="text-[9px] text-slate-400 w-[136px] text-right">Lower R</span>
        <span className="w-3" />
        <span className="text-[9px] text-slate-400 w-[136px]">Lower L</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center pt-1">
        {LEGEND.map(([state, code]) => (
          <span key={state} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border", STATE_STYLES[state])}>
            <span className="font-bold">{code}</span>
            <span className="capitalize opacity-70">{state}</span>
          </span>
        ))}
      </div>

      {/* Per-tooth notes panel (only when a tooth is selected and not read-only) */}
      {!readOnly && selectedTooth && (
        <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500">
            Tooth {selectedTooth} notes
          </p>
          <Textarea
            value={chart[selectedTooth]?.notes ?? ""}
            onChange={(e) => updateToothNote(selectedTooth, e.target.value)}
            placeholder={`Notes for tooth ${selectedTooth}…`}
            className="min-h-[56px] text-sm focus-visible:ring-cyan-400"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Navigate to any dental tab, import and render `<FdiToothChart value={{}} onChange={() => {}} />` temporarily in the dental-tab. Confirm:
- 32 teeth render in two rows
- Clicking a tooth cycles through all 6 states
- Shift+click resets to Normal
- Selected tooth reveals notes panel
- Read-only mode disables interaction

Remove the temporary render after verification.

- [ ] **Step 5: Commit**

```bash
git add components/dentist/fdi-tooth-chart.tsx
git commit -m "feat(dental): add interactive FDI 32-tooth chart component"
```

---

## Task 8: Redesign `dental-tab.tsx` — FDI chart + cyan theme

**Files:**
- Modify: `components/doctor/consultation-tabs/dental-tab.tsx`

- [ ] **Step 1: Add FdiToothChart import and update the type for `toothNotes`**

At the top of the file, add the import:
```tsx
import { FdiToothChart, type ToothChartData } from "@/components/dentist/fdi-tooth-chart"
```

Update `DentalFormState` to include `toothChart`:
```ts
interface DentalFormState {
  diagnosis: string
  procedurePerformed: string
  toothNotes: string
  toothChart: ToothChartData
  visitDate: string
}

const EMPTY_DENTAL: DentalFormState = {
  diagnosis: "", procedurePerformed: "", toothNotes: "", toothChart: {}, visitDate: "",
}
```

- [ ] **Step 2: Update `handleSave` payload to send `toothChart`**

In `handleSave`, update the payload construction:
```ts
const payload: Record<string, unknown> = {
  patientId: patient.id,
  diagnosis: form.diagnosis || null,
  procedurePerformed: form.procedurePerformed || null,
  toothNotes: form.toothNotes || null,
  toothChart: Object.keys(form.toothChart).length > 0 ? form.toothChart : null,
}
```

- [ ] **Step 3: Update `openEdit` to populate `toothChart` from existing record**

The record type already has `tooth_chart`. Update `openEdit`:
```ts
const openEdit = (r: DentalRecord) => {
  setEditingId(r.id)
  const rawChart = r.tooth_chart ?? {}
  const toothNotes = typeof rawChart.notes === "string" ? rawChart.notes : (r.notes || "")
  setEditForm({
    diagnosis: r.diagnosis || "",
    procedurePerformed: r.procedure_performed || "",
    toothNotes,
    toothChart: rawChart,
    visitDate: r.visit_date ? String(r.visit_date).slice(0, 16) : "",
  })
}
```

- [ ] **Step 4: Update `handleSaveEdit` payload to send `toothChart`**

```ts
const payload: Record<string, unknown> = {
  diagnosis: editForm.diagnosis || null,
  procedurePerformed: editForm.procedurePerformed || null,
  toothNotes: editForm.toothNotes || null,
  toothChart: Object.keys(editForm.toothChart).length > 0 ? editForm.toothChart : null,
}
```

- [ ] **Step 5: Restyle — replace `indigo` with `cyan` and add FDI chart to New Record form**

In the JSX, make the following changes:

1. Section label: change `text-indigo-500` → `text-cyan-500`
2. Existing record cards: change `border-indigo-400 bg-indigo-50/30` → `border-cyan-400 bg-cyan-50/30`
3. Add FDI chart read-only display inside each existing record card, above the text fields:
```tsx
{r.tooth_chart && Object.keys(r.tooth_chart).length > 0 && (
  <div className="mb-2">
    <FdiToothChart value={r.tooth_chart} onChange={() => {}} readOnly />
  </div>
)}
```
4. New Record form: change `border-indigo-100` → `border-cyan-100`, `text-indigo-700` → `text-cyan-700`, button `bg-indigo-600 hover:bg-indigo-700` → `bg-cyan-600 hover:bg-cyan-700`, input `focus-visible:ring-indigo-400` → `focus-visible:ring-cyan-400`
5. Add FDI chart **above** the diagnosis field inside the New Record form:
```tsx
<div className="space-y-1">
  <Label className="text-xs font-semibold uppercase tracking-widest text-cyan-500">
    Tooth Chart
  </Label>
  <FdiToothChart
    value={form.toothChart}
    onChange={(data) => setForm((f) => ({ ...f, toothChart: data }))}
  />
</div>
```
6. Edit dialog: add FDI chart the same way using `editForm.toothChart` and `setEditForm`.

- [ ] **Step 6: Verify**

Open a patient consultation as Dentist. Confirm:
- New Record form shows the FDI chart
- Clicking teeth in the chart updates state
- Save → reload → chart state persists
- Edit dialog pre-populates the chart from saved data

- [ ] **Step 7: Commit**

```bash
git add components/doctor/consultation-tabs/dental-tab.tsx
git commit -m "feat(dental): redesign dental-tab with FDI chart and cyan theme"
```

---

## Task 9: Build `dentist-notification-bell.tsx`

**Files:**
- Create: `components/dentist/dentist-notification-bell.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DentistNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

const DENTAL_KEYWORDS = [
  "dental", "tooth", "teeth", "dentist",
  "patient queued", "patient assigned",
  "lab", "result",
  "appointment", "reminder",
  "pre-auth", "preauth", "authorization",
]

function isDentalNotif(n: DentistNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return DENTAL_KEYWORDS.some((kw) => t.includes(kw) || m.includes(kw))
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

export function DentistNotificationBell() {
  const [notifications, setNotifications] = useState<DentistNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sseRef = useRef<EventSource | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: DentistNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isDentalNotif))
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()

    const es = new EventSource("/api/notifications/stream", { withCredentials: true })
    sseRef.current = es
    es.onmessage = () => { void fetchNotifications() }
    es.onerror = () => {
      es.close()
      sseRef.current = null
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => void fetchNotifications(), 30000)
      }
    }

    return () => {
      es.close()
      sseRef.current = null
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (!unreadIds.length) return
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      )
    } catch { /* silent */ }
  }

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
    } catch { /* silent */ }
  }

  function handleNotifClick(n: DentistNotif) {
    if (!n.read_at) void markRead(n.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className={cn("relative", unreadCount > 0 ? "text-cyan-600" : "text-slate-400")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Notifications</p>
            {unreadCount > 0 && (
              <p className="text-xs text-slate-500">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-cyan-600 hover:text-cyan-800 font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={cn(
                  "w-full px-4 py-3 text-left transition-colors hover:bg-cyan-50/60",
                  !n.read_at
                    ? "bg-cyan-50 border-l-4 border-cyan-500"
                    : "border-l-4 border-transparent",
                )}
              >
                <p className={cn("text-sm font-medium", !n.read_at ? "text-cyan-900" : "text-slate-700")}>
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

- [ ] **Step 2: Verify**

Render the bell temporarily in `dentist-dashboard.tsx`. Confirm it renders, badge shows unread count, popover opens, "Mark all read" clears the badge.

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-notification-bell.tsx
git commit -m "feat(dental): add dentist notification bell with SSE and cyan badge"
```

---

## Task 10: Build `dentist-exports.tsx`

**Files:**
- Create: `components/dentist/dentist-exports.tsx`

- [ ] **Step 1: Create the file — extract logic from `dentist-dashboard.tsx`**

```tsx
"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function DentistExports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exportMineOnly, setExportMineOnly] = useState(true)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | "csv" | null>(null)

  const exportDental = async (format: "xlsx" | "pdf" | "csv") => {
    const fromDate = new Date(from + "T00:00:00Z").getTime()
    const toDate = new Date(to + "T23:59:59Z").getTime()
    if (fromDate > toDate) {
      toast.error("From date must be on or before To date")
      return
    }
    setExporting(format)
    try {
      const payload: { dataset: string; format: string; filters: Record<string, unknown> } = {
        dataset: "dental",
        format,
        filters: {
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T23:59:59Z").toISOString(),
        },
      }
      if (exportMineOnly) payload.filters.recordedByUserId = true
      const res = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dental-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Dental export (${format.toUpperCase()}) downloaded`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6 p-1">
      <Card className="rounded-2xl border border-cyan-100 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-600">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">Dental Record Exports</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Download dental visit summaries. Each row includes visit date, patient name,
                diagnosis, procedure performed, tooth chart notes, and prescribing dentist.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="focus-visible:ring-cyan-400" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportMineOnly}
              onChange={(e) => setExportMineOnly(e.target.checked)}
              className="rounded border-cyan-300 text-cyan-600"
            />
            <span className="text-slate-600">Export my records only</span>
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
              <Button
                key={fmt}
                variant="outline"
                size="sm"
                onClick={() => exportDental(fmt)}
                disabled={!!exporting}
                className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              >
                {exporting === fmt ? "Exporting…" : `Export ${fmt.toUpperCase()}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Render the component in isolation. Set a date range, click Export CSV — confirm download triggers correctly.

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-exports.tsx
git commit -m "feat(dental): extract exports into dedicated DentistExports component"
```

---

## Task 11: Build `dentist-schedule.tsx`

**Files:**
- Create: `components/dentist/dentist-schedule.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useEffect, useState } from "react"
import { Calendar, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"

interface TodayStats {
  count: number
  nextPatient: string | null
}

export function DentistSchedule() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const todayStr = new Date().toISOString().slice(0, 10)
    fetch(
      `/api/appointments?date=${todayStr}&department=Dental&limit=50`,
      { credentials: "include" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const appts = Array.isArray(data?.appointments) ? data.appointments : []
        const sorted = appts
          .filter((a: any) => a.status !== "cancelled" && a.status !== "completed")
          .sort((a: any, b: any) =>
            new Date(a.appointment_date ?? a.appointmentDate ?? 0).getTime() -
            new Date(b.appointment_date ?? b.appointmentDate ?? 0).getTime()
          )
        const next = sorted[0]
        setStats({
          count: sorted.length,
          nextPatient: next
            ? [next.patient_first_name ?? next.patientName ?? "", next.patient_last_name ?? ""]
                .filter(Boolean).join(" ").trim() || null
            : null,
        })
      })
      .catch(() => { if (!cancelled) setStats({ count: 0, nextPatient: null }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Today&apos;s Dental Appointments</CardTitle>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-slate-800">
              {loading ? "—" : stats?.count ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Remaining today</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Next Patient</CardTitle>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-400">Loading…</div>
            ) : stats?.nextPatient ? (
              <div className="text-base font-semibold text-slate-800">{stats.nextPatient}</div>
            ) : (
              <div className="text-sm text-slate-400">No upcoming patients</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-1 shadow-sm">
        <DoctorDashboard title="Dental Queue" showDentalQueueFilter />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dentist/dentist-schedule.tsx
git commit -m "feat(dental): add DentistSchedule tab with today's appointment header cards"
```

---

## Task 12: Build `dental-visit-summary.tsx` — slide-over record view

**Files:**
- Create: `components/dentist/dental-visit-summary.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FdiToothChart, type ToothChartData } from "@/components/dentist/fdi-tooth-chart"

export interface DentalRecord {
  id: string
  patient_id: string
  visit_date: string | null
  diagnosis: string | null
  procedure_performed: string | null
  tooth_chart: ToothChartData | null
  notes: string | null
  patient_number?: string | null
  first_name?: string | null
  last_name?: string | null
}

interface DentalVisitSummaryProps {
  record: DentalRecord
  canEdit: boolean
  onUpdated: (updated: DentalRecord) => void
  onDeleted: (id: string) => void
}

export function DentalVisitSummary({ record, canEdit, onUpdated, onDeleted }: DentalVisitSummaryProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const rawChart = record.tooth_chart ?? {}
  const toothNotes = typeof rawChart.notes === "string" ? rawChart.notes : (record.notes ?? "")

  const [form, setForm] = useState({
    diagnosis: record.diagnosis ?? "",
    procedurePerformed: record.procedure_performed ?? "",
    toothNotes,
    toothChart: rawChart as ToothChartData,
    visitDate: record.visit_date ? String(record.visit_date).slice(0, 16) : "",
  })

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/dental/records/${record.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: form.diagnosis || null,
          procedurePerformed: form.procedurePerformed || null,
          toothNotes: form.toothNotes || null,
          toothChart: Object.keys(form.toothChart).filter(k => k !== 'notes').length > 0
            ? form.toothChart : null,
          visitDate: form.visitDate ? new Date(form.visitDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Update failed")
      }
      const data = await res.json()
      toast.success("Record updated")
      setEditing(false)
      onUpdated(data.record)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/dental/records/${record.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Delete failed")
      }
      toast.success("Record deleted")
      onDeleted(record.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm" variant="outline"
            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {editing ? "Cancel" : "Edit"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete dental record?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the dental record from{" "}
                  {record.visit_date ? String(record.visit_date).slice(0, 10) : "this visit"}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Tooth chart */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-2">Tooth Chart</p>
        <FdiToothChart
          value={editing ? form.toothChart : (record.tooth_chart ?? {})}
          onChange={(data) => setForm((f) => ({ ...f, toothChart: data }))}
          readOnly={!editing}
        />
      </div>

      {/* Fields */}
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Visit Date</Label>
            <Input type="datetime-local" value={form.visitDate}
              onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Diagnosis</Label>
            <Textarea value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Procedure Performed</Label>
            <Textarea value={form.procedurePerformed}
              onChange={(e) => setForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Tooth / Chart Notes</Label>
            <Textarea value={form.toothNotes}
              onChange={(e) => setForm((f) => ({ ...f, toothNotes: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {record.visit_date && (
            <p><span className="font-medium text-slate-600">Date:</span>{" "}
              <span className="text-slate-800">{String(record.visit_date).slice(0, 10)}</span>
            </p>
          )}
          {record.diagnosis && (
            <p><span className="font-medium text-slate-600">Diagnosis:</span>{" "}
              <span className="text-slate-800">{record.diagnosis}</span>
            </p>
          )}
          {record.procedure_performed && (
            <p><span className="font-medium text-slate-600">Procedure:</span>{" "}
              <span className="text-slate-800">{record.procedure_performed}</span>
            </p>
          )}
          {toothNotes && (
            <p><span className="font-medium text-slate-600">Notes:</span>{" "}
              <span className="text-slate-600 italic">{toothNotes}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dentist/dental-visit-summary.tsx
git commit -m "feat(dental): add DentalVisitSummary component for slide-over record view/edit"
```

---

## Task 13: Build `dentist-patient-records.tsx`

**Files:**
- Create: `components/dentist/dentist-patient-records.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useState } from "react"
import { Search, Eye } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { DentalVisitSummary, type DentalRecord } from "@/components/dentist/dental-visit-summary"

export function DentistPatientRecords() {
  const { user } = useAuth()
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState<DentalRecord | null>(null)

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadRecords = useCallback(async (s: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode: "mine", page: String(p) })
      if (s) params.set("search", s)
      const res = await fetch(`/api/dental/records?${params}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json().catch(() => ({}))
      setRecords(Array.isArray(data.records) ? data.records : [])
    } catch {
      toast.error("Failed to load dental records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecords(debouncedSearch, page)
  }, [debouncedSearch, page, loadRecords])

  const canEdit = user?.role === "Dentist" || user?.role === "Hospital Admin"

  function handleUpdated(updated: DentalRecord) {
    setRecords((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
    setSelectedRecord((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
  }

  function handleDeleted(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setSelectedRecord(null)
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by patient name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 focus-visible:ring-cyan-400"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-cyan-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cyan-50 bg-slate-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Patient No.</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Patient</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Diagnosis</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Procedure</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  {debouncedSearch ? `No records found for "${debouncedSearch}"` : "No dental records on file."}
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const patientName = [r.first_name, r.last_name].filter(Boolean).join(" ").trim()
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-cyan-50/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedRecord(r)}
                  >
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {r.visit_date ? String(r.visit_date).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {r.patient_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{patientName || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell max-w-[200px] truncate">
                      {r.diagnosis ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell max-w-[200px] truncate">
                      {r.procedure_performed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost"
                        className="text-cyan-600 hover:bg-cyan-50"
                        onClick={(e) => { e.stopPropagation(); setSelectedRecord(r) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && records.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="outline"
              disabled={records.length < 20}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Slide-over */}
      <Sheet open={!!selectedRecord} onOpenChange={(o) => { if (!o) setSelectedRecord(null) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-slate-800">
              Dental Record
              {selectedRecord?.visit_date && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {String(selectedRecord.visit_date).slice(0, 10)}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedRecord && (
            <div className="mt-4">
              <DentalVisitSummary
                record={selectedRecord}
                canEdit={canEdit}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to the Patients tab. Confirm records load, search filters work (with 300ms debounce), clicking a row opens the slide-over, and editing/deleting from the slide-over updates the table.

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-patient-records.tsx
git commit -m "feat(dental): add DentistPatientRecords tab with search, pagination, and slide-over"
```

---

## Task 14: Build `dentist-clinical-actions.tsx`

**Files:**
- Create: `components/dentist/dentist-clinical-actions.tsx`

- [ ] **Step 1: Create the file with patient search helper and accordion structure**

```tsx
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
```

- [ ] **Step 2: Add the patient search sub-component**

```tsx
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
          {results.map((p: any) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-cyan-50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange({
                  id: p.id,
                  patientNumber: p.patientNumber || p.patient_number || "",
                  firstName: p.firstName || p.first_name || "",
                  lastName: p.lastName || p.last_name || "",
                })
                setQuery("")
                setOpen(false)
              }}
            >
              <span className="font-medium text-slate-800">
                {p.firstName || p.first_name} {p.lastName || p.last_name}
              </span>
              <span className="ml-2 text-slate-400 text-xs">
                {p.patientNumber || p.patient_number}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add the Write Prescription section**

```tsx
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
```

- [ ] **Step 4: Add the Order Lab Test section**

```tsx
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
```

- [ ] **Step 5: Add the Request Radiology section**

```tsx
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
```

- [ ] **Step 6: Add the main `DentistClinicalActions` export with accordion**

```tsx
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
```

- [ ] **Step 7: Verify**

Navigate to Clinical tab. Confirm:
- All three accordions expand/collapse
- Patient search autocomplete works (type 2+ chars)
- Write Prescription submits to `/api/medical/prescriptions` — check Network tab
- Order Lab → submits to `/api/lab-tests`
- Request Radiology → submits to `/api/lab-tests` with scan type name

- [ ] **Step 8: Commit**

```bash
git add components/dentist/dentist-clinical-actions.tsx
git commit -m "feat(dental): add Clinical Actions tab with Write Rx, Order Lab, Request Radiology"
```

---

## Task 15: Build `dentist-overview.tsx`

**Files:**
- Create: `components/dentist/dentist-overview.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useEffect, useState } from "react"
import { Stethoscope, Users, Activity, Clock, FlaskConical, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface DentalSummary {
  visitsCount: number
  patientsCount: number
  proceduresThisWeek: number
  pendingFollowUps: number
  pendingLabResults: number
  pendingPreAuths: number
  recentRecords: Array<{
    id: string
    patientId: string
    visitDate: string
    diagnosis: string | null
    procedurePerformed: string | null
    patientNumber: string | null
    patientName: string
  }>
}

interface StatCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  loading: boolean
  accent?: string
}

function StatCard({ title, value, icon, loading, accent = "cyan" }: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/30 shadow-sm shadow-cyan-100/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
        <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums text-slate-800">
          {loading ? "—" : value ?? 0}
        </div>
      </CardContent>
    </Card>
  )
}

interface DentistOverviewProps {
  onNavigate: (tab: string, section?: string) => void
}

export function DentistOverview({ onNavigate }: DentistOverviewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [summary, setSummary] = useState<DentalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fromTs = new Date(today + "T00:00:00Z").toISOString()
    const toTs = new Date(today + "T23:59:59Z").toISOString()
    setLoading(true)
    fetch(`/api/dental/summary?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSummary({
          visitsCount: data.visitsCount ?? 0,
          patientsCount: data.patientsCount ?? 0,
          proceduresThisWeek: data.proceduresThisWeek ?? 0,
          pendingFollowUps: data.pendingFollowUps ?? 0,
          pendingLabResults: data.pendingLabResults ?? 0,
          pendingPreAuths: data.pendingPreAuths ?? 0,
          recentRecords: Array.isArray(data.recentRecords) ? data.recentRecords : [],
        })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [today])

  const stats = [
    { title: "Today's Visits", value: summary?.visitsCount ?? null, icon: <Stethoscope className="h-4 w-4" /> },
    { title: "Patients This Month", value: summary?.patientsCount ?? null, icon: <Users className="h-4 w-4" /> },
    { title: "Procedures This Week", value: summary?.proceduresThisWeek ?? null, icon: <Activity className="h-4 w-4" /> },
    { title: "Pending Follow-ups", value: summary?.pendingFollowUps ?? null, icon: <Clock className="h-4 w-4" /> },
    { title: "Pending Lab Results", value: summary?.pendingLabResults ?? null, icon: <FlaskConical className="h-4 w-4" /> },
    { title: "Insurance Pre-Auths", value: summary?.pendingPreAuths ?? null, icon: <ShieldCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* 6-stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} loading={loading} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-3">Quick Actions</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Order Lab Test", sub: "Request blood work or specimen", tab: "clinical", section: "lab" },
            { label: "Write Prescription", sub: "Prescribe post-procedure medications", tab: "clinical", section: "rx" },
            { label: "Request Radiology", sub: "OPG, periapical, CBCT and more", tab: "clinical", section: "radiology" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.tab, a.section)}
              className="rounded-xl border-2 border-cyan-100 bg-white hover:bg-cyan-50 hover:border-cyan-300 transition-all p-4 text-left group"
            >
              <p className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700">{a.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent records */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-3">Recent Dental Records</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (summary?.recentRecords?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-cyan-200 py-8 text-center">
            <p className="text-sm text-slate-400">No dental records yet.</p>
            <p className="text-xs text-slate-300 mt-1">Records you create will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {summary!.recentRecords.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="rounded-xl border-l-4 border-cyan-400 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.patientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.diagnosis || "Visit"} · {r.visitDate ? String(r.visitDate).slice(0, 10) : ""}
                    </p>
                  </div>
                  {r.procedurePerformed && (
                    <span className="text-[10px] font-medium text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 hidden sm:block">
                      {r.procedurePerformed.slice(0, 20)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dentist/dentist-overview.tsx
git commit -m "feat(dental): add DentistOverview tab with 6-stat grid, quick actions, and recent records"
```

---

## Task 16: Build `dentist-shell.tsx`

**Files:**
- Create: `components/dentist/dentist-shell.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useState } from "react"
import { Settings } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { DentistNotificationBell } from "@/components/dentist/dentist-notification-bell"
import { DentistOverview } from "@/components/dentist/dentist-overview"
import { DentistPatientRecords } from "@/components/dentist/dentist-patient-records"
import { DentistSchedule } from "@/components/dentist/dentist-schedule"
import { DentistClinicalActions } from "@/components/dentist/dentist-clinical-actions"
import { DentistExports } from "@/components/dentist/dentist-exports"

type Tab = "overview" | "patients" | "schedule" | "clinical" | "exports"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "clinical", label: "Clinical" },
  { id: "exports", label: "Exports" },
]

export function DentistShell() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [clinicalSection, setClinicalSection] = useState<"rx" | "lab" | "radiology" | null>("rx")

  function navigateTo(tab: string, section?: string) {
    setActiveTab(tab as Tab)
    if (tab === "clinical" && section) {
      setClinicalSection(section as "rx" | "lab" | "radiology")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal header strip */}
      <div className="bg-white border-b border-cyan-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Identity */}
            <div>
              <p className="text-sm font-bold text-slate-800">
                Dayspring HIS — Dental
              </p>
              {user && (
                <p className="text-xs text-cyan-600">
                  {user.name} · Dental Surgeon
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <DentistNotificationBell />
              <Link href="/dentist/settings">
                <button
                  type="button"
                  aria-label="Settings"
                  className="rounded-lg p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm transition-colors border-b-2",
                  activeTab === tab.id
                    ? "border-cyan-600 text-cyan-700 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <DentistOverview onNavigate={navigateTo} />
        )}
        {activeTab === "patients" && (
          <DentistPatientRecords />
        )}
        {activeTab === "schedule" && (
          <DentistSchedule />
        )}
        {activeTab === "clinical" && (
          <DentistClinicalActions defaultSection={clinicalSection} />
        )}
        {activeTab === "exports" && (
          <DentistExports />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify shell renders all tabs**

Import `DentistShell` temporarily in `dentist-dashboard.tsx` and render it. Click through all 5 tabs, confirm each renders its content without errors.

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-shell.tsx
git commit -m "feat(dental): add DentistShell 5-tab portal with header strip and notification bell"
```

---

## Task 17: Wire up `dentist-dashboard.tsx` as thin wrapper

**Files:**
- Modify: `components/dashboards/dentist-dashboard.tsx`

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client"
import { DentistShell } from "@/components/dentist/dentist-shell"

export function DentistDashboard() {
  return <DentistShell />
}
```

- [ ] **Step 2: Verify end-to-end**

Navigate to `/dentist`. Confirm:
- Portal header shows dentist name
- All 5 tabs work
- Overview loads stats from the API
- Notification bell renders
- Settings icon links to `/dentist/settings`
- No console errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboards/dentist-dashboard.tsx
git commit -m "refactor(dental): replace dentist-dashboard with thin wrapper over DentistShell"
```

---

## Task 18: Settings icon + final cleanup

**Files:**
- Modify: `app/dentist/settings/page.tsx`

- [ ] **Step 1: Swap the icon import**

Change:
```tsx
import { Sparkles } from "lucide-react"
```
To:
```tsx
import { Stethoscope } from "lucide-react"
```

And change:
```tsx
icon={<Sparkles className="h-5 w-5" />}
```
To:
```tsx
icon={<Stethoscope className="h-5 w-5" />}
```

- [ ] **Step 2: Final end-to-end smoke test**

Run through this checklist:

1. `/dentist` loads — header strip shows, all 5 tabs clickable
2. Overview tab — 6 stat cards show numbers (not `—` after load)
3. Quick Actions — clicking "Order Lab Test" switches to Clinical tab, lab section open
4. Patients tab — records load, search filters, slide-over opens, edit/delete work
5. Schedule tab — appointment header cards render, DoctorDashboard queue visible
6. Clinical tab — all 3 accordions open/close, patient search autocomplete works, all 3 forms submit correctly (check Network tab)
7. Exports tab — date range + export format buttons work
8. Notification bell — opens popover, "Mark all read" clears badge
9. Settings link → `/dentist/settings` — Stethoscope icon visible
10. Dental tab in patient consultation — FDI chart renders, tooth states save, tooth notes persist

- [ ] **Step 3: Commit**

```bash
git add app/dentist/settings/page.tsx
git commit -m "fix(dental): replace Sparkles icon with Stethoscope on settings page"
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Covered by Task |
|---|---|
| B1 — toothNotes on POST | Task 2 |
| B2 — toothNotes on PATCH | Task 3 |
| B3 — DELETE permission | Task 1 |
| B4 — Export cursor | Task 4 |
| B5 — patientsCount not shown | Task 5 (extended summary) + Task 15 (Overview stat card) |
| Extended summary API (4 new fields) | Task 5 |
| Extended records API (mode/search/page) | Task 6 |
| FDI tooth chart component | Task 7 |
| dental-tab.tsx redesign | Task 8 |
| Notification bell | Task 9 |
| Exports tab | Task 10 |
| Schedule tab | Task 11 |
| dental-visit-summary.tsx | Task 12 |
| Patient Records tab | Task 13 |
| Clinical Actions tab (Rx/Lab/Radiology) | Task 14 |
| Overview tab (6 stats + quick actions + recent records) | Task 15 |
| DentistShell (5-tab router + header) | Task 16 |
| dentist-dashboard.tsx thin wrapper | Task 17 |
| Settings icon (Sparkles → Stethoscope) | Task 18 |
| Cross-portal communication | Covered by Clinical Actions (Tasks 14) using existing API endpoints |

All spec sections covered. No gaps.
