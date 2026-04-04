# Doctor's Portal — Comprehensive Audit Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken functionality in the Doctor's Portal — critical missing API routes, type safety issues, and notification system upgrade — producing a fully functional, polished portal.

**Architecture:** Component-by-component approach. Each task fixes one thing completely (both API and UI where applicable) before moving to the next. The audit revealed that the portal is ~85% complete; the remaining work is focused on 5 concrete gaps.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL 17, `pg` pool, shadcn/ui, Tailwind CSS 4, Sonner toasts, JWT auth via `verifyToken()` from `@/lib/security`, `queryWithSession()` from `@/lib/db`, Server-Sent Events (SSE).

---

## Pre-flight: What Is Already Done

Before starting, understand these are **complete and must not be changed**:
- `doctor-dashboard.tsx` — hero, stat cards, shift snapshot clock, Sheet, openClinicianConsult event
- `patient-consultation.tsx` — all 9 tabs, sticky header, SSE setup, allergy chip
- `patient-queue.tsx` — shadcn Table, teal search ring, row hover, empty state
- `consultation-tab.tsx` — AlertDialog, Ctrl+Enter, vital accents, section labels
- `prescription-tab.tsx` — amber accents, segmented visit-type buttons, OPD billing toast
- `labs-tab.tsx` — violet accents, critical row highlight, SSE handler, status badges
- `history-tab.tsx` — emerald accent cards, edit dialog, form validation (only needs its API)
- `allergies-tab.tsx`, `chronic-conditions-tab.tsx`, `immunizations-tab.tsx`, `documents-tab.tsx`, `dental-tab.tsx` — all polished
- `clinician/page.tsx` — export panel (medical records + prescriptions, CSV/XLSX/PDF)
- Settings page — uses SettingsLayout with all 5 panels
- Billing gate — prescriptions route already auto-creates OPD bills and notifies pharmacists

---

## File Map

| Status | File | Change |
|---|---|---|
| **CREATE** | `app/api/obstetrics/assessments/route.ts` | GET + POST handlers |
| **CREATE** | `app/api/obstetrics/assessments/[id]/route.ts` | PATCH handler |
| **MODIFY** | `components/doctor/order-lab-test.tsx` | Replace 3 `any` types |
| **MODIFY** | `components/doctor/clinician-notification-bell.tsx` | SSE-first with polling fallback |
| **CREATE** | `app/doctor/page.tsx` | Redirect to `/clinician` |

---

## Task 1: Create Obstetric Assessments GET + POST Route

**The critical fix.** `history-tab.tsx` calls `GET /api/obstetrics/assessments?patientId=X` and `POST /api/obstetrics/assessments` but neither route exists. The Midwife portal is completely broken without this.

**Table schema** (from migration `0010_obstetric_dental_enhancements.sql`):
```sql
obstetric_assessments (
  id UUID PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id),
  recorded_by UUID NOT NULL REFERENCES users(id),
  visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  gravida INTEGER, parity INTEGER,
  gestational_age_weeks INTEGER, edd DATE,
  fundal_height_cm NUMERIC(4,1), fetal_heart_rate INTEGER,
  presentation VARCHAR(50), notes TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP
)
```

**Auth pattern** (matches all other routes in this codebase):
```typescript
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
// inside handler:
const cookieStore = await cookies()
const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
const auth = token ? verifyToken(token) : null
```

