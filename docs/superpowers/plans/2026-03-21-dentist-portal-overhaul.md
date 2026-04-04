# Dentist Portal Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs, extend the dental API, add an interactive FDI tooth chart, and deliver a fully redesigned dentist portal with sub-navigation tabs (Overview · Patient Records · Schedule · Exports) in an aqua/cyan + pearl white visual identity.

**Architecture:** Modular component architecture under `components/dentist/`. `DentistShell` is the tab router; each tab is a focused component. `dentist-dashboard.tsx` becomes a thin wrapper. Bug fixes land first so subsequent UI work builds on a correct foundation.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase/Postgres (via `queryWithSession`), Zod, lucide-react, sonner (toasts), shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-03-21-dentist-portal-overhaul-design.md`

---

## Phase 1 — Bug Fixes

### Task 1: Fix B3 — Add `delete` to Dentist medical permissions + fix DELETE permission check

**Files:**
- Modify: `lib/security.ts:126-136`
- Modify: `app/api/dental/records/[id]/route.ts:81`

- [ ] **Step 1: Add `"delete"` to Dentist medical permissions in `lib/security.ts`**

Find this block (around line 126):
```ts
  Dentist: {
    patients: ["read"],
    medical: ["read", "create", "update"],
```
Change to:
```ts
  Dentist: {
    patients: ["read"],
    medical: ["read", "create", "update", "delete"],
```

- [ ] **Step 2: Fix DELETE permission check in `app/api/dental/records/[id]/route.ts`**

Find line 81:
```ts
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```
Change to:
```ts
    if (!can(auth.role, "medical", "delete")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
```

- [ ] **Step 3: Verify build passes**

```bash
cd c:/Users/ssego/Documents/dayspring-his && npm run build 2>&1 | tail -20
```
Expected: build succeeds (no type errors in these files).

- [ ] **Step 4: Commit**

```bash
git add lib/security.ts app/api/dental/records/[id]/route.ts
git commit -m "fix(dental): add delete permission to Dentist role; fix DELETE permission check"
```

---

### Task 2: Fix B1 — `toothNotes` never saved on CREATE

**Files:**
- Modify: `app/api/dental/records/route.ts`

- [ ] **Step 1: Add `toothNotes` to `CreateDentalSchema`**

Find:
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

- [ ] **Step 2: Merge `toothNotes` into `tooth_chart` JSONB on insert**

In the `POST` handler, find the insert values array:
```ts
      [
        input.patientId,
        auth.userId,
        input.diagnosis ?? null,
        input.procedurePerformed ?? null,
        input.toothChart ?? null,
        input.notes ?? null,
      ],
```
Replace with:
```ts
      [
        input.patientId,
        auth.userId,
        input.diagnosis ?? null,
        input.procedurePerformed ?? null,
        input.toothNotes
          ? JSON.stringify({ ...(input.toothChart ?? {}), notes: input.toothNotes })
          : input.toothChart ? JSON.stringify(input.toothChart) : null,
        input.notes ?? null,
      ],
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/records/route.ts
git commit -m "fix(dental): merge toothNotes into tooth_chart JSONB on CREATE"
```

---

### Task 3: Fix B2 — `toothNotes` never saved on PATCH

**Files:**
- Modify: `app/api/dental/records/[id]/route.ts`

- [ ] **Step 1: Add `toothNotes` to `UpdateDentalSchema`**

Find:
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

- [ ] **Step 2: Add `toothNotes` handling to the dynamic UPDATE builder**

In the `PATCH` handler, find the block for `toothChart`:
```ts
    if (input.toothChart !== undefined) {
      updates.push(`tooth_chart = $${idx++}::jsonb`)
      values.push(JSON.stringify(input.toothChart))
    }
```
After it, add:
```ts
    if (input.toothNotes !== undefined) {
      updates.push(`tooth_chart = jsonb_set(COALESCE(tooth_chart, '{}'), '{notes}', to_jsonb($${idx++}::text))`)
      values.push(input.toothNotes ?? "")
    }
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/dental/records/[id]/route.ts
git commit -m "fix(dental): save toothNotes via jsonb_set on PATCH"
```

---

### Task 4: Fix B4 — Export cursor uses non-unique `visit_date`; wrong SQL cast

**Files:**
- Modify: `lib/exports/datasets/dental.ts`

- [ ] **Step 1: Change ORDER BY and cursor key from `visit_date` to `id`**

Find:
```ts
      WHERE ($1::timestamp IS NULL OR dr.visit_date >= $1)
        AND ($2::timestamp IS NULL OR dr.visit_date <= $2)
        AND ($3::timestamp IS NULL OR dr.visit_date > $3)
        AND ($5::uuid IS NULL OR dr.dentist_id = $5)
      ORDER BY dr.visit_date ASC
```
Replace with:
```ts
      WHERE ($1::timestamp IS NULL OR dr.visit_date >= $1)
        AND ($2::timestamp IS NULL OR dr.visit_date <= $2)
        AND ($3::uuid IS NULL OR dr.id > $3)
        AND ($5::uuid IS NULL OR dr.dentist_id = $5)
      ORDER BY dr.id ASC
```

- [ ] **Step 2: Update `nextCursor` to use `id`**

Find:
```ts
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].visit_date } : undefined
```
Replace with:
```ts
    const nextCursor =
      rows.length === pageSize ? { after: rows[rows.length - 1].id } : undefined
```

- [ ] **Step 3: Add `dr.id` to the SELECT list so it's available for cursor**

Find:
```ts
      SELECT
        dr.visit_date,
        p.patient_number,
```
Replace with:
```ts
      SELECT
        dr.id,
        dr.visit_date,
        p.patient_number,
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add lib/exports/datasets/dental.ts
git commit -m "fix(dental): use id-based cursor pagination in dental export dataset"
```

---

## Phase 2 — API Extensions

### Task 5: Extend `/api/dental/summary` with 4 new stat fields

**Files:**
- Modify: `app/api/dental/summary/route.ts`

The existing endpoint returns `visitsCount`, `patientsCount`, `recentRecords`. Add `proceduresThisWeek`, `pendingFollowUps`, `pendingLabResults`, `pendingPreAuths`.

- [ ] **Step 1: Add `patientsThisMonth` and `proceduresThisWeek` queries**

After the `recentRecords` query block, before the `return NextResponse.json(...)` line, add:

```ts
  // Patients this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
  const monthSql = onlyMine
    ? `SELECT COUNT(DISTINCT patient_id) AS patients_this_month FROM dental_records WHERE dentist_id = $1 AND visit_date >= $2::timestamp AND visit_date <= $3::timestamp`
    : `SELECT COUNT(DISTINCT patient_id) AS patients_this_month FROM dental_records WHERE visit_date >= $1::timestamp AND visit_date <= $2::timestamp`
  const monthParams = onlyMine ? [auth.userId, monthStart, monthEnd] : [monthStart, monthEnd]
  const { rows: monthRows } = await queryWithSession(session, monthSql, monthParams)
  const patientsThisMonth = parseInt(String(monthRows[0]?.patients_this_month ?? 0), 10)

  // Procedures this week
  const weekSql = onlyMine
    ? `SELECT COUNT(*) AS procedures_this_week FROM dental_records WHERE dentist_id = $1 AND procedure_performed IS NOT NULL AND visit_date >= date_trunc('week', CURRENT_TIMESTAMP) AND visit_date < date_trunc('week', CURRENT_TIMESTAMP) + INTERVAL '7 days'`
    : `SELECT COUNT(*) AS procedures_this_week FROM dental_records WHERE procedure_performed IS NOT NULL AND visit_date >= date_trunc('week', CURRENT_TIMESTAMP) AND visit_date < date_trunc('week', CURRENT_TIMESTAMP) + INTERVAL '7 days'`
  const weekParams = onlyMine ? [auth.userId] : []
  const { rows: weekRows } = await queryWithSession(session, weekSql, weekParams)
  const proceduresThisWeek = parseInt(String(weekRows[0]?.procedures_this_week ?? 0), 10)
```

- [ ] **Step 2: Add `pendingFollowUps`, `pendingLabResults`, `pendingPreAuths` queries**

```ts
  // Pending follow-up appointments in dental department
  const followUpSql = onlyMine
    ? `SELECT COUNT(*) AS pending FROM appointments WHERE doctor_name = $1 AND department ILIKE 'dental' AND status = 'Pending'`
    : `SELECT COUNT(*) AS pending FROM appointments WHERE department ILIKE 'dental' AND status = 'Pending'`
  const followUpParams = onlyMine ? [auth.userId] : []
  let pendingFollowUps = 0
  try {
    const { rows: followUpRows } = await queryWithSession(session, followUpSql, followUpParams)
    pendingFollowUps = parseInt(String(followUpRows[0]?.pending ?? 0), 10)
  } catch { pendingFollowUps = 0 }

  // Pending lab results ordered by this dentist
  let pendingLabResults = 0
  try {
    const { rows: labRows } = await queryWithSession(
      session,
      `SELECT COUNT(*) AS pending FROM lab_tests WHERE requested_by = $1 AND status NOT IN ('Completed', 'Reviewed')`,
      [auth.userId],
    )
    pendingLabResults = parseInt(String(labRows[0]?.pending ?? 0), 10)
  } catch { pendingLabResults = 0 }

  // Pending dental insurance pre-auths
  let pendingPreAuths = 0
  try {
    const { rows: preAuthRows } = await queryWithSession(
      session,
      `SELECT COUNT(*) AS pending FROM insurance_authorizations WHERE status = 'Pending' AND service_category ILIKE '%dental%'`,
      [],
    )
    pendingPreAuths = parseInt(String(preAuthRows[0]?.pending ?? 0), 10)
  } catch { pendingPreAuths = 0 }
```

- [ ] **Step 3: Add new fields to the JSON response**

Find:
```ts
  return NextResponse.json({
    visitsCount,
    patientsCount,
    recentRecords,
    ...(fromParam && toParam ? { from: fromParam, to: toParam } : {}),
  })
```
Replace with:
```ts
  return NextResponse.json({
    visitsCount,
    patientsCount,
    patientsThisMonth,
    proceduresThisWeek,
    pendingFollowUps,
    pendingLabResults,
    pendingPreAuths,
    recentRecords,
    ...(fromParam && toParam ? { from: fromParam, to: toParam } : {}),
  })
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add app/api/dental/summary/route.ts
git commit -m "feat(dental): extend summary API with 4 new stat fields"
```

---

### Task 6: Extend `/api/dental/records` — add `mode=mine`, `search`, `page` params

**Files:**
- Modify: `app/api/dental/records/route.ts`

Currently `patientId` is required. After this task: either `patientId` OR `mode=mine` must be provided.

- [ ] **Step 1: Update the `GET` handler to support new query params**

Replace the entire `GET` function body with:

```ts
export async function GET(req: Request) {
  const url = new URL(req.url)
  const patientId = (url.searchParams.get("patientId") || "").trim()
  const mode = (url.searchParams.get("mode") || "").trim()
  const search = (url.searchParams.get("search") || "").trim()
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
  const limit = 20
  const offset = (page - 1) * limit

  if (!patientId && mode !== "mine") {
    return NextResponse.json({ error: "patientId or mode=mine is required" }, { status: 400 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const session = { role: auth.role, userId: auth.userId }

  if (patientId) {
    // Existing behaviour — fetch all records for one patient
    const { rows } = await queryWithSession(
      session,
      `SELECT id, patient_id, dentist_id, visit_date, diagnosis, procedure_performed, tooth_chart, notes
         FROM dental_records
        WHERE patient_id = $1
        ORDER BY visit_date DESC
        LIMIT 100`,
      [patientId],
    )
    return NextResponse.json({ records: rows })
  }

  // mode=mine — paginated list for Patient Records tab
  const searchWhere = search
    ? `AND (p.first_name ILIKE $3 OR p.last_name ILIKE $3 OR p.patient_number ILIKE $3
           OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $3)`
    : ""
  const searchParam = search ? `%${search}%` : null
  const baseParams: unknown[] = [auth.userId, limit]
  const countParams: unknown[] = [auth.userId]
  if (search) { baseParams.push(searchParam); countParams.push(searchParam) }
  baseParams.push(offset)

  const { rows } = await queryWithSession(
    session,
    `SELECT dr.id, dr.patient_id, dr.visit_date, dr.diagnosis, dr.procedure_performed,
            dr.tooth_chart, dr.notes,
            p.patient_number, p.first_name, p.last_name
       FROM dental_records dr
       JOIN patients p ON p.id = dr.patient_id
      WHERE dr.dentist_id = $1
        ${searchWhere}
      ORDER BY dr.visit_date DESC
      LIMIT $2 OFFSET $${baseParams.length}`,
    baseParams,
  )

  const { rows: countRows } = await queryWithSession(
    session,
    `SELECT COUNT(*) AS total FROM dental_records dr JOIN patients p ON p.id = dr.patient_id
      WHERE dr.dentist_id = $1 ${searchWhere}`,
    countParams,
  )
  const total = parseInt(String(countRows[0]?.total ?? 0), 10)

  return NextResponse.json({ records: rows, total, page, pages: Math.ceil(total / limit) })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/dental/records/route.ts
git commit -m "feat(dental): extend records API with mode=mine, search, pagination"
```

---

## Phase 3 — FDI Tooth Chart Component

### Task 7: Create `fdi-tooth-chart.tsx`

**Files:**
- Create: `components/dentist/fdi-tooth-chart.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"

export type ToothState = "normal" | "caries" | "filled" | "crown" | "missing" | "extracted"

export type ToothData = { state: ToothState; notes?: string }

export type ToothChartData = {
  [toothId: string]: ToothData
  notes?: string
} & Record<string, any>

interface FdiToothChartProps {
  value: ToothChartData
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}

const STATE_CYCLE: ToothState[] = ["normal", "caries", "filled", "crown", "missing", "extracted"]

const STATE_CONFIG: Record<ToothState, { label: string; bg: string; border: string; text: string }> = {
  normal:    { label: "—",  bg: "bg-white",         border: "border-cyan-200",  text: "text-slate-400" },
  caries:    { label: "C",  bg: "bg-amber-100",     border: "border-amber-400", text: "text-amber-700" },
  filled:    { label: "F",  bg: "bg-blue-100",      border: "border-blue-400",  text: "text-blue-700"  },
  crown:     { label: "Cr", bg: "bg-purple-100",    border: "border-purple-400",text: "text-purple-700"},
  missing:   { label: "M",  bg: "bg-slate-100",     border: "border-slate-400", text: "text-slate-500" },
  extracted: { label: "X",  bg: "bg-rose-100",      border: "border-rose-400",  text: "text-rose-600"  },
}

// FDI notation: upper right 18-11, upper left 21-28, lower left 31-38, lower right 48-41
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]

function ToothSquare({
  id,
  data,
  selected,
  readOnly,
  onClick,
}: {
  id: number
  data: ToothData
  selected: boolean
  readOnly: boolean
  onClick: () => void
}) {
  const cfg = STATE_CONFIG[data.state]
  const hasNotes = Boolean(data.notes)
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onClick}
      title={`Tooth ${id}${data.notes ? ` — ${data.notes}` : ""}`}
      className={cn(
        "relative flex h-9 w-9 flex-col items-center justify-center rounded border text-[10px] font-semibold transition-all select-none",
        cfg.bg, cfg.border, cfg.text,
        selected && "ring-2 ring-cyan-500 ring-offset-1",
        !readOnly && "hover:opacity-80 cursor-pointer",
        readOnly && "cursor-default",
      )}
    >
      <span className="leading-none">{id}</span>
      <span className="leading-none opacity-70">{data.state !== "normal" ? cfg.label : ""}</span>
      {hasNotes && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-500" />
      )}
    </button>
  )
}

export function FdiToothChart({ value, onChange, readOnly = false }: FdiToothChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  const getTooth = (id: number): ToothData => {
    const raw = value[String(id)]
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { state: "normal" }
    return { state: (raw as any).state ?? "normal", notes: (raw as any).notes }
  }

  const cycleState = (id: number) => {
    if (readOnly) return
    const current = getTooth(id)
    const idx = STATE_CYCLE.indexOf(current.state)
    const next = STATE_CYCLE[(idx + 1) % STATE_CYCLE.length]
    onChange({ ...value, [String(id)]: { ...current, state: next } })
    setSelectedTooth(id)
  }

  const handleToothClick = (id: number) => {
    if (readOnly) return
    if (selectedTooth === id) {
      cycleState(id)
    } else {
      setSelectedTooth(id)
    }
  }

  const updateNotes = (id: number, notes: string) => {
    const current = getTooth(id)
    onChange({ ...value, [String(id)]: { ...current, notes: notes || undefined } })
  }

  const updateGeneralNotes = (notes: string) => {
    onChange({ ...value, notes: notes || undefined })
  }

  const renderRow = (teeth: number[]) => (
    <div className="flex gap-1">
      {teeth.map((id) => (
        <ToothSquare
          key={id}
          id={id}
          data={getTooth(id)}
          selected={selectedTooth === id}
          readOnly={readOnly}
          onClick={() => handleToothClick(id)}
        />
      ))}
    </div>
  )

  const selectedData = selectedTooth ? getTooth(selectedTooth) : null

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="rounded-xl border border-cyan-100 bg-slate-50 p-3 space-y-1 overflow-x-auto">
        <div className="flex gap-1 justify-center mb-0.5">
          <span className="text-[10px] text-slate-400 w-full text-center">Upper</span>
        </div>
        <div className="flex justify-center gap-2">
          {renderRow(UPPER_RIGHT)}
          <div className="w-px bg-cyan-200 self-stretch" />
          {renderRow(UPPER_LEFT)}
        </div>
        <div className="border-t border-dashed border-cyan-200 my-1" />
        <div className="flex justify-center gap-2">
          {renderRow(LOWER_RIGHT)}
          <div className="w-px bg-cyan-200 self-stretch" />
          {renderRow(LOWER_LEFT)}
        </div>
        <div className="flex gap-1 justify-center mt-0.5">
          <span className="text-[10px] text-slate-400 w-full text-center">Lower</span>
        </div>
      </div>

      {/* Selected tooth notes panel */}
      {!readOnly && selectedTooth && selectedData && (
        <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-700">
              Tooth {selectedTooth} — {STATE_CONFIG[selectedData.state].label !== "—" ? `${selectedData.state}` : "normal"}
            </span>
            <div className="flex gap-1">
              {STATE_CYCLE.filter((s) => s !== selectedData.state).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const current = getTooth(selectedTooth)
                    onChange({ ...value, [String(selectedTooth)]: { ...current, state: s } })
                  }}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px]",
                    STATE_CONFIG[s].bg, STATE_CONFIG[s].border, STATE_CONFIG[s].text,
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            placeholder={`Notes for tooth ${selectedTooth}…`}
            value={selectedData.notes ?? ""}
            onChange={(e) => updateNotes(selectedTooth, e.target.value)}
            className="w-full rounded border border-cyan-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
        </div>
      )}

      {/* General chart notes */}
      {!readOnly && (
        <input
          type="text"
          placeholder="General chart notes…"
          value={typeof value.notes === "string" ? value.notes : ""}
          onChange={(e) => updateGeneralNotes(e.target.value)}
          className="w-full rounded border border-cyan-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400"
        />
      )}
      {readOnly && typeof value.notes === "string" && value.notes && (
        <p className="text-xs text-slate-500 italic">{value.notes}</p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {STATE_CYCLE.filter((s) => s !== "normal").map((s) => (
          <span
            key={s}
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px]",
              STATE_CONFIG[s].bg, STATE_CONFIG[s].border, STATE_CONFIG[s].text,
            )}
          >
            {STATE_CONFIG[s].label} = {s}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/fdi-tooth-chart.tsx
git commit -m "feat(dental): add interactive FDI 32-tooth chart component"
```

---

## Phase 4 — Dentist Shell & Tabs

### Task 8: Create `dentist-exports.tsx`

**Files:**
- Create: `components/dentist/dentist-exports.tsx`

- [ ] **Step 1: Create the exports tab component**

```tsx
"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { toast } from "sonner"

export function DentistExports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [mineOnly, setMineOnly] = useState(false)
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "pdf" | null>(null)

  const run = async (format: "csv" | "xlsx" | "pdf") => {
    const fromDate = new Date(from + "T00:00:00Z").getTime()
    const toDate = new Date(to + "T23:59:59Z").getTime()
    if (fromDate > toDate) { toast.error("From date must be on or before To date"); return }
    setExporting(format)
    try {
      const payload: Record<string, unknown> = {
        dataset: "dental",
        format,
        filters: {
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T23:59:59Z").toISOString(),
        },
      }
      if (mineOnly) payload.filters = { ...(payload.filters as object), recordedByUserId: true }
      const res = await fetch("/api/exports/direct", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as any).error || "Export failed"); return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `dental-${from}-${to}.${format}`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Dental export (${format.toUpperCase()}) downloaded`)
    } catch { toast.error("Export failed") } finally { setExporting(null) }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Dental Exports</p>

      <Card className="rounded-2xl border border-cyan-100 bg-white shadow-sm shadow-cyan-100/50">
        <CardHeader>
          <CardTitle className="text-base">Download Dental Records</CardTitle>
          <CardDescription className="text-sm">
            Export dental visit summaries for a date range. Choose CSV for spreadsheets, XLSX for Excel, or PDF for printable reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-cyan-200 focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-cyan-200 focus-visible:ring-cyan-400" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
              className="rounded border-cyan-300 text-cyan-600"
            />
            Export my records only
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
              <Button
                key={fmt}
                variant="outline"
                size="sm"
                onClick={() => run(fmt)}
                disabled={!!exporting}
                className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
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

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-exports.tsx
git commit -m "feat(dental): add DentistExports tab component"
```

---

### Task 9: Create `dentist-schedule.tsx`

**Files:**
- Create: `components/dentist/dentist-schedule.tsx`

- [ ] **Step 1: Create the schedule tab**

```tsx
"use client"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"

export function DentistSchedule() {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Today&apos;s Schedule</p>
      <div className="rounded-2xl border border-cyan-100 bg-cyan-50/30 p-1 shadow-sm shadow-cyan-100/50">
        <DoctorDashboard title="Dentist Schedule" showDentalQueueFilter />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-schedule.tsx
git commit -m "feat(dental): add DentistSchedule tab component"
```

---

### Task 10: Create `dentist-patient-records.tsx`

**Files:**
- Create: `components/dentist/dentist-patient-records.tsx`

- [ ] **Step 1: Create the patient records tab**

```tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ChevronLeft, ChevronRight, User } from "lucide-react"

interface DentalRecordRow {
  id: string
  patient_id: string
  visit_date: string | null
  diagnosis: string | null
  procedure_performed: string | null
  patient_number: string | null
  first_name: string | null
  last_name: string | null
}

interface DentistPatientRecordsProps {
  onOpenPatient: (patientId: string) => void
}

export function DentistPatientRecords({ onOpenPatient }: DentistPatientRecordsProps) {
  const [records, setRecords] = useState<DentalRecordRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  const load = useCallback(async (p: number, s: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ mode: "mine", page: String(p) })
      if (s) params.set("search", s)
      const res = await fetch(`/api/dental/records?${params}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setRecords(Array.isArray(data.records) ? data.records : [])
        setTotal(data.total ?? 0)
        setPages(data.pages ?? 1)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { setPage(1) }, [debouncedSearch])
  useEffect(() => { void load(page, debouncedSearch) }, [load, page, debouncedSearch])

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Patient Records</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by patient name or number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-cyan-200 focus-visible:ring-cyan-400"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-cyan-100 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <Card className="rounded-2xl border border-cyan-100">
          <CardContent className="py-10 text-center text-sm text-slate-500">
            No dental records found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((r) => {
            const patientName = [r.first_name, r.last_name].filter(Boolean).join(" ") || "Unknown"
            return (
              <button
                key={r.id}
                onClick={() => onOpenPatient(r.patient_id)}
                className="w-full rounded-xl border border-cyan-100 bg-white px-4 py-3 text-left shadow-sm shadow-cyan-50 hover:bg-cyan-50/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-xl bg-cyan-50 p-2 shrink-0">
                      <User className="h-4 w-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{patientName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {r.patient_number ? `#${r.patient_number}` : ""}{r.diagnosis ? ` · ${r.diagnosis}` : ""}{r.procedure_performed ? ` · ${r.procedure_performed}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {r.visit_date ? String(r.visit_date).slice(0, 10) : "—"}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} record{total !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{page} / {pages}</span>
            <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage((p) => p + 1)}
              className="border-cyan-200 text-cyan-700 hover:bg-cyan-50">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-patient-records.tsx
git commit -m "feat(dental): add DentistPatientRecords tab with search and pagination"
```

---

### Task 11: Create `dentist-overview.tsx`

**Files:**
- Create: `components/dentist/dentist-overview.tsx`

- [ ] **Step 1: Create the overview tab with 6-stat grid and recent records**

```tsx
"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Stethoscope, Users, Activity, Clock, FlaskConical, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface DentalStats {
  visitsCount: number
  patientsThisMonth: number
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

interface DentistOverviewProps {
  onOpenPatient: (patientId: string, tab?: string) => void
}

const STAT_CARDS = (s: DentalStats) => [
  { label: "Today's Visits",        value: s.visitsCount,         icon: Stethoscope,   accent: "text-cyan-600",   bg: "bg-cyan-50" },
  { label: "Patients This Month",   value: s.patientsThisMonth,   icon: Users,         accent: "text-teal-600",   bg: "bg-teal-50" },
  { label: "Procedures This Week",  value: s.proceduresThisWeek,  icon: Activity,      accent: "text-sky-600",    bg: "bg-sky-50" },
  { label: "Pending Follow-ups",    value: s.pendingFollowUps,    icon: Clock,         accent: "text-amber-600",  bg: "bg-amber-50" },
  { label: "Pending Lab Results",   value: s.pendingLabResults,   icon: FlaskConical,  accent: "text-indigo-600", bg: "bg-indigo-50" },
  { label: "Insurance Pre-auths",   value: s.pendingPreAuths,     icon: ShieldCheck,   accent: "text-rose-600",   bg: "bg-rose-50" },
]

export function DentistOverview({ onOpenPatient }: DentistOverviewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [stats, setStats] = useState<DentalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const from = new Date(today + "T00:00:00Z").toISOString()
    const to = new Date(today + "T23:59:59Z").toISOString()
    setLoading(true)
    fetch(`/api/dental/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats({
          visitsCount:        data.visitsCount ?? 0,
          patientsThisMonth:  data.patientsThisMonth ?? 0,
          proceduresThisWeek: data.proceduresThisWeek ?? 0,
          pendingFollowUps:   data.pendingFollowUps ?? 0,
          pendingLabResults:  data.pendingLabResults ?? 0,
          pendingPreAuths:    data.pendingPreAuths ?? 0,
          recentRecords:      Array.isArray(data.recentRecords) ? data.recentRecords : [],
        })
        else if (!cancelled) setStats(null)
      })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [today])

  const cards = stats ? STAT_CARDS(stats) : null

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Overview</p>

      {/* 6-stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-cyan-100 bg-slate-50 animate-pulse" />
            ))
          : (cards ?? []).map((c) => (
              <Card key={c.label} className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/40 shadow-sm shadow-cyan-100/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-slate-600">{c.label}</CardTitle>
                  <div className={cn("rounded-xl p-2", c.bg)}>
                    <c.icon className={cn("h-4 w-4", c.accent)} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-3xl font-bold text-slate-800">{c.value}</div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Recent records */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-600">Recent Records</p>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl border border-cyan-100 bg-slate-50 animate-pulse" />)}
          </div>
        ) : !stats?.recentRecords?.length ? (
          <p className="text-sm text-slate-500">No recent dental records.</p>
        ) : (
          <div className="space-y-2">
            {stats.recentRecords.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpenPatient(r.patientId, "dental")}
                className="w-full rounded-xl border border-cyan-100 bg-white px-4 py-3 text-left shadow-sm hover:bg-cyan-50/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{r.patientName}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {r.diagnosis || r.procedurePerformed || "Visit"}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {r.visitDate ? String(r.visitDate).slice(0, 10) : "—"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-overview.tsx
git commit -m "feat(dental): add DentistOverview tab with 6-stat grid and recent records"
```

---

### Task 12: Create `dentist-shell.tsx`

**Files:**
- Create: `components/dentist/dentist-shell.tsx`

The shell is the tab router. It also listens for the `openDentalConsult` custom event dispatched by the notification system (added in Task 14).

- [ ] **Step 1: Create the shell**

```tsx
"use client"
import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { PatientConsultation } from "@/components/doctor/patient-consultation"
import type { ConsultTab } from "@/components/doctor/patient-consultation"
import { DentistOverview } from "./dentist-overview"
import { DentistPatientRecords } from "./dentist-patient-records"
import { DentistSchedule } from "./dentist-schedule"
import { DentistExports } from "./dentist-exports"

type DentistTab = "overview" | "records" | "schedule" | "exports"

const TABS: { id: DentistTab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "records",   label: "Patient Records" },
  { id: "schedule",  label: "Schedule" },
  { id: "exports",   label: "Exports" },
]

interface SelectedPatient { id: string; tab: ConsultTab }

export function DentistShell() {
  const [activeTab, setActiveTab] = useState<DentistTab>("overview")
  const [selected, setSelected] = useState<SelectedPatient | null>(null)

  const openPatient = useCallback((patientId: string, tab: string = "dental") => {
    setSelected({ id: patientId, tab: tab as ConsultTab })
  }, [])

  // Listen for notification-driven open events from dashboard-layout
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.patientId) openPatient(detail.patientId, detail.initialTab ?? "dental")
    }
    window.addEventListener("openDentalConsult", handler)
    return () => window.removeEventListener("openDentalConsult", handler)
  }, [openPatient])

  return (
    <>
      {/* Tab navigation */}
      <div className="mb-6">
        <div className="flex gap-0 border-b border-cyan-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === t.id
                  ? "border-b-2 border-cyan-600 text-cyan-700"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview"  && <DentistOverview onOpenPatient={openPatient} />}
      {activeTab === "records"   && <DentistPatientRecords onOpenPatient={openPatient} />}
      {activeTab === "schedule"  && <DentistSchedule />}
      {activeTab === "exports"   && <DentistExports />}

      {/* Patient consultation sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <SheetContent side="right" className="w-full max-w-4xl overflow-y-auto p-0 sm:max-w-4xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Patient Consultation</SheetTitle>
            <SheetDescription>Dental consultation and records for selected patient</SheetDescription>
          </SheetHeader>
          {selected && (
            <PatientConsultation
              patientId={selected.id}
              initialTab={selected.tab}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dentist/dentist-shell.tsx
git commit -m "feat(dental): add DentistShell tab router with patient consultation sheet"
```

---

## Phase 5 — Wire Shell into Dashboard

### Task 13: Replace `dentist-dashboard.tsx` content with `DentistShell`

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

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboards/dentist-dashboard.tsx
git commit -m "refactor(dental): dentist-dashboard becomes thin wrapper for DentistShell"
```

---

### Task 14: Add dentist notification routing to `dashboard-layout.tsx`

**Files:**
- Modify: `components/dashboard-layout.tsx`

The existing `NotificationsBell` handles all roles but falls through to a generic `openClinicianConsult` event for dentists. Add a dedicated `dentist` case that dispatches `openDentalConsult` instead.

- [ ] **Step 1: Add dentist action routing in `openNotificationTarget`**

In the `openNotificationTarget` callback, find the nurse block:
```ts
    if (normalizedRole === 'nurse') {
      const initialTab = /new patient registered/i.test(notification.title || '') ? 'triage' : 'vitals'
      window.dispatchEvent(new CustomEvent('openNursePatientCare', { detail: { patientId, initialTab, notificationId: notification.id } }))
      return
    }
```
After it (before the final generic `openClinicianConsult` dispatch), add:
```ts
    if (normalizedRole === 'dentist') {
      window.dispatchEvent(new CustomEvent('openDentalConsult', { detail: { patientId, initialTab: 'dental', notificationId: notification.id } }))
      return
    }
```

- [ ] **Step 2: Add dentist open action in the SSE toast section**

In the `setItems` updater inside the SSE `source.onmessage`, find the nurse case:
```ts
                  : normalizedRole === 'nurse' && (patientId || payload?.checkinId || payload?.appointmentId || payload?.paymentId)
```
Before `patientId` generic fallback (the last `? { label: 'Open', onClick: () => { try { window.dispatchEvent(new CustomEvent('openClinicianConsult'...` block), add a dentist case:

Find the pattern just before the final patientId block:
```ts
                  : patientId
                    ? {
                        label: 'Open',
                        onClick: () => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent('openClinicianConsult',
```
Replace the entire final `patientId` ternary with:
```ts
                  : normalizedRole === 'dentist' && patientId
                    ? {
                        label: 'Open',
                        onClick: () => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent('openDentalConsult', {
                                detail: { patientId, initialTab: 'dental', notificationId: firstVisible.id },
                              }),
                            )
                          } catch {}
                        },
                      }
                  : patientId
                    ? {
                        label: 'Open',
                        onClick: () => {
                          try {
                            window.dispatchEvent(
                              new CustomEvent('openClinicianConsult', {
                                detail: { patientId, initialTab: isAppointmentNotification ? 'consultation' : 'labs', notificationId: firstVisible.id },
                              }),
                            )
                          } catch {}
                        },
                      }
                  : undefined
```

- [ ] **Step 3: Update the `getNotificationHint` function for dentist**

Find the nurse hint:
```ts
    if (normalizedRole === 'nurse') {
      return /new patient registered/i.test(notification.title || '') ? 'Click to start triage' : 'Click to open patient care'
    }
```
After it, add:
```ts
    if (normalizedRole === 'dentist') {
      return patientId ? 'Click to open dental consultation' : null
    }
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-layout.tsx
git commit -m "feat(dental): add dentist notification routing in dashboard-layout"
```

---

## Phase 6 — Dental Tab Redesign

### Task 15: Redesign `dental-tab.tsx` with FDI chart and cyan theme

**Files:**
- Modify: `components/doctor/consultation-tabs/dental-tab.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FdiToothChart, type ToothChartData } from "@/components/dentist/fdi-tooth-chart"
import { toast } from "sonner"

interface DentalTabProps {
  patient: Patient
  user: User
  onRecordsChange?: (records: DentalRecord[]) => void
}

interface DentalRecord {
  id: string
  diagnosis?: string | null
  procedure_performed?: string | null
  visit_date?: string | null
  notes?: string | null
  tooth_chart?: ToothChartData | null
}

interface DentalFormState {
  diagnosis: string
  procedurePerformed: string
  toothNotes: string
  visitDate: string
  toothChart: ToothChartData
}

const EMPTY_FORM: DentalFormState = {
  diagnosis: "", procedurePerformed: "", toothNotes: "", visitDate: "", toothChart: {},
}

function parseToothChart(raw: any): ToothChartData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as ToothChartData
}

export function DentalTab({ patient, user, onRecordsChange }: DentalTabProps) {
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [form, setForm] = useState<DentalFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DentalFormState>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onRecordsChangeRef = useRef(onRecordsChange)
  useEffect(() => { onRecordsChangeRef.current = onRecordsChange }, [onRecordsChange])

  const loadRecords = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/dental/records?patientId=${encodeURIComponent(pid)}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const recs = Array.isArray(data.records) ? data.records : []
        setRecords(recs)
        onRecordsChangeRef.current?.(recs)
      } else {
        toast.error("Failed to load dental records")
      }
    } catch { toast.error("Failed to load dental records") }
  }, [])

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
        toothChart: Object.keys(form.toothChart).length ? form.toothChart : null,
      }
      if (form.visitDate) payload.visitDate = form.visitDate
      const res = await fetch("/api/dental/records", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || "Failed to save")
      }
      toast.success("Dental record saved.")
      setForm(EMPTY_FORM)
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
      toothChart: parseToothChart(r.tooth_chart),
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
        toothChart: Object.keys(editForm.toothChart).length ? editForm.toothChart : null,
      }
      if (editForm.visitDate) payload.visitDate = editForm.visitDate
      const res = await fetch(`/api/dental/records/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as any).error || "Failed to update")
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
        throw new Error((data as any).error || "Failed to delete")
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
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">Dental Records</p>

      {/* Existing records */}
      {records.length > 0 && (
        <div className="space-y-3">
          {records.map((r) => {
            const toothNotes = typeof r.tooth_chart?.notes === "string" ? r.tooth_chart.notes : r.notes
            return (
              <div key={r.id} className="rounded-xl border-l-4 border-cyan-400 bg-cyan-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 text-sm flex-1 min-w-0">
                    {r.visit_date && <div className="font-semibold text-slate-700">{String(r.visit_date).slice(0, 10)}</div>}
                    {r.diagnosis && <div className="text-slate-700">Dx: {r.diagnosis}</div>}
                    {r.procedure_performed && <div className="text-slate-700">Procedure: {r.procedure_performed}</div>}
                    {toothNotes && <div className="text-slate-500 italic text-xs">{toothNotes}</div>}
                    {/* Show tooth chart summary if has per-tooth data */}
                    {r.tooth_chart && Object.keys(r.tooth_chart).some((k) => k !== "notes") && (
                      <div className="mt-2">
                        <FdiToothChart
                          value={parseToothChart(r.tooth_chart)}
                          onChange={() => {}}
                          readOnly
                        />
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}
                        className="border-cyan-200 text-cyan-700 hover:bg-cyan-50">Edit</Button>
                      <Button
                        size="sm" variant="outline"
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

      {records.length === 0 && (
        <p className="text-sm text-slate-500">No dental records on file.</p>
      )}

      {/* New record form — Dentist only */}
      {user.role === "Dentist" && (
        <div className="rounded-2xl border border-cyan-100 bg-white p-5 space-y-4 shadow-sm shadow-cyan-100/50">
          <p className="text-sm font-semibold text-cyan-700">New Dental Record</p>

          <div className="space-y-1">
            <Label htmlFor="dental-visit-date" className="text-xs">Visit Date</Label>
            <Input
              id="dental-visit-date" type="datetime-local"
              value={form.visitDate}
              onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
              className="border-cyan-200 focus-visible:ring-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="dental-diagnosis" className="text-xs">Dental Diagnosis</Label>
            <Textarea
              id="dental-diagnosis"
              value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Caries, pulpitis, periodontal disease…"
              className="min-h-[60px] border-cyan-200 focus-visible:ring-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="dental-procedure" className="text-xs">Procedure Performed</Label>
            <Textarea
              id="dental-procedure"
              value={form.procedurePerformed}
              onChange={(e) => setForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
              placeholder="Extraction, filling, root canal, scaling…"
              className="min-h-[60px] border-cyan-200 focus-visible:ring-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tooth Chart</Label>
            <FdiToothChart
              value={form.toothChart}
              onChange={(data) => {
                const { notes, ...teeth } = data
                setForm((f) => ({ ...f, toothChart: teeth, toothNotes: notes ?? f.toothNotes }))
              }}
            />
          </div>

          <Button
            onClick={handleSave} disabled={saving}
            className="bg-cyan-600 text-white hover:bg-cyan-700"
          >
            {saving ? "Saving…" : "Save Dental Record"}
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null) }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Dental Record</DialogTitle>
            <DialogDescription>Update visit date, diagnosis, procedure, and tooth chart.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-dental-visit-date" className="text-xs">Visit Date</Label>
              <Input
                id="edit-dental-visit-date" type="datetime-local"
                value={editForm.visitDate}
                onChange={(e) => setEditForm((f) => ({ ...f, visitDate: e.target.value }))}
                className="border-cyan-200 focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dental-diagnosis" className="text-xs">Dental Diagnosis</Label>
              <Textarea
                id="edit-dental-diagnosis"
                value={editForm.diagnosis}
                onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                className="border-cyan-200 focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dental-procedure" className="text-xs">Procedure Performed</Label>
              <Textarea
                id="edit-dental-procedure"
                value={editForm.procedurePerformed}
                onChange={(e) => setEditForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
                className="border-cyan-200 focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tooth Chart</Label>
              <FdiToothChart
                value={editForm.toothChart}
                onChange={(data) => {
                  const { notes, ...teeth } = data
                  setEditForm((f) => ({ ...f, toothChart: teeth, toothNotes: notes ?? f.toothNotes }))
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}
              className="bg-cyan-600 text-white hover:bg-cyan-700">
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 3: Commit**

```bash
git add components/doctor/consultation-tabs/dental-tab.tsx
git commit -m "feat(dental): redesign dental-tab with FDI chart and cyan theme"
```

---

## Phase 7 — Final Verification & Push

### Task 16: Full build verification and push

- [ ] **Step 1: Run full production build**

```bash
cd c:/Users/ssego/Documents/dayspring-his && npm run build 2>&1
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: If build errors exist**

Common issues to check:
- Missing `import type` where needed — TypeScript strict mode requires `import type` for type-only imports
- `ToothChartData` index signature conflict — if TypeScript complains about `notes?: string` on `ToothChartData`, change to `& { notes?: string }` intersection or use `Record<string, any> & { notes?: string }`
- `cn` not imported — verify `import { cn } from "@/lib/utils"` in each new file
- `SheetDescription` accessibility warning — verify it has content or `className="sr-only"`

- [ ] **Step 3: Commit any build fixes**

```bash
git add -A
git commit -m "fix(dental): resolve TypeScript build errors in portal overhaul"
```

- [ ] **Step 4: Push to remote**

```bash
git push origin main
```

---

## Summary of All Changes

| Phase | Tasks | Files Changed |
|---|---|---|
| Bug Fixes | 1–4 | security.ts, records/route.ts, records/[id]/route.ts, dental.ts (export) |
| API Extensions | 5–6 | summary/route.ts, records/route.ts |
| FDI Chart | 7 | fdi-tooth-chart.tsx (new) |
| Shell & Tabs | 8–12 | dentist-exports.tsx, dentist-schedule.tsx, dentist-patient-records.tsx, dentist-overview.tsx, dentist-shell.tsx (all new) |
| Wire | 13–14 | dentist-dashboard.tsx, dashboard-layout.tsx |
| Dental Tab | 15 | dental-tab.tsx |
| Verify | 16 | — |

**Total new files:** 6 (`components/dentist/`)
**Total modified files:** 7
**Total commits:** ~16 (one per task)