**Files:**
- Create: `app/api/obstetrics/assessments/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/obstetrics/assessments/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT id, patient_id, visit_date, gravida, parity,
              gestational_age_weeks, edd, fundal_height_cm,
              fetal_heart_rate, presentation, notes, created_at
       FROM obstetric_assessments
       WHERE patient_id = $1
       ORDER BY visit_date DESC`,
      [patientId],
    )

    return NextResponse.json({ assessments: rows })
  } catch (err) {
    console.error("GET /api/obstetrics/assessments error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      visitDate?: string
      gravida?: number
      parity?: number
      gestationalAgeWeeks?: number
      edd?: string
      fundalHeightCm?: number
      fetalHeartRate?: number
      presentation?: string
      notes?: string
    }

    const patientId = (body.patientId || "").trim()
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 })

    const visitDate = body.visitDate || new Date().toISOString()

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO obstetric_assessments
         (patient_id, recorded_by, visit_date, gravida, parity,
          gestational_age_weeks, edd, fundal_height_cm,
          fetal_heart_rate, presentation, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, patient_id, visit_date, gravida, parity,
                 gestational_age_weeks, edd, fundal_height_cm,
                 fetal_heart_rate, presentation, notes, created_at`,
      [
        patientId,
        auth.userId,
        visitDate,
        body.gravida ?? null,
        body.parity ?? null,
        body.gestationalAgeWeeks ?? null,
        body.edd ?? null,
        body.fundalHeightCm ?? null,
        body.fetalHeartRate ?? null,
        body.presentation ?? null,
        body.notes ?? null,
      ],
    )

    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/obstetrics/assessments error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the directory structure exists**

Run:
```bash
ls c:/Users/ssego/Documents/dayspring-his/dayspring-his/app/api/
```
Expected: `obstetrics/` directory should now be visible after creating the file. If the parent `app/api/obstetrics/assessments/` directory didn't exist, Next.js App Router creates it when you create the file — just ensure the file is at the correct path.

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git add app/api/obstetrics/assessments/route.ts
git commit -m "feat(api): add obstetric assessments GET + POST route"
```

---

## Task 2: Create Obstetric Assessments PATCH Route

The `history-tab.tsx` edit dialog calls `PATCH /api/obstetrics/assessments/${id}` — a dynamic segment route.

**Files:**
- Create: `app/api/obstetrics/assessments/[id]/route.ts`

- [ ] **Step 1: Create the dynamic route file**

```typescript
// app/api/obstetrics/assessments/[id]/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    // Ownership check — only the recorder or Hospital Admin can edit
    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT recorded_by FROM obstetric_assessments WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    if (
      existing.rows[0].recorded_by !== auth.userId &&
      auth.role !== "Hospital Admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      visitDate?: string
      gravida?: number
      parity?: number
      gestationalAgeWeeks?: number
      edd?: string
      fundalHeightCm?: number
      fetalHeartRate?: number
      presentation?: string | null
      notes?: string | null
    }

    // Build SET clause from explicitly defined fields only
    const fieldMap: Array<[string, unknown]> = [
      ["visit_date", body.visitDate],
      ["gravida", body.gravida],
      ["parity", body.parity],
      ["gestational_age_weeks", body.gestationalAgeWeeks],
      ["edd", body.edd],
      ["fundal_height_cm", body.fundalHeightCm],
      ["fetal_heart_rate", body.fetalHeartRate],
      ["presentation", body.presentation],
      ["notes", body.notes],
    ].filter(([, v]) => v !== undefined) as Array<[string, unknown]>

    if (fieldMap.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const setClauses = fieldMap.map(([col], i) => `${col} = $${i + 2}`).join(", ")
    const values: unknown[] = [id, ...fieldMap.map(([, v]) => v ?? null)]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE obstetric_assessments
       SET ${setClauses}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, patient_id, visit_date, gravida, parity,
                 gestational_age_weeks, edd, fundal_height_cm,
                 fetal_heart_rate, presentation, notes, created_at`,
      values,
    )

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("PATCH /api/obstetrics/assessments/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the route resolves correctly**

The history-tab.tsx calls:
```typescript
fetch(`/api/obstetrics/assessments/${editingId}`, { method: "PATCH", ... })
```
Confirm your file is at `app/api/obstetrics/assessments/[id]/route.ts` (square brackets around `id` = Next.js dynamic segment).

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git add app/api/obstetrics/assessments/[id]/route.ts
git commit -m "feat(api): add obstetric assessments PATCH route"
```

---

## Task 3: Fix TypeScript `any` Types in Order Lab Test

`order-lab-test.tsx` has 3 `any` types at lines 16, 17, and 50. This breaks TypeScript strict checking and masks potential runtime errors.

**Files:**
- Modify: `components/doctor/order-lab-test.tsx`

**Current broken code (lines 13–53):**
```typescript
export function OrderLabTest({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o:boolean)=>void }) {
  const { orderTest } = useLab()
  const [search, setSearch] = useState("")
  const [catalog, setCatalog] = useState<any[]>([])         // ← any
  const [selected, setSelected] = useState<any[]>([])       // ← any
  // ...
  const addTest = (item:any) => {                            // ← any
    if (selected.find((s)=> s.loincCode === item.loincCode)) return
    setSelected((prev)=> [...prev, item])
  }
```

- [ ] **Step 1: Add the `LabCatalogItem` interface and replace all three `any` instances**

Open `components/doctor/order-lab-test.tsx`. After the existing imports (line 12), add the interface and update the three usages:

```typescript
// Add this interface after the imports block (after line 12)
interface LabCatalogItem {
  loincCode: string | null
  name: string
  component?: string
  property?: string
  system?: string
  class?: string
}
```

Then replace the three `any` occurrences:

Change line 16:
```typescript
// Before
const [catalog, setCatalog] = useState<any[]>([])
// After
const [catalog, setCatalog] = useState<LabCatalogItem[]>([])
```

Change line 17:
```typescript
// Before
const [selected, setSelected] = useState<any[]>([])
// After
const [selected, setSelected] = useState<LabCatalogItem[]>([])
```

Change line 50:
```typescript
// Before
const addTest = (item:any) => {
// After
const addTest = (item: LabCatalogItem) => {
```

Also update `addManual` at line 55–60 to return a properly typed object:
```typescript
// Before
setSelected((prev)=> [...prev, { loincCode: null, name, class: "Lab" }])
// After
setSelected((prev): LabCatalogItem[] => [...prev, { loincCode: null, name, class: "Lab" }])
```

- [ ] **Step 2: Verify TypeScript compiles with no errors in this file**

Run:
```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "order-lab-test"
```
Expected: no output (no errors in that file).

- [ ] **Step 3: Commit**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git add components/doctor/order-lab-test.tsx
git commit -m "fix(doctor): replace any types in order-lab-test with LabCatalogItem interface"
```

---

## Task 4: Upgrade Notification Bell to SSE-First

`clinician-notification-bell.tsx` currently polls every 60 seconds. It should open the SSE stream at `/api/notifications/stream` first and fall back to polling if SSE fails.

**Current state** (lines 41–57 of `clinician-notification-bell.tsx`):
```typescript
const fetchNotifications = useCallback(async () => {
  // ...REST fetch to /api/notifications
}, [])

useEffect(() => {
  void fetchNotifications()
  intervalRef.current = setInterval(() => void fetchNotifications(), 60000)
  return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
}, [fetchNotifications])
```

**Files:**
- Modify: `components/doctor/clinician-notification-bell.tsx`

- [ ] **Step 1: Replace the `useEffect` and `intervalRef` block with SSE-first logic**

The file currently imports `useCallback, useEffect, useRef, useState` from React (line 2). No new imports needed.

Replace lines 39–57 (the `intervalRef` declaration + the `useEffect`) with:

```typescript
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
const sseRef = useRef<EventSource | null>(null)

useEffect(() => {
  // Initial load regardless of SSE status
  void fetchNotifications()

  // Attempt SSE stream first
  const es = new EventSource("/api/notifications/stream", { withCredentials: true })
  sseRef.current = es

  es.onmessage = () => {
    // A push arrived — re-fetch the full list to get latest state
    void fetchNotifications()
  }

  es.onerror = () => {
    // SSE failed — close it and fall back to polling
    es.close()
    sseRef.current = null
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => void fetchNotifications(), 60_000)
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
```

- [ ] **Step 2: Verify `fetchNotifications` is declared with `useCallback` (it already is at line 41)**

Confirm the function starts with:
```typescript
const fetchNotifications = useCallback(async () => {
```
It must be declared **before** the `useEffect` block in the file. If it is (it is — line 41 comes before the effect), no change needed here.

- [ ] **Step 3: Also add a teal-color bell icon when unread count > 0**

Find the `<Bell className="h-5 w-5" />` line (inside the `PopoverTrigger` Button, around line 90) and update the Button's className:

```typescript
// Before
<Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-teal-100 hover:bg-teal-800/60">
  <Bell className="h-5 w-5" />

// After
<Button
  variant="ghost"
  size="icon"
  aria-label="Notifications"
  className={cn(
    "relative hover:bg-teal-800/60",
    unreadCount > 0 ? "text-white" : "text-teal-100",
  )}
>
  <Bell className="h-5 w-5" />
```

- [ ] **Step 4: Add unread dot accent to notification cards**

Find the notification `<button>` element in the map (around line 110–126). Add a left-border accent for unread:

```typescript
// Before
<button
  key={n.id}
  onClick={() => handleNotifClick(n)}
  className={cn(
    "w-full px-4 py-3 text-left transition-colors hover:bg-teal-50/60",
    !n.read_at && "bg-teal-50",
  )}
>

// After
<button
  key={n.id}
  onClick={() => handleNotifClick(n)}
  className={cn(
    "w-full px-4 py-3 text-left transition-colors hover:bg-teal-50/60 border-l-4",
    !n.read_at
      ? "border-l-teal-500 bg-teal-50"
      : "border-l-transparent bg-white",
  )}
>
```

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git add components/doctor/clinician-notification-bell.tsx
git commit -m "feat(doctor): upgrade notification bell to SSE-first with polling fallback"
```

---

## Task 5: Create `/doctor` Redirect Page

`app/doctor/page.tsx` does not exist. Any link or direct navigation to `/doctor` will 404.

**Files:**
- Create: `app/doctor/page.tsx`

- [ ] **Step 1: Check what already exists in `app/doctor/`**

```bash
ls c:/Users/ssego/Documents/dayspring-his/dayspring-his/app/doctor/
```
Expected output: `settings/` directory only. No `page.tsx` at the root.

- [ ] **Step 2: Create the redirect page**

```typescript
// app/doctor/page.tsx
import { redirect } from "next/navigation"

export default function DoctorPage() {
  redirect("/clinician")
}
```

- [ ] **Step 3: Verify `/doctor/settings` redirect exists**

```bash
cat "c:/Users/ssego/Documents/dayspring-his/dayspring-his/app/doctor/settings/page.tsx"
```
Expected: it should contain `redirect("/clinician/settings")`. If it does not, replace its contents with:

```typescript
// app/doctor/settings/page.tsx
import { redirect } from "next/navigation"

export default function DoctorSettingsPage() {
  redirect("/clinician/settings")
}
```

- [ ] **Step 4: Commit**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git add app/doctor/page.tsx app/doctor/settings/page.tsx
git commit -m "fix(routing): add /doctor redirect pages to /clinician"
```

---

## Task 6: Full Build Verification

Run the TypeScript compiler and Next.js build to confirm zero errors across the entire portal.

- [ ] **Step 1: TypeScript strict check**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
npx tsc --noEmit 2>&1 | head -50
```
Expected: no output, or only warnings unrelated to the doctor portal. Any error mentioning `obstetrics`, `order-lab-test`, `notification-bell`, or `doctor/page` must be fixed before proceeding.

- [ ] **Step 2: Next.js production build**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
pnpm build 2>&1 | tail -30
```
Expected: `✓ Compiled successfully` with route table showing:
```
○ /clinician
○ /clinician/settings
○ /clinician/schedules
○ /doctor           ← new redirect
/api/obstetrics/assessments     ← new
/api/obstetrics/assessments/[id] ← new
```

- [ ] **Step 3: Smoke-test the obstetric API endpoint**

If the dev server is running (`pnpm dev`), open a browser console while logged in as a Clinician or Midwife and run:
```javascript
fetch("/api/obstetrics/assessments?patientId=<any-valid-patient-id>", {
  credentials: "include"
}).then(r => r.json()).then(console.log)
```
Expected: `{ assessments: [] }` (empty array, not a 404 or 500).

- [ ] **Step 4: Commit build gate**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his
git commit --allow-empty -m "chore: verify build passes post-doctor-portal-audit-fix"
```

---

## Self-Review Checklist

- [x] **Obstetric GET** — returns `{ assessments: [...] }` matching history-tab.tsx line 95
- [x] **Obstetric POST** — accepts same camelCase payload history-tab.tsx sends at line 125-141
- [x] **Obstetric PATCH** — dynamic route `[id]` matches `fetch(\`/api/obstetrics/assessments/${editingId}\`, { method: "PATCH" })` at history-tab.tsx line 190
- [x] **DB column names** — `gestational_age_weeks`, `fundal_height_cm`, `fetal_heart_rate` match the migration schema exactly
- [x] **Response field names** — `visit_date`, `gestational_age_weeks`, `fundal_height_cm`, `fetal_heart_rate` match what `ObstetricRecord` interface in history-tab.tsx expects
- [x] **Auth pattern** — `cookies().get("session")` matches all other routes in the codebase
- [x] **`can()` permission** — `can(role, "medical", "read/create/update")` — same resource used by `medical/records/route.ts`
- [x] **LabCatalogItem** — `loincCode` field name matches `item.loincCode` usage in `addTest`, `removeTest`, and catalog map at lines 51, 63, 104, 158
- [x] **SSE fallback** — `fetchNotifications` is defined with `useCallback` before the `useEffect`, so it's stable across renders
- [x] **No placeholders** — all code blocks are complete and copy-pasteable
- [x] **Billing gate** — already implemented in prescriptions route (lines 332+); no changes needed
- [x] **Export panel** — already in `clinician/page.tsx`; no changes needed
