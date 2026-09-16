# Midwife Portal — Full Clinical Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken Midwife Portal skeleton with a full-featured, shell-based clinical portal covering ANC, labor & delivery, and postnatal care — with complete CRUD, notification bell, exports, and a proper visual identity.

**Architecture:** `MidwifeShell` orchestrates six tabs (Overview, Patients, ANC Visits, Labor & Delivery, Clinical, Exports). Two new DB tables (`labor_delivery_records`, `postnatal_visits`) are added via migration. All existing obstetric API bugs are fixed. The portal mirrors the `DentistShell` pattern in architecture but uses a distinct rose/pink palette.

**Tech Stack:** Next.js 14 App Router, TypeScript, PostgreSQL (RLS via `queryWithSession`), Tailwind CSS, ShadCN UI, Sonner toasts, Lucide React icons, SSE for notifications.

---

## File Map

### New files
```
migrations/0031_labor_delivery_postnatal.sql
app/api/labor/route.ts
app/api/labor/[id]/route.ts
app/api/postnatal/route.ts
app/api/postnatal/[id]/route.ts
components/midwife/midwife-shell.tsx
components/midwife/midwife-notification-bell.tsx
components/midwife/midwife-overview.tsx
components/midwife/midwife-patient-records.tsx
components/midwife/midwife-anc-visits.tsx
components/midwife/midwife-labor-delivery.tsx
components/midwife/midwife-clinical-actions.tsx
components/midwife/midwife-exports.tsx
```

### Modified files
```
app/api/obstetrics/assessments/[id]/route.ts   — add DELETE handler
app/api/obstetrics/visits/route.ts             — add patientId filter
app/api/obstetrics/summary/route.ts            — extend with richer metrics
app/midwife/page.tsx                           — render MidwifeShell
app/midwife/anc/page.tsx                       — replace with redirect
app/midwife/settings/page.tsx                  — add MidwifePreferences card
components/dashboards/midwife-dashboard.tsx    — remove DoctorDashboard embed
```

---

## Task 1: Database Migration — Labor & Delivery + Postnatal Tables

**Files:**
- Create: `migrations/0031_labor_delivery_postnatal.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/0031_labor_delivery_postnatal.sql
-- Add labor_delivery_records and postnatal_visits tables for the Midwife Portal.

BEGIN;

-- ── Labor & Delivery ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_delivery_records (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id               UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  midwife_id               UUID NOT NULL REFERENCES users(id),
  admission_date           TIMESTAMP NOT NULL,
  onset_of_labor           VARCHAR(20) CHECK (onset_of_labor IN ('spontaneous','induced','augmented')),
  delivery_date            TIMESTAMP,
  delivery_type            VARCHAR(20) CHECK (delivery_type IN ('SVD','C-Section','Forceps','Vacuum','Other')),
  duration_of_labor_hours  NUMERIC(5,2),
  presentation             VARCHAR(30),
  rupture_of_membranes     TIMESTAMP,
  placenta_delivery        TIMESTAMP,
  blood_loss_ml            INTEGER,
  complications            TEXT,
  notes                    TEXT,
  -- Baby sub-record
  baby_sex                 VARCHAR(15) CHECK (baby_sex IN ('Male','Female','Indeterminate')),
  baby_birth_weight_g      INTEGER,
  baby_apgar_1min          SMALLINT CHECK (baby_apgar_1min BETWEEN 0 AND 10),
  baby_apgar_5min          SMALLINT CHECK (baby_apgar_5min BETWEEN 0 AND 10),
  baby_condition           VARCHAR(20) CHECK (baby_condition IN ('Alive','Stillbirth','Neonatal Death')),
  baby_notes               TEXT,
  created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labor_delivery_patient
  ON labor_delivery_records(patient_id, admission_date DESC);

-- ── Postnatal Visits ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postnatal_visits (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  labor_delivery_id    UUID REFERENCES labor_delivery_records(id) ON DELETE SET NULL,
  midwife_id           UUID NOT NULL REFERENCES users(id),
  visit_date           TIMESTAMP NOT NULL,
  days_postpartum      INTEGER,
  bp_systolic          INTEGER,
  bp_diastolic         INTEGER,
  temperature_c        NUMERIC(4,1),
  lochia               VARCHAR(10) CHECK (lochia IN ('rubra','serosa','alba','abnormal')),
  wound_healing        TEXT,
  breastfeeding_status VARCHAR(30),
  baby_weight_g        INTEGER,
  baby_condition       TEXT,
  notes                TEXT,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_postnatal_patient
  ON postnatal_visits(patient_id, visit_date DESC);

CREATE INDEX IF NOT EXISTS idx_postnatal_labor
  ON postnatal_visits(labor_delivery_id);

-- ── RLS: labor_delivery_records ─────────────────────────────────────────────
ALTER TABLE labor_delivery_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS labor_select ON labor_delivery_records;
CREATE POLICY labor_select ON labor_delivery_records FOR SELECT
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife','Nurse'
  ));

DROP POLICY IF EXISTS labor_insert ON labor_delivery_records;
CREATE POLICY labor_insert ON labor_delivery_records FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS labor_update ON labor_delivery_records;
CREATE POLICY labor_update ON labor_delivery_records FOR UPDATE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ))
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS labor_delete ON labor_delivery_records;
CREATE POLICY labor_delete ON labor_delivery_records FOR DELETE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Midwife'
  ));

-- ── RLS: postnatal_visits ───────────────────────────────────────────────────
ALTER TABLE postnatal_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS postnatal_select ON postnatal_visits;
CREATE POLICY postnatal_select ON postnatal_visits FOR SELECT
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife','Nurse'
  ));

DROP POLICY IF EXISTS postnatal_insert ON postnatal_visits;
CREATE POLICY postnatal_insert ON postnatal_visits FOR INSERT
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS postnatal_update ON postnatal_visits;
CREATE POLICY postnatal_update ON postnatal_visits FOR UPDATE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ))
  WITH CHECK (current_setting('app.role', true) IN (
    'Hospital Admin','Doctor','Midwife'
  ));

DROP POLICY IF EXISTS postnatal_delete ON postnatal_visits;
CREATE POLICY postnatal_delete ON postnatal_visits FOR DELETE
  USING (current_setting('app.role', true) IN (
    'Hospital Admin','Midwife'
  ));

COMMIT;
```

- [ ] **Step 2: Run the migration**

Navigate to the app and run:
```
http://localhost:3000/run-migrations
```
Or via the migrate API. Verify in the DB that both tables exist with correct columns.

- [ ] **Step 3: Commit**

```bash
git add migrations/0031_labor_delivery_postnatal.sql
git commit -m "feat(db): add labor_delivery_records and postnatal_visits tables with RLS"
```

---

## Task 2: Fix — Add DELETE to `/api/obstetrics/assessments/[id]`

**Files:**
- Modify: `app/api/obstetrics/assessments/[id]/route.ts`

- [ ] **Step 1: Read the current file** (already read — has only PATCH)

- [ ] **Step 2: Add the DELETE handler** — append after the closing brace of `PATCH`:

```typescript
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    // Ownership check — only recorder or Hospital Admin may delete
    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT recorded_by FROM obstetric_assessments WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }
    if (existing.rows[0].recorded_by !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM obstetric_assessments WHERE id = $1`,
      [id],
    )

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/obstetrics/assessments/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify the security module has a `delete` permission**

```bash
grep -n "delete" c:/Users/ssego/Documents/dayspring-his/dayspring-his/lib/security.ts
```

If `can(role, "medical", "delete")` is not defined, add it — or use `can(auth.role, "medical", "update")` as a fallback (Midwife can update → can delete own records). Use whichever form the `can` function supports.

- [ ] **Step 4: Commit**

```bash
git add app/api/obstetrics/assessments/[id]/route.ts
git commit -m "fix(api): add DELETE handler to obstetrics/assessments/[id]"
```

---

## Task 3: Fix — Add `patientId` Filter to `/api/obstetrics/visits`

**Files:**
- Modify: `app/api/obstetrics/visits/route.ts`

- [ ] **Step 1: Replace the entire GET handler** with this version that supports `patientId`:

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const fromParam = url.searchParams.get("from")?.trim() || null
  const toParam = url.searchParams.get("to")?.trim() || null
  const patientId = url.searchParams.get("patientId")?.trim() || null

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (patientId && !UUID_RE.test(patientId)) {
    return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
  }

  const session = { role: auth.role, userId: auth.userId }

  const baseSelect = `
    SELECT
      oa.id,
      oa.patient_id,
      oa.visit_date,
      oa.gravida,
      oa.parity,
      oa.gestational_age_weeks,
      oa.edd,
      oa.fundal_height_cm,
      oa.fetal_heart_rate,
      oa.presentation,
      oa.notes,
      p.patient_number,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      u.name AS recorded_by
    FROM obstetric_assessments oa
    JOIN patients p ON p.id = oa.patient_id
    LEFT JOIN users u ON u.id = oa.recorded_by`

  // Build WHERE clauses dynamically
  const conditions: string[] = []
  const values: unknown[] = []

  if (fromParam && toParam) {
    values.push(new Date(fromParam).toISOString())
    values.push(new Date(toParam).toISOString())
    conditions.push(`oa.visit_date >= $${values.length - 1}::timestamp AND oa.visit_date <= $${values.length}::timestamp`)
  }
  if (patientId) {
    values.push(patientId)
    conditions.push(`oa.patient_id = $${values.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  const { rows } = await queryWithSession(
    session,
    `${baseSelect} ${where} ORDER BY oa.visit_date DESC LIMIT 500`,
    values,
  )
  return NextResponse.json({ visits: rows })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/obstetrics/visits/route.ts
git commit -m "fix(api): add patientId filter to obstetrics/visits"
```

---

## Task 4: Extend `/api/obstetrics/summary` with Richer Metrics

**Files:**
- Modify: `app/api/obstetrics/summary/route.ts`

- [ ] **Step 1: Replace the entire GET handler** to add `activePregnancies` and `upcomingDeliveries`:

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  const auth = token ? verifyToken(token) : null
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const fromParam = url.searchParams.get("from")?.trim() || null
  const toParam = url.searchParams.get("to")?.trim() || null

  const session = { role: auth.role, userId: auth.userId }

  // Active pregnancies: patients with a recorded EDD in the next 40 weeks
  const { rows: activeRows } = await queryWithSession(
    session,
    `SELECT COUNT(DISTINCT patient_id) AS active_pregnancies
     FROM obstetric_assessments
     WHERE edd IS NOT NULL
       AND edd >= CURRENT_DATE
       AND edd <= CURRENT_DATE + INTERVAL '40 weeks'`,
  )
  const activePregnancies = parseInt(String(activeRows[0]?.active_pregnancies ?? 0), 10)

  // Upcoming deliveries: EDDs within the next 4 weeks
  const { rows: upcomingRows } = await queryWithSession(
    session,
    `SELECT COUNT(DISTINCT patient_id) AS upcoming_deliveries
     FROM obstetric_assessments
     WHERE edd IS NOT NULL
       AND edd >= CURRENT_DATE
       AND edd <= CURRENT_DATE + INTERVAL '4 weeks'`,
  )
  const upcomingDeliveries = parseInt(String(upcomingRows[0]?.upcoming_deliveries ?? 0), 10)

  if (fromParam && toParam) {
    const from = new Date(fromParam)
    const to = new Date(toParam)
    const { rows: countRows } = await queryWithSession(
      session,
      `SELECT COUNT(*) AS assessments_count, COUNT(DISTINCT patient_id) AS patients_count
       FROM obstetric_assessments
       WHERE visit_date >= $1::timestamp AND visit_date <= $2::timestamp`,
      [from.toISOString(), to.toISOString()],
    )
    const assessmentsCount = parseInt(String(countRows[0]?.assessments_count ?? 0), 10)
    const patientsCount = parseInt(String(countRows[0]?.patients_count ?? 0), 10)
    return NextResponse.json({
      assessmentsCount,
      patientsCount,
      activePregnancies,
      upcomingDeliveries,
      from: fromParam,
      to: toParam,
    })
  }

  const { rows: countRows } = await queryWithSession(
    session,
    `SELECT COUNT(*) AS total_assessments, COUNT(DISTINCT patient_id) AS total_patients
     FROM obstetric_assessments`,
  )
  const assessmentsCount = parseInt(String(countRows[0]?.total_assessments ?? 0), 10)
  const patientsCount = parseInt(String(countRows[0]?.total_patients ?? 0), 10)
  return NextResponse.json({ assessmentsCount, patientsCount, activePregnancies, upcomingDeliveries })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/obstetrics/summary/route.ts
git commit -m "feat(api): extend obstetrics/summary with activePregnancies and upcomingDeliveries"
```

---

## Task 5: New API — `/api/labor` (GET + POST)

**Files:**
- Create: `app/api/labor/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/labor/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

const LABOR_SELECT = `
  SELECT
    lr.id,
    lr.patient_id,
    lr.midwife_id,
    lr.admission_date,
    lr.onset_of_labor,
    lr.delivery_date,
    lr.delivery_type,
    lr.duration_of_labor_hours,
    lr.presentation,
    lr.rupture_of_membranes,
    lr.placenta_delivery,
    lr.blood_loss_ml,
    lr.complications,
    lr.notes,
    lr.baby_sex,
    lr.baby_birth_weight_g,
    lr.baby_apgar_1min,
    lr.baby_apgar_5min,
    lr.baby_condition,
    lr.baby_notes,
    lr.created_at,
    lr.updated_at,
    CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
    p.patient_number,
    u.name AS midwife_name
  FROM labor_delivery_records lr
  JOIN patients p ON p.id = lr.patient_id
  LEFT JOIN users u ON u.id = lr.midwife_id`

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")?.trim() || null
    const fromParam = url.searchParams.get("from")?.trim() || null
    const toParam = url.searchParams.get("to")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []

    if (patientId) {
      values.push(patientId)
      conditions.push(`lr.patient_id = $${values.length}`)
    }
    if (fromParam && toParam) {
      values.push(new Date(fromParam).toISOString())
      values.push(new Date(toParam).toISOString())
      conditions.push(`lr.admission_date >= $${values.length - 1}::timestamp AND lr.admission_date <= $${values.length}::timestamp`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `${LABOR_SELECT} ${where} ORDER BY lr.admission_date DESC LIMIT 200`,
      values,
    )

    return NextResponse.json({ records: rows })
  } catch (err) {
    console.error("GET /api/labor error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      admissionDate?: string
      onsetOfLabor?: string
      deliveryDate?: string
      deliveryType?: string
      durationOfLaborHours?: unknown
      presentation?: string
      ruptureOfMembranes?: string
      placentaDelivery?: string
      bloodLossMl?: unknown
      complications?: string
      notes?: string
      babySex?: string
      babyBirthWeightG?: unknown
      babyApgar1min?: unknown
      babyApgar5min?: unknown
      babyCondition?: string
      babyNotes?: string
    }

    const patientId = (body.patientId ?? "").trim()
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    const admissionDate = body.admissionDate || new Date().toISOString()
    if (Number.isNaN(new Date(admissionDate).getTime())) {
      return NextResponse.json({ error: "admissionDate is not a valid date" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO labor_delivery_records
         (patient_id, midwife_id, admission_date, onset_of_labor, delivery_date,
          delivery_type, duration_of_labor_hours, presentation, rupture_of_membranes,
          placenta_delivery, blood_loss_ml, complications, notes,
          baby_sex, baby_birth_weight_g, baby_apgar_1min, baby_apgar_5min,
          baby_condition, baby_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        patientId,
        auth.userId,
        admissionDate,
        body.onsetOfLabor ?? null,
        body.deliveryDate ?? null,
        body.deliveryType ?? null,
        toFloat(body.durationOfLaborHours),
        body.presentation ?? null,
        body.ruptureOfMembranes ?? null,
        body.placentaDelivery ?? null,
        toInt(body.bloodLossMl),
        body.complications ?? null,
        body.notes ?? null,
        body.babySex ?? null,
        toInt(body.babyBirthWeightG),
        toInt(body.babyApgar1min),
        toInt(body.babyApgar5min),
        body.babyCondition ?? null,
        body.babyNotes ?? null,
      ],
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/labor error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/labor/route.ts
git commit -m "feat(api): add GET/POST /api/labor for labor delivery records"
```

---

## Task 6: New API — `/api/labor/[id]` (PATCH + DELETE)

**Files:**
- Create: `app/api/labor/[id]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/labor/[id]/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Record not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

    const fieldMap: Array<[string, unknown]> = ([
      ["admission_date", body.admissionDate],
      ["onset_of_labor", body.onsetOfLabor],
      ["delivery_date", body.deliveryDate],
      ["delivery_type", body.deliveryType],
      ["duration_of_labor_hours", body.durationOfLaborHours !== undefined ? toFloat(body.durationOfLaborHours) : undefined],
      ["presentation", body.presentation],
      ["rupture_of_membranes", body.ruptureOfMembranes],
      ["placenta_delivery", body.placentaDelivery],
      ["blood_loss_ml", body.bloodLossMl !== undefined ? toInt(body.bloodLossMl) : undefined],
      ["complications", body.complications],
      ["notes", body.notes],
      ["baby_sex", body.babySex],
      ["baby_birth_weight_g", body.babyBirthWeightG !== undefined ? toInt(body.babyBirthWeightG) : undefined],
      ["baby_apgar_1min", body.babyApgar1min !== undefined ? toInt(body.babyApgar1min) : undefined],
      ["baby_apgar_5min", body.babyApgar5min !== undefined ? toInt(body.babyApgar5min) : undefined],
      ["baby_condition", body.babyCondition],
      ["baby_notes", body.babyNotes],
    ] as Array<[string, unknown]>).filter(([, v]) => v !== undefined)

    if (fieldMap.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const setClauses = fieldMap.map(([col], i) => `${col} = $${i + 2}`).join(", ")
    const values: unknown[] = [id, ...fieldMap.map(([, v]) => v)]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE labor_delivery_records SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values,
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("PATCH /api/labor/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Record not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM labor_delivery_records WHERE id = $1`,
      [id],
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/labor/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/labor/[id]/route.ts
git commit -m "feat(api): add PATCH/DELETE /api/labor/[id]"
```

---

## Task 7: New API — `/api/postnatal` (GET + POST) and `/api/postnatal/[id]` (PATCH + DELETE)

**Files:**
- Create: `app/api/postnatal/route.ts`
- Create: `app/api/postnatal/[id]/route.ts`

- [ ] **Step 1: Create `app/api/postnatal/route.ts`**

```typescript
// app/api/postnatal/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get("patientId")?.trim() || null
    const laborId = url.searchParams.get("laborId")?.trim() || null

    if (patientId && !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    if (laborId && !UUID_RE.test(laborId)) {
      return NextResponse.json({ error: "laborId must be a valid UUID" }, { status: 400 })
    }

    const conditions: string[] = []
    const values: unknown[] = []
    if (patientId) { values.push(patientId); conditions.push(`pv.patient_id = $${values.length}`) }
    if (laborId) { values.push(laborId); conditions.push(`pv.labor_delivery_id = $${values.length}`) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT
         pv.*,
         CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
         p.patient_number,
         u.name AS midwife_name
       FROM postnatal_visits pv
       JOIN patients p ON p.id = pv.patient_id
       LEFT JOIN users u ON u.id = pv.midwife_id
       ${where}
       ORDER BY pv.visit_date DESC LIMIT 200`,
      values,
    )
    return NextResponse.json({ visits: rows })
  } catch (err) {
    console.error("GET /api/postnatal error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      patientId?: string
      laborDeliveryId?: string
      visitDate?: string
      daysPostpartum?: unknown
      bpSystolic?: unknown
      bpDiastolic?: unknown
      temperatureC?: unknown
      lochia?: string
      woundHealing?: string
      breastfeedingStatus?: string
      babyWeightG?: unknown
      babyCondition?: string
      notes?: string
    }

    const patientId = (body.patientId ?? "").trim()
    if (!patientId || !UUID_RE.test(patientId)) {
      return NextResponse.json({ error: "patientId must be a valid UUID" }, { status: 400 })
    }
    const visitDate = body.visitDate || new Date().toISOString()
    if (Number.isNaN(new Date(visitDate).getTime())) {
      return NextResponse.json({ error: "visitDate is not a valid date" }, { status: 400 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO postnatal_visits
         (patient_id, labor_delivery_id, midwife_id, visit_date, days_postpartum,
          bp_systolic, bp_diastolic, temperature_c, lochia, wound_healing,
          breastfeeding_status, baby_weight_g, baby_condition, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        patientId,
        body.laborDeliveryId && UUID_RE.test(body.laborDeliveryId) ? body.laborDeliveryId : null,
        auth.userId,
        visitDate,
        toInt(body.daysPostpartum),
        toInt(body.bpSystolic),
        toInt(body.bpDiastolic),
        toFloat(body.temperatureC),
        body.lochia ?? null,
        body.woundHealing ?? null,
        body.breastfeedingStatus ?? null,
        toInt(body.babyWeightG),
        body.babyCondition ?? null,
        body.notes ?? null,
      ],
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    console.error("POST /api/postnatal error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/postnatal/[id]/route.ts`**

```typescript
// app/api/postnatal/[id]/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { queryWithSession } from "@/lib/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const m = String(val).match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const m = String(val).replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM postnatal_visits WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Visit not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const fieldMap: Array<[string, unknown]> = ([
      ["visit_date", body.visitDate],
      ["days_postpartum", body.daysPostpartum !== undefined ? toInt(body.daysPostpartum) : undefined],
      ["bp_systolic", body.bpSystolic !== undefined ? toInt(body.bpSystolic) : undefined],
      ["bp_diastolic", body.bpDiastolic !== undefined ? toInt(body.bpDiastolic) : undefined],
      ["temperature_c", body.temperatureC !== undefined ? toFloat(body.temperatureC) : undefined],
      ["lochia", body.lochia],
      ["wound_healing", body.woundHealing],
      ["breastfeeding_status", body.breastfeedingStatus],
      ["baby_weight_g", body.babyWeightG !== undefined ? toInt(body.babyWeightG) : undefined],
      ["baby_condition", body.babyCondition],
      ["notes", body.notes],
    ] as Array<[string, unknown]>).filter(([, v]) => v !== undefined)

    if (fieldMap.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

    const setClauses = fieldMap.map(([col], i) => `${col} = $${i + 2}`).join(", ")
    const values: unknown[] = [id, ...fieldMap.map(([, v]) => v)]

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE postnatal_visits SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values,
    )
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error("PATCH /api/postnatal/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!can(auth.role, "medical", "update")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { id } = await params
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const existing = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT midwife_id FROM postnatal_visits WHERE id = $1`,
      [id],
    )
    if (!existing.rows[0]) return NextResponse.json({ error: "Visit not found" }, { status: 404 })
    if (existing.rows[0].midwife_id !== auth.userId && auth.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM postnatal_visits WHERE id = $1`,
      [id],
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("DELETE /api/postnatal/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/postnatal/route.ts app/api/postnatal/[id]/route.ts
git commit -m "feat(api): add full CRUD /api/postnatal routes"
```

---

## Task 8: Component — `MidwifeNotificationBell`

**Files:**
- Create: `components/midwife/midwife-notification-bell.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MidwifeNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

const MIDWIFE_KEYWORDS = [
  "anc", "obstetric", "labor", "labour", "delivery", "postnatal",
  "maternity", "midwif", "patient queued", "patient assigned",
  "appointment", "reminder", "lab", "result",
]

function isMidwifeNotif(n: MidwifeNotif): boolean {
  const t = (n.title ?? "").toLowerCase()
  const m = (n.message ?? "").toLowerCase()
  return MIDWIFE_KEYWORDS.some((kw) => t.includes(kw) || m.includes(kw))
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

export function MidwifeNotificationBell() {
  const [notifications, setNotifications] = useState<MidwifeNotif[]>([])
  const [open, setOpen] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: MidwifeNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(list.filter(isMidwifeNotif))
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
      // Fallback to polling every 30s if SSE fails
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => { void fetchNotifications() }, 30_000)
      }
    }
    return () => {
      es.close()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })))
    } catch {
      // silent
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-rose-700 hover:bg-rose-50">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 rounded-2xl border border-rose-100 shadow-xl shadow-rose-100/30" align="end">
        <div className="flex items-center justify-between border-b border-rose-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-700">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-rose-600 hover:text-rose-800 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-rose-50">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "px-4 py-3 text-sm transition-colors",
                  n.read_at ? "opacity-60" : "bg-rose-50/40",
                )}
              >
                <p className="font-medium text-slate-700 leading-tight">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                <p className="text-[11px] text-rose-400 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-notification-bell.tsx
git commit -m "feat(midwife): add MidwifeNotificationBell with SSE and keyword filtering"
```

---

## Task 9: Component — `MidwifeOverview`

**Files:**
- Create: `components/midwife/midwife-overview.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useEffect, useState } from "react"
import {
  ClipboardList, Users, Baby, CalendarClock,
  FlaskConical, HeartPulse, Plus, Stethoscope
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ObsSummary {
  assessmentsCount: number
  patientsCount: number
  activePregnancies: number
  upcomingDeliveries: number
}

interface RecentVisit {
  id: string
  patient_name: string
  patient_number: string | null
  visit_date: string
  gestational_age_weeks: number | null
  edd: string | null
}

interface StatCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  loading: boolean
  accent?: string
}

function StatCard({ title, value, icon, loading, accent = "rose" }: StatCardProps) {
  return (
    <Card className={`rounded-2xl border border-${accent}-100 bg-gradient-to-br from-${accent}-50 via-white to-pink-50/30 shadow-sm shadow-${accent}-100/40`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
        <div className={`rounded-xl bg-${accent}-50 p-2 text-${accent}-600`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums text-slate-800">
          {loading ? "—" : (value ?? 0)}
        </div>
      </CardContent>
    </Card>
  )
}

interface MidwifeOverviewProps {
  onNavigate: (tab: string, section?: string) => void
}

export function MidwifeOverview({ onNavigate }: MidwifeOverviewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [summary, setSummary] = useState<ObsSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([])
  const [loadingVisits, setLoadingVisits] = useState(true)
  const [todayCount, setTodayCount] = useState<number | null>(null)

  useEffect(() => {
    const from = encodeURIComponent(new Date(today + "T00:00:00Z").toISOString())
    const to = encodeURIComponent(new Date(today + "T23:59:59Z").toISOString())
    setLoadingSummary(true)
    Promise.all([
      fetch(`/api/obstetrics/summary`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/obstetrics/summary?from=${from}&to=${to}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([all, todaySummary]) => {
        if (all) setSummary(all)
        if (todaySummary) setTodayCount(todaySummary.assessmentsCount ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false))
  }, [today])

  useEffect(() => {
    setLoadingVisits(true)
    const from = encodeURIComponent(new Date(today + "T00:00:00Z").toISOString())
    const to = encodeURIComponent(new Date(today + "T23:59:59Z").toISOString())
    fetch(`/api/obstetrics/visits?from=${from}&to=${to}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { visits: [] })
      .then((data) => setRecentVisits(Array.isArray(data.visits) ? data.visits.slice(0, 5) : []))
      .catch(() => setRecentVisits([]))
      .finally(() => setLoadingVisits(false))
  }, [today])

  return (
    <div className="space-y-6 p-1">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Today's ANC Visits" value={todayCount} icon={<ClipboardList className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Active Pregnancies" value={summary?.activePregnancies ?? null} icon={<HeartPulse className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Upcoming Deliveries (4 wks)" value={summary?.upcomingDeliveries ?? null} icon={<Baby className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Total ANC Patients" value={summary?.patientsCount ?? null} icon={<Users className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Total Assessments" value={summary?.assessmentsCount ?? null} icon={<ClipboardList className="h-4 w-4" />} loading={loadingSummary} />
        <Card className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-pink-50/30 shadow-sm shadow-rose-100/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              size="sm"
              className="w-full justify-start gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              onClick={() => onNavigate("anc", "new")}
            >
              <Plus className="h-4 w-4" /> New ANC Visit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
              onClick={() => onNavigate("labor", "new")}
            >
              <Baby className="h-4 w-4" /> Record Delivery
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
              onClick={() => onNavigate("clinical", "lab")}
            >
              <FlaskConical className="h-4 w-4" /> Order Lab Test
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent ANC Activity */}
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="border-b border-rose-50 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-rose-600" />
            Today&apos;s ANC Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingVisits ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
          ) : recentVisits.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No ANC visits recorded today.</p>
          ) : (
            <div className="divide-y divide-rose-50">
              {recentVisits.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-rose-50/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{v.patient_name}</p>
                    <p className="text-xs text-slate-400">
                      {v.patient_number ? `#${v.patient_number} · ` : ""}
                      {v.gestational_age_weeks != null ? `${v.gestational_age_weeks} wks GA` : "GA not recorded"}
                      {v.edd ? ` · EDD ${String(v.edd).slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-rose-400">
                    <CalendarClock className="h-3 w-3" />
                    {String(v.visit_date).slice(11, 16)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-overview.tsx
git commit -m "feat(midwife): add MidwifeOverview with stat cards and activity feed"
```

---

## Task 10: Component — `MidwifeANCVisits` (Full CRUD)

**Files:**
- Create: `components/midwife/midwife-anc-visits.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"

interface Visit {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  visit_date: string
  gravida: number | null
  parity: number | null
  gestational_age_weeks: number | null
  edd: string | null
  fundal_height_cm: number | null
  fetal_heart_rate: number | null
  presentation: string | null
  notes: string | null
  recorded_by: string | null
}

interface FormState {
  patientId: string
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

const EMPTY_FORM: FormState = {
  patientId: "", visitDate: new Date().toISOString().slice(0, 10),
  gravida: "", parity: "", gestationalAgeWeeks: "", edd: "",
  fundalHeightCm: "", fetalHeartRate: "", presentation: "", notes: "",
}

interface PatientOption { id: string; patientNumber: string; firstName: string; lastName: string }

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient name or number…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => { onChange(null); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-rose-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-rose-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id} type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange({ id: p.id, patientNumber: (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patientNumber?: string; patient_number?: string }).patient_number || "", firstName: p.firstName || (p as { first_name?: string }).first_name || "", lastName: p.lastName || (p as { last_name?: string }).last_name || "" })
                setOpen(false); setQuery("")
              }}
            >
              <span className="font-medium">{p.firstName || (p as { first_name?: string }).first_name} {p.lastName || (p as { last_name?: string }).last_name}</span>
              <span className="ml-2 text-xs text-slate-400">{(p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patientNumber?: string; patient_number?: string }).patient_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface MidwifeANCVisitsProps {
  openNewOnMount?: boolean
}

export function MidwifeANCVisits({ openNewOnMount = false }: MidwifeANCVisitsProps) {
  const { user } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Visit | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    if (openNewOnMount) { setSheetOpen(true); setEditingVisit(null); setForm(EMPTY_FORM); setSelectedPatient(null) }
  }, [openNewOnMount])

  const loadVisits = useCallback(async () => {
    setLoading(true)
    try {
      const f = encodeURIComponent(new Date(from + "T00:00:00Z").toISOString())
      const t = encodeURIComponent(new Date(to + "T23:59:59Z").toISOString())
      const res = await fetch(`/api/obstetrics/visits?from=${f}&to=${t}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json().catch(() => ({ visits: [] }))
      if (mountedRef.current) setVisits(Array.isArray(data.visits) ? data.visits : [])
    } catch {
      toast.error("Failed to load ANC visits")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void loadVisits() }, [loadVisits])

  function openNew() {
    setEditingVisit(null)
    setForm(EMPTY_FORM)
    setSelectedPatient(null)
    setSheetOpen(true)
  }

  function openEdit(v: Visit) {
    setEditingVisit(v)
    setForm({
      patientId: v.patient_id,
      visitDate: String(v.visit_date).slice(0, 10),
      gravida: v.gravida != null ? String(v.gravida) : "",
      parity: v.parity != null ? String(v.parity) : "",
      gestationalAgeWeeks: v.gestational_age_weeks != null ? String(v.gestational_age_weeks) : "",
      edd: v.edd ? String(v.edd).slice(0, 10) : "",
      fundalHeightCm: v.fundal_height_cm != null ? String(v.fundal_height_cm) : "",
      fetalHeartRate: v.fetal_heart_rate != null ? String(v.fetal_heart_rate) : "",
      presentation: v.presentation ?? "",
      notes: v.notes ?? "",
    })
    setSelectedPatient(null)
    setSheetOpen(true)
  }

  async function saveVisit() {
    const patientId = editingVisit ? editingVisit.patient_id : selectedPatient?.id ?? ""
    if (!patientId) { toast.error("Please select a patient"); return }
    setSaving(true)
    try {
      const payload = {
        patientId,
        visitDate: form.visitDate ? new Date(form.visitDate + "T00:00:00Z").toISOString() : undefined,
        gravida: form.gravida ? parseInt(form.gravida) : null,
        parity: form.parity ? parseInt(form.parity) : null,
        gestationalAgeWeeks: form.gestationalAgeWeeks ? parseInt(form.gestationalAgeWeeks) : null,
        edd: form.edd || null,
        fundalHeightCm: form.fundalHeightCm ? parseFloat(form.fundalHeightCm) : null,
        fetalHeartRate: form.fetalHeartRate ? parseInt(form.fetalHeartRate) : null,
        presentation: form.presentation || null,
        notes: form.notes || null,
      }
      let res: Response
      if (editingVisit) {
        res = await fetch(`/api/obstetrics/assessments/${editingVisit.id}`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/obstetrics/assessments", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Save failed")
        return
      }
      toast.success(editingVisit ? "Assessment updated" : "Assessment recorded")
      setSheetOpen(false)
      void loadVisits()
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/obstetrics/assessments/${deleteTarget.id}`, {
        method: "DELETE", credentials: "include",
      })
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Delete failed")
        return
      }
      setVisits((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      toast.success("Assessment deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const canEdit = user?.role === "Midwife" || user?.role === "Hospital Admin" || user?.role === "Doctor"

  return (
    <div className="space-y-4 p-1">
      {/* Filter bar */}
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><ClipboardList className="h-4 w-4" /></div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">ANC / Obstetric Assessments</CardTitle>
                <CardDescription className="text-xs">View, record, and manage obstetric assessments by date range.</CardDescription>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
                <Plus className="h-4 w-4" /> New Assessment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="border-b border-rose-50 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Visits ({visits.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading…
            </div>
          ) : visits.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No assessments in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-rose-50/50 text-left text-xs font-medium uppercase tracking-wide text-rose-800">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">G</th>
                    <th className="px-4 py-3">P</th>
                    <th className="px-4 py-3">GA (wks)</th>
                    <th className="px-4 py-3">EDD</th>
                    <th className="px-4 py-3">FH cm</th>
                    <th className="px-4 py-3">FHR</th>
                    <th className="px-4 py-3">Recorded by</th>
                    {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-rose-50/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{String(v.visit_date).slice(0, 10)}</td>
                      <td className="px-4 py-3 font-medium">
                        {v.patient_name}
                        {v.patient_number && <span className="ml-1 text-xs text-slate-400">#{v.patient_number}</span>}
                      </td>
                      <td className="px-4 py-3">{v.gravida ?? "—"}</td>
                      <td className="px-4 py-3">{v.parity ?? "—"}</td>
                      <td className="px-4 py-3">{v.gestational_age_weeks ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{v.edd ? String(v.edd).slice(0, 10) : "—"}</td>
                      <td className="px-4 py-3">{v.fundal_height_cm ?? "—"}</td>
                      <td className="px-4 py-3">{v.fetal_heart_rate ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{v.recorded_by ?? "—"}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openEdit(v)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(v)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">{editingVisit ? "Edit Assessment" : "New ANC Assessment"}</SheetTitle>
            <SheetDescription className="text-xs">Record obstetric findings for this visit.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            {!editingVisit && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Patient *</Label>
                <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
              </div>
            )}
            {editingVisit && (
              <div className="rounded-lg bg-rose-50/50 border border-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
                {editingVisit.patient_name}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Visit Date</Label>
                <Input type="date" value={form.visitDate} onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">EDD</Label>
                <Input type="date" value={form.edd} onChange={(e) => setForm((f) => ({ ...f, edd: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Gravida (G)</Label>
                <Input type="number" min={0} placeholder="e.g. 2" value={form.gravida} onChange={(e) => setForm((f) => ({ ...f, gravida: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Parity (P)</Label>
                <Input type="number" min={0} placeholder="e.g. 1" value={form.parity} onChange={(e) => setForm((f) => ({ ...f, parity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Gestational Age (wks)</Label>
                <Input type="number" min={0} max={45} placeholder="e.g. 28" value={form.gestationalAgeWeeks} onChange={(e) => setForm((f) => ({ ...f, gestationalAgeWeeks: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Fundal Height (cm)</Label>
                <Input type="number" min={0} step="0.5" placeholder="e.g. 28.0" value={form.fundalHeightCm} onChange={(e) => setForm((f) => ({ ...f, fundalHeightCm: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Fetal Heart Rate</Label>
                <Input type="number" min={60} max={200} placeholder="e.g. 140" value={form.fetalHeartRate} onChange={(e) => setForm((f) => ({ ...f, fetalHeartRate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Presentation</Label>
                <Input placeholder="e.g. Cephalic" value={form.presentation} onChange={(e) => setForm((f) => ({ ...f, presentation: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea rows={3} placeholder="Clinical notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" />
            </div>
            <Button
              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              onClick={saveVisit}
              disabled={saving}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : editingVisit ? "Save Changes" : "Record Assessment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the assessment for <strong>{deleteTarget?.patient_name}</strong> on{" "}
              {deleteTarget ? String(deleteTarget.visit_date).slice(0, 10) : ""}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-anc-visits.tsx
git commit -m "feat(midwife): add MidwifeANCVisits with full CRUD and slide-over form"
```

---

## Task 11: Component — `MidwifePatientRecords`

**Files:**
- Create: `components/midwife/midwife-patient-records.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useState } from "react"
import { Search, ChevronRight, Loader2, ClipboardList, Baby, HeartPulse } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { usePatients } from "@/lib/patient-context"

interface PatientRow {
  id: string
  first_name: string
  last_name: string
  patient_number: string
  date_of_birth?: string
}

interface ObsAssessment {
  id: string
  visit_date: string
  gravida: number | null
  parity: number | null
  gestational_age_weeks: number | null
  edd: string | null
  fetal_heart_rate: number | null
  fundal_height_cm: number | null
  presentation: string | null
  notes: string | null
}

interface LaborRecord {
  id: string
  admission_date: string
  delivery_date: string | null
  delivery_type: string | null
  baby_birth_weight_g: number | null
  baby_apgar_1min: number | null
  baby_apgar_5min: number | null
  baby_condition: string | null
}

interface PostnatalVisit {
  id: string
  visit_date: string
  days_postpartum: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  lochia: string | null
  baby_weight_g: number | null
}

export function MidwifePatientRecords() {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [obsHistory, setObsHistory] = useState<ObsAssessment[]>([])
  const [laborHistory, setLaborHistory] = useState<LaborRecord[]>([])
  const [postnatalHistory, setPostnatalHistory] = useState<PostnatalVisit[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const results = debouncedQuery.length >= 2 ? searchPatients(debouncedQuery).slice(0, 12) : []

  const openPatient = useCallback(async (p: PatientRow) => {
    setSelectedPatient(p)
    setSheetOpen(true)
    setLoadingHistory(true)
    try {
      const [obsRes, laborRes, postnatalRes] = await Promise.all([
        fetch(`/api/obstetrics/visits?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/labor?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/postnatal?patientId=${p.id}`, { credentials: "include" }),
      ])
      const [obsData, laborData, postnatalData] = await Promise.all([
        obsRes.ok ? obsRes.json() : { visits: [] },
        laborRes.ok ? laborRes.json() : { records: [] },
        postnatalRes.ok ? postnatalRes.json() : { visits: [] },
      ])
      setObsHistory(Array.isArray(obsData.visits) ? obsData.visits : [])
      setLaborHistory(Array.isArray(laborData.records) ? laborData.records : [])
      setPostnatalHistory(Array.isArray(postnatalData.visits) ? postnatalData.visits : [])
    } catch {
      toast.error("Failed to load patient history")
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  return (
    <div className="space-y-4 p-1">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Patient Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
            <Input
              className="pl-9 focus-visible:ring-rose-400"
              placeholder="Search by name or patient number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {debouncedQuery.length >= 2 && (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="p-0">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No patients found.</p>
            ) : (
              <div className="divide-y divide-rose-50">
                {results.map((p) => {
                  const patient = p as unknown as PatientRow
                  const fn = patient.first_name || (p as { firstName?: string }).firstName || ""
                  const ln = patient.last_name || (p as { lastName?: string }).lastName || ""
                  const pn = patient.patient_number || (p as { patientNumber?: string }).patientNumber || ""
                  return (
                    <button
                      key={patient.id}
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-rose-50/30 transition-colors"
                      onClick={() => openPatient({ ...patient, first_name: fn, last_name: ln, patient_number: pn })}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{fn} {ln}</p>
                        <p className="text-xs text-slate-400">#{pn}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-rose-400" />
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Patient History Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">
              {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : ""}
            </SheetTitle>
            {selectedPatient?.patient_number && (
              <p className="text-xs text-slate-400">Patient #{selectedPatient.patient_number}</p>
            )}
          </SheetHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading history…
            </div>
          ) : (
            <div className="space-y-6">
              {/* ANC Assessments */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> ANC Assessments ({obsHistory.length})
                </h3>
                {obsHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-1">No assessments on record.</p>
                ) : (
                  <div className="space-y-2">
                    {obsHistory.map((a) => (
                      <div key={a.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{String(a.visit_date).slice(0, 10)}</p>
                        <p className="text-slate-500 mt-0.5">
                          G{a.gravida ?? "?"} P{a.parity ?? "?"} · {a.gestational_age_weeks != null ? `${a.gestational_age_weeks} wks` : "—"}
                          {a.edd ? ` · EDD ${String(a.edd).slice(0, 10)}` : ""}
                          {a.fetal_heart_rate ? ` · FHR ${a.fetal_heart_rate}` : ""}
                        </p>
                        {a.notes && <p className="text-slate-400 mt-0.5 italic truncate">{a.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Labor & Delivery */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <Baby className="h-3.5 w-3.5" /> Labor & Delivery ({laborHistory.length})
                </h3>
                {laborHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-1">No delivery records.</p>
                ) : (
                  <div className="space-y-2">
                    {laborHistory.map((lr) => (
                      <div key={lr.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">Admitted {String(lr.admission_date).slice(0, 10)}</p>
                        <p className="text-slate-500 mt-0.5">
                          {lr.delivery_type ?? "Delivery type not recorded"}
                          {lr.delivery_date ? ` · ${String(lr.delivery_date).slice(0, 10)}` : ""}
                        </p>
                        {lr.baby_birth_weight_g && (
                          <p className="text-slate-400 mt-0.5">
                            Baby: {lr.baby_birth_weight_g}g
                            {lr.baby_apgar_1min != null ? ` · APGAR 1min: ${lr.baby_apgar_1min}` : ""}
                            {lr.baby_apgar_5min != null ? ` · 5min: ${lr.baby_apgar_5min}` : ""}
                            {lr.baby_condition ? ` · ${lr.baby_condition}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Postnatal */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <HeartPulse className="h-3.5 w-3.5" /> Postnatal Visits ({postnatalHistory.length})
                </h3>
                {postnatalHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-1">No postnatal visits on record.</p>
                ) : (
                  <div className="space-y-2">
                    {postnatalHistory.map((pv) => (
                      <div key={pv.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">
                          {String(pv.visit_date).slice(0, 10)}
                          {pv.days_postpartum != null ? ` (Day ${pv.days_postpartum})` : ""}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {pv.bp_systolic && pv.bp_diastolic ? `BP ${pv.bp_systolic}/${pv.bp_diastolic}` : "BP not recorded"}
                          {pv.lochia ? ` · Lochia: ${pv.lochia}` : ""}
                          {pv.baby_weight_g ? ` · Baby ${pv.baby_weight_g}g` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-patient-records.tsx
git commit -m "feat(midwife): add MidwifePatientRecords with search and obstetric history slide-over"
```

---

## Task 12: Component — `MidwifeLaborDelivery`

**Files:**
- Create: `components/midwife/midwife-labor-delivery.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, Baby, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"

interface LaborRecord {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  admission_date: string
  onset_of_labor: string | null
  delivery_date: string | null
  delivery_type: string | null
  duration_of_labor_hours: number | null
  presentation: string | null
  blood_loss_ml: number | null
  complications: string | null
  notes: string | null
  baby_sex: string | null
  baby_birth_weight_g: number | null
  baby_apgar_1min: number | null
  baby_apgar_5min: number | null
  baby_condition: string | null
  baby_notes: string | null
  midwife_name: string | null
}

interface PostnatalVisit {
  id: string
  visit_date: string
  days_postpartum: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  temperature_c: number | null
  lochia: string | null
  breastfeeding_status: string | null
  baby_weight_g: number | null
  notes: string | null
}

interface PatientOption { id: string; patientNumber: string; firstName: string; lastName: string }

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []
  return (
    <div className="relative">
      <Input
        placeholder="Search patient…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => { onChange(null); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-rose-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-rose-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => {
            const fn = (p as { firstName?: string; first_name?: string }).firstName || (p as { first_name?: string }).first_name || ""
            const ln = (p as { lastName?: string; last_name?: string }).lastName || (p as { last_name?: string }).last_name || ""
            const pn = (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patient_number?: string }).patient_number || ""
            return (
              <button key={p.id} type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50"
                onMouseDown={(e) => { e.preventDefault(); onChange({ id: p.id, patientNumber: pn, firstName: fn, lastName: ln }); setOpen(false); setQuery("") }}>
                <span className="font-medium">{fn} {ln}</span>
                <span className="ml-2 text-xs text-slate-400">{pn}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type LaborFormState = {
  patientId: string; admissionDate: string; onsetOfLabor: string; deliveryDate: string
  deliveryType: string; durationOfLaborHours: string; presentation: string
  bloodLossMl: string; complications: string; notes: string
  babySex: string; babyBirthWeightG: string; babyApgar1min: string; babyApgar5min: string
  babyCondition: string; babyNotes: string
}
const EMPTY_LABOR: LaborFormState = {
  patientId: "", admissionDate: new Date().toISOString().slice(0, 16),
  onsetOfLabor: "", deliveryDate: "", deliveryType: "", durationOfLaborHours: "",
  presentation: "", bloodLossMl: "", complications: "", notes: "",
  babySex: "", babyBirthWeightG: "", babyApgar1min: "", babyApgar5min: "",
  babyCondition: "", babyNotes: "",
}

interface MidwifeLaborDeliveryProps { openNewOnMount?: boolean }

export function MidwifeLaborDelivery({ openNewOnMount = false }: MidwifeLaborDeliveryProps) {
  const { user } = useAuth()
  const [records, setRecords] = useState<LaborRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [postnatalMap, setPostnatalMap] = useState<Record<string, PostnatalVisit[]>>({})
  const [loadingPostnatal, setLoadingPostnatal] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<LaborRecord | null>(null)
  const [form, setForm] = useState<LaborFormState>(EMPTY_LABOR)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LaborRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => { if (openNewOnMount) { openNew() } }, [openNewOnMount]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/labor", { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json().catch(() => ({ records: [] }))
      if (mountedRef.current) setRecords(Array.isArray(data.records) ? data.records : [])
    } catch {
      toast.error("Failed to load labor records")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void loadRecords() }, [loadRecords])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!postnatalMap[id]) {
      setLoadingPostnatal(id)
      try {
        const res = await fetch(`/api/postnatal?laborId=${id}`, { credentials: "include" })
        const data = await res.json().catch(() => ({ visits: [] }))
        setPostnatalMap((prev) => ({ ...prev, [id]: Array.isArray(data.visits) ? data.visits : [] }))
      } catch {
        setPostnatalMap((prev) => ({ ...prev, [id]: [] }))
      } finally {
        setLoadingPostnatal(null)
      }
    }
  }

  function openNew() {
    setEditingRecord(null); setForm(EMPTY_LABOR); setSelectedPatient(null); setSheetOpen(true)
  }

  function openEdit(r: LaborRecord) {
    setEditingRecord(r)
    setForm({
      patientId: r.patient_id,
      admissionDate: String(r.admission_date).slice(0, 16),
      onsetOfLabor: r.onset_of_labor ?? "",
      deliveryDate: r.delivery_date ? String(r.delivery_date).slice(0, 16) : "",
      deliveryType: r.delivery_type ?? "",
      durationOfLaborHours: r.duration_of_labor_hours != null ? String(r.duration_of_labor_hours) : "",
      presentation: r.presentation ?? "",
      bloodLossMl: r.blood_loss_ml != null ? String(r.blood_loss_ml) : "",
      complications: r.complications ?? "",
      notes: r.notes ?? "",
      babySex: r.baby_sex ?? "",
      babyBirthWeightG: r.baby_birth_weight_g != null ? String(r.baby_birth_weight_g) : "",
      babyApgar1min: r.baby_apgar_1min != null ? String(r.baby_apgar_1min) : "",
      babyApgar5min: r.baby_apgar_5min != null ? String(r.baby_apgar_5min) : "",
      babyCondition: r.baby_condition ?? "",
      babyNotes: r.baby_notes ?? "",
    })
    setSelectedPatient(null)
    setSheetOpen(true)
  }

  async function saveRecord() {
    const patientId = editingRecord ? editingRecord.patient_id : selectedPatient?.id ?? ""
    if (!patientId) { toast.error("Please select a patient"); return }
    setSaving(true)
    try {
      const payload = {
        patientId,
        admissionDate: form.admissionDate || new Date().toISOString(),
        onsetOfLabor: form.onsetOfLabor || null,
        deliveryDate: form.deliveryDate || null,
        deliveryType: form.deliveryType || null,
        durationOfLaborHours: form.durationOfLaborHours ? parseFloat(form.durationOfLaborHours) : null,
        presentation: form.presentation || null,
        bloodLossMl: form.bloodLossMl ? parseInt(form.bloodLossMl) : null,
        complications: form.complications || null,
        notes: form.notes || null,
        babySex: form.babySex || null,
        babyBirthWeightG: form.babyBirthWeightG ? parseInt(form.babyBirthWeightG) : null,
        babyApgar1min: form.babyApgar1min ? parseInt(form.babyApgar1min) : null,
        babyApgar5min: form.babyApgar5min ? parseInt(form.babyApgar5min) : null,
        babyCondition: form.babyCondition || null,
        babyNotes: form.babyNotes || null,
      }
      const res = editingRecord
        ? await fetch(`/api/labor/${editingRecord.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/labor", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Save failed"); return }
      toast.success(editingRecord ? "Record updated" : "Delivery recorded")
      setSheetOpen(false)
      void loadRecords()
    } catch { toast.error("Save failed") } finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/labor/${deleteTarget.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Delete failed"); return }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success("Record deleted")
      setDeleteTarget(null)
    } catch { toast.error("Delete failed") } finally { setDeleting(false) }
  }

  const canEdit = user?.role === "Midwife" || user?.role === "Hospital Admin" || user?.role === "Doctor"

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><Baby className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Labor & Delivery Records</h2>
            <p className="text-xs text-slate-400">Full intrapartum and baby outcome records.</p>
          </div>
        </div>
        {canEdit && (
          <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
            <Plus className="h-4 w-4" /> Record Delivery
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No labor records yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id} className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-700">{r.patient_name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Admitted {String(r.admission_date).slice(0, 10)}
                      {r.delivery_date ? ` · Delivered ${String(r.delivery_date).slice(0, 10)}` : " · Delivery pending"}
                      {r.delivery_type ? ` (${r.delivery_type})` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-rose-50" onClick={() => toggleExpand(r.id)}>
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {/* Baby summary row */}
                {(r.baby_birth_weight_g || r.baby_condition) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {r.baby_sex && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">{r.baby_sex}</span>}
                    {r.baby_birth_weight_g && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.baby_birth_weight_g}g</span>}
                    {r.baby_apgar_1min != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">APGAR 1′: {r.baby_apgar_1min}</span>}
                    {r.baby_apgar_5min != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">5′: {r.baby_apgar_5min}</span>}
                    {r.baby_condition && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-800">{r.baby_condition}</span>}
                  </div>
                )}
              </CardHeader>

              {expandedId === r.id && (
                <CardContent className="border-t border-rose-50 pt-3 space-y-3">
                  {r.complications && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-0.5">Complications</p>
                      <p className="text-xs text-slate-600">{r.complications}</p>
                    </div>
                  )}
                  {r.notes && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-0.5">Notes</p>
                      <p className="text-xs text-slate-600">{r.notes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-2">Postnatal Visits</p>
                    {loadingPostnatal === r.id ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
                    ) : (postnatalMap[r.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No postnatal visits linked to this delivery.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(postnatalMap[r.id] ?? []).map((pv) => (
                          <div key={pv.id} className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-xs">
                            <span className="font-medium">{String(pv.visit_date).slice(0, 10)}</span>
                            {pv.days_postpartum != null && <span className="ml-1 text-slate-400">Day {pv.days_postpartum}</span>}
                            {pv.bp_systolic && pv.bp_diastolic && <span className="ml-2">BP {pv.bp_systolic}/{pv.bp_diastolic}</span>}
                            {pv.lochia && <span className="ml-2 capitalize">Lochia: {pv.lochia}</span>}
                            {pv.baby_weight_g && <span className="ml-2">Baby {pv.baby_weight_g}g</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">{editingRecord ? "Edit Delivery Record" : "Record Delivery"}</SheetTitle>
            <SheetDescription className="text-xs">Record intrapartum details and baby outcome.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 text-sm">
            {!editingRecord && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Patient *</Label>
                <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
              </div>
            )}
            {editingRecord && (
              <div className="rounded-lg bg-rose-50/50 border border-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{editingRecord.patient_name}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Admission Date/Time</Label>
                <Input type="datetime-local" value={form.admissionDate} onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Onset of Labor</Label>
                <Select value={form.onsetOfLabor} onValueChange={(v) => setForm((f) => ({ ...f, onsetOfLabor: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spontaneous">Spontaneous</SelectItem>
                    <SelectItem value="induced">Induced</SelectItem>
                    <SelectItem value="augmented">Augmented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Presentation</Label>
                <Input placeholder="e.g. Cephalic" value={form.presentation} onChange={(e) => setForm((f) => ({ ...f, presentation: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Delivery Date/Time</Label>
                <Input type="datetime-local" value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Delivery Type</Label>
                <Select value={form.deliveryType} onValueChange={(v) => setForm((f) => ({ ...f, deliveryType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SVD">SVD</SelectItem>
                    <SelectItem value="C-Section">C-Section</SelectItem>
                    <SelectItem value="Forceps">Forceps</SelectItem>
                    <SelectItem value="Vacuum">Vacuum</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Duration (hours)</Label>
                <Input type="number" min={0} step="0.5" placeholder="e.g. 8.5" value={form.durationOfLaborHours} onChange={(e) => setForm((f) => ({ ...f, durationOfLaborHours: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Blood Loss (ml)</Label>
                <Input type="number" min={0} placeholder="e.g. 300" value={form.bloodLossMl} onChange={(e) => setForm((f) => ({ ...f, bloodLossMl: e.target.value }))} />
              </div>
            </div>
            <hr className="border-rose-100" />
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Baby Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Sex</Label>
                <Select value={form.babySex} onValueChange={(v) => setForm((f) => ({ ...f, babySex: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Indeterminate">Indeterminate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Birth Weight (g)</Label>
                <Input type="number" min={0} placeholder="e.g. 3200" value={form.babyBirthWeightG} onChange={(e) => setForm((f) => ({ ...f, babyBirthWeightG: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">APGAR 1 min</Label>
                <Input type="number" min={0} max={10} placeholder="0–10" value={form.babyApgar1min} onChange={(e) => setForm((f) => ({ ...f, babyApgar1min: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">APGAR 5 min</Label>
                <Input type="number" min={0} max={10} placeholder="0–10" value={form.babyApgar5min} onChange={(e) => setForm((f) => ({ ...f, babyApgar5min: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Baby Condition</Label>
                <Select value={form.babyCondition} onValueChange={(v) => setForm((f) => ({ ...f, babyCondition: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alive">Alive</SelectItem>
                    <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                    <SelectItem value="Neonatal Death">Neonatal Death</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Complications</Label>
              <Textarea rows={2} placeholder="Any complications…" value={form.complications} onChange={(e) => setForm((f) => ({ ...f, complications: e.target.value }))} className="resize-none" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea rows={2} placeholder="Clinical notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" />
            </div>
            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={saveRecord} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : editingRecord ? "Save Changes" : "Record Delivery"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery record?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the labor record for <strong>{deleteTarget?.patient_name}</strong>? This cannot be undone and will unlink any postnatal visits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-labor-delivery.tsx
git commit -m "feat(midwife): add MidwifeLaborDelivery with full CRUD and postnatal timeline"
```

---

## Task 13: Component — `MidwifeClinicalActions`

**Files:**
- Create: `components/midwife/midwife-clinical-actions.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Pill, FlaskConical, Send, ChevronDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { usePatients } from "@/lib/patient-context"

type Section = "rx" | "lab" | "referral" | null

interface PatientOption { id: string; patientNumber: string; firstName: string; lastName: string }

function PatientSearch({ value, onChange, accentClass }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void; accentClass: string }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []
  return (
    <div className="relative">
      <Input
        placeholder="Search patient name or number…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => { onChange(null); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className={`focus-visible:ring-rose-400`}
      />
      {open && results.length > 0 && (
        <div className={`absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border ${accentClass} bg-white shadow-lg max-h-48 overflow-y-auto`}>
          {results.map((p) => {
            const fn = (p as { firstName?: string; first_name?: string }).firstName || (p as { first_name?: string }).first_name || ""
            const ln = (p as { lastName?: string; last_name?: string }).lastName || (p as { last_name?: string }).last_name || ""
            const pn = (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patient_number?: string }).patient_number || ""
            return (
              <button key={p.id} type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50"
                onMouseDown={(e) => { e.preventDefault(); onChange({ id: p.id, patientNumber: pn, firstName: fn, lastName: ln }); setOpen(false); setQuery("") }}>
                <span className="font-medium">{fn} {ln}</span>
                <span className="ml-2 text-xs text-slate-400">{pn}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AccordionSection({ id, activeId, toggle, icon, label, children }: {
  id: Section; activeId: Section; toggle: (s: Section) => void
  icon: React.ReactNode; label: string; children: React.ReactNode
}) {
  const isOpen = activeId === id
  return (
    <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-rose-50/30 transition-colors"
        onClick={() => toggle(isOpen ? null : id)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <div className="rounded-xl bg-rose-50 p-1.5 text-rose-600">{icon}</div>
          {label}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && <CardContent className="border-t border-rose-50 pt-4 pb-4">{children}</CardContent>}
    </Card>
  )
}

export function MidwifeClinicalActions({ defaultSection }: { defaultSection?: Section }) {
  const [activeSection, setActiveSection] = useState<Section>(defaultSection ?? null)

  // Prescription state
  const [rxPatient, setRxPatient] = useState<PatientOption | null>(null)
  const [rxMedication, setRxMedication] = useState("")
  const [rxDosage, setRxDosage] = useState("")
  const [rxFrequency, setRxFrequency] = useState("")
  const [rxDuration, setRxDuration] = useState("")
  const [rxNotes, setRxNotes] = useState("")
  const [savingRx, setSavingRx] = useState(false)

  // Lab order state
  const [labPatient, setLabPatient] = useState<PatientOption | null>(null)
  const [labTest, setLabTest] = useState("")
  const [labNotes, setLabNotes] = useState("")
  const [labPriority, setLabPriority] = useState("routine")
  const [savingLab, setSavingLab] = useState(false)

  // Referral state
  const [refPatient, setRefPatient] = useState<PatientOption | null>(null)
  const [refDepartment, setRefDepartment] = useState("")
  const [refReason, setRefReason] = useState("")
  const [refUrgency, setRefUrgency] = useState("routine")
  const [savingRef, setSavingRef] = useState(false)

  const toggle = (s: Section) => setActiveSection(s)

  async function submitRx() {
    if (!rxPatient) { toast.error("Select a patient"); return }
    if (!rxMedication.trim()) { toast.error("Enter medication name"); return }
    setSavingRx(true)
    try {
      const res = await fetch("/api/medical/prescriptions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: rxPatient.id,
          medication: rxMedication,
          dosage: rxDosage,
          frequency: rxFrequency,
          duration: rxDuration,
          notes: rxNotes,
          prescribedBy: "midwife",
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed to save prescription"); return }
      toast.success("Prescription recorded")
      setRxPatient(null); setRxMedication(""); setRxDosage(""); setRxFrequency(""); setRxDuration(""); setRxNotes("")
    } catch { toast.error("Failed to save prescription") } finally { setSavingRx(false) }
  }

  async function submitLab() {
    if (!labPatient) { toast.error("Select a patient"); return }
    if (!labTest.trim()) { toast.error("Enter test name or select from catalog"); return }
    setSavingLab(true)
    try {
      const res = await fetch("/api/lab-tests", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: labPatient.id,
          testName: labTest,
          priority: labPriority,
          notes: labNotes,
          orderedBy: "midwife",
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed to order lab test"); return }
      toast.success("Lab test ordered")
      setLabPatient(null); setLabTest(""); setLabNotes(""); setLabPriority("routine")
    } catch { toast.error("Failed to order lab test") } finally { setSavingLab(false) }
  }

  async function submitReferral() {
    if (!refPatient) { toast.error("Select a patient"); return }
    if (!refDepartment.trim()) { toast.error("Select destination department"); return }
    if (!refReason.trim()) { toast.error("Enter reason for referral"); return }
    setSavingRef(true)
    try {
      // Referrals are recorded as medical notes/documents
      const res = await fetch("/api/medical/documents", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: refPatient.id,
          documentType: "referral",
          content: `REFERRAL — To: ${refDepartment}\nUrgency: ${refUrgency}\nReason: ${refReason}`,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed to save referral"); return }
      toast.success("Referral recorded")
      setRefPatient(null); setRefDepartment(""); setRefReason(""); setRefUrgency("routine")
    } catch { toast.error("Failed to save referral") } finally { setSavingRef(false) }
  }

  return (
    <div className="space-y-3 p-1">
      <AccordionSection id="rx" activeId={activeSection} toggle={toggle} icon={<Pill className="h-4 w-4" />} label="Prescriptions">
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs font-medium">Patient *</Label><PatientSearch value={rxPatient} onChange={setRxPatient} accentClass="border-rose-100" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2"><Label className="text-xs font-medium">Medication *</Label><Input placeholder="e.g. Ferrous sulphate 200mg" value={rxMedication} onChange={(e) => setRxMedication(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs font-medium">Dosage</Label><Input placeholder="e.g. 200mg" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs font-medium">Frequency</Label><Input placeholder="e.g. BD" value={rxFrequency} onChange={(e) => setRxFrequency(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs font-medium">Duration</Label><Input placeholder="e.g. 30 days" value={rxDuration} onChange={(e) => setRxDuration(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs font-medium">Notes</Label><Textarea rows={2} value={rxNotes} onChange={(e) => setRxNotes(e.target.value)} className="resize-none" /></div>
          <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={submitRx} disabled={savingRx}>
            {savingRx ? "Saving…" : "Save Prescription"}
          </Button>
        </div>
      </AccordionSection>

      <AccordionSection id="lab" activeId={activeSection} toggle={toggle} icon={<FlaskConical className="h-4 w-4" />} label="Lab Orders">
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs font-medium">Patient *</Label><PatientSearch value={labPatient} onChange={setLabPatient} accentClass="border-rose-100" /></div>
          <div className="space-y-1"><Label className="text-xs font-medium">Test Name *</Label><Input placeholder="e.g. Full Blood Count, Urinalysis, HbA1c" value={labTest} onChange={(e) => setLabTest(e.target.value)} /></div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Priority</Label>
            <Select value={labPriority} onValueChange={setLabPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="stat">STAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs font-medium">Clinical Notes</Label><Textarea rows={2} value={labNotes} onChange={(e) => setLabNotes(e.target.value)} className="resize-none" /></div>
          <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={submitLab} disabled={savingLab}>
            {savingLab ? "Ordering…" : "Order Lab Test"}
          </Button>
        </div>
      </AccordionSection>

      <AccordionSection id="referral" activeId={activeSection} toggle={toggle} icon={<Send className="h-4 w-4" />} label="Referrals">
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs font-medium">Patient *</Label><PatientSearch value={refPatient} onChange={setRefPatient} accentClass="border-rose-100" /></div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Refer To *</Label>
            <Select value={refDepartment} onValueChange={setRefDepartment}>
              <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Obstetrics & Gynaecology">Obstetrics & Gynaecology</SelectItem>
                <SelectItem value="Paediatrics">Paediatrics</SelectItem>
                <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
                <SelectItem value="Laboratory">Laboratory</SelectItem>
                <SelectItem value="Radiology">Radiology</SelectItem>
                <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                <SelectItem value="Physiotherapy">Physiotherapy</SelectItem>
                <SelectItem value="Social Work">Social Work</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Urgency</Label>
            <Select value={refUrgency} onValueChange={setRefUrgency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs font-medium">Reason *</Label><Textarea rows={3} placeholder="Clinical reason for referral…" value={refReason} onChange={(e) => setRefReason(e.target.value)} className="resize-none" /></div>
          <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={submitReferral} disabled={savingRef}>
            {savingRef ? "Saving…" : "Save Referral"}
          </Button>
        </div>
      </AccordionSection>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-clinical-actions.tsx
git commit -m "feat(midwife): add MidwifeClinicalActions with Rx, lab orders, and referrals"
```

---

## Task 14: Component — `MidwifeExports`

**Files:**
- Create: `components/midwife/midwife-exports.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Download, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Dataset = "obstetrics" | "labor" | "postnatal"
type Format = "xlsx" | "pdf" | "csv"

const DATASETS: { id: Dataset; label: string; description: string }[] = [
  { id: "obstetrics", label: "ANC / Obstetric Assessments", description: "Visit date, patient, G/P, GA, EDD, FHR, fundal height, presentation, notes." },
  { id: "labor", label: "Labor & Delivery Records", description: "Admission, delivery type, duration, baby details, APGAR scores, complications." },
  { id: "postnatal", label: "Postnatal Visits", description: "Visit date, days postpartum, BP, temperature, lochia, breastfeeding, baby weight." },
]

export function MidwifeExports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [mineOnly, setMineOnly] = useState(true)
  const [exporting, setExporting] = useState<`${Dataset}-${Format}` | null>(null)

  const doExport = async (dataset: Dataset, format: Format) => {
    if (new Date(from) > new Date(to)) { toast.error("From date must be on or before To date"); return }
    const key: `${Dataset}-${Format}` = `${dataset}-${format}`
    setExporting(key)
    try {
      const payload: { dataset: string; format: string; filters: Record<string, unknown> } = {
        dataset,
        format,
        filters: {
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T23:59:59Z").toISOString(),
        },
      }
      if (mineOnly) payload.filters.recordedByUserId = true
      const res = await fetch("/api/exports/direct", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || `Export failed (${res.status})`); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `midwife-${dataset}-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${dataset} export (${format.toUpperCase()}) downloaded`)
    } catch { toast.error("Export failed") } finally { setExporting(null) }
  }

  return (
    <div className="space-y-6 p-1">
      {/* Date range card */}
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600"><Download className="h-4 w-4" /></div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">Midwifery Exports</CardTitle>
              <CardDescription className="text-xs">Download clinical records for any date range in CSV, XLSX, or PDF.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="rounded border-rose-200" />
            <span className="text-slate-600">My records only</span>
          </label>
        </CardContent>
      </Card>

      {/* Dataset cards */}
      {DATASETS.map(({ id, label, description }) => (
        <Card key={id} className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700">{label}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(["csv", "xlsx", "pdf"] as Format[]).map((fmt) => {
                const key: `${Dataset}-${Format}` = `${id}-${fmt}`
                const isLoading = exporting === key
                return (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
                    onClick={() => doExport(id, fmt)}
                    disabled={!!exporting}
                  >
                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {fmt.toUpperCase()}
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-exports.tsx
git commit -m "feat(midwife): add MidwifeExports for obstetrics, labor, and postnatal datasets"
```

---

## Task 15: Component — `MidwifeShell` (Orchestrator)

**Files:**
- Create: `components/midwife/midwife-shell.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"
import { useState } from "react"
import { Settings } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { MidwifeNotificationBell } from "@/components/midwife/midwife-notification-bell"
import { MidwifeOverview } from "@/components/midwife/midwife-overview"
import { MidwifePatientRecords } from "@/components/midwife/midwife-patient-records"
import { MidwifeANCVisits } from "@/components/midwife/midwife-anc-visits"
import { MidwifeLaborDelivery } from "@/components/midwife/midwife-labor-delivery"
import { MidwifeClinicalActions } from "@/components/midwife/midwife-clinical-actions"
import { MidwifeExports } from "@/components/midwife/midwife-exports"

type Tab = "overview" | "patients" | "anc" | "labor" | "clinical" | "exports"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "patients", label: "Patients" },
  { id: "anc", label: "ANC Visits" },
  { id: "labor", label: "Labor & Delivery" },
  { id: "clinical", label: "Clinical" },
  { id: "exports", label: "Exports" },
]

export function MidwifeShell() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [ancOpenNew, setAncOpenNew] = useState(false)
  const [laborOpenNew, setLaborOpenNew] = useState(false)
  const [clinicalSection, setClinicalSection] = useState<"rx" | "lab" | "referral" | null>(null)

  function navigateTo(tab: string, section?: string) {
    setActiveTab(tab as Tab)
    if (tab === "anc" && section === "new") {
      setAncOpenNew(true)
      setTimeout(() => setAncOpenNew(false), 300)
    }
    if (tab === "labor" && section === "new") {
      setLaborOpenNew(true)
      setTimeout(() => setLaborOpenNew(false), 300)
    }
    if (tab === "clinical" && section) {
      setClinicalSection(section as "rx" | "lab" | "referral")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal header */}
      <div className="bg-white border-b border-rose-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div>
              <p className="text-sm font-bold text-slate-800">Dayspring HIS — Midwifery</p>
              {user && (
                <p className="text-xs text-rose-600">{user.name} · Midwife</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <MidwifeNotificationBell />
              <Link href="/midwife/settings">
                <button
                  type="button"
                  aria-label="Settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-rose-600 text-rose-700"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-rose-200",
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
        {activeTab === "overview" && <MidwifeOverview onNavigate={navigateTo} />}
        {activeTab === "patients" && <MidwifePatientRecords />}
        {activeTab === "anc" && <MidwifeANCVisits openNewOnMount={ancOpenNew} />}
        {activeTab === "labor" && <MidwifeLaborDelivery openNewOnMount={laborOpenNew} />}
        {activeTab === "clinical" && <MidwifeClinicalActions defaultSection={clinicalSection} />}
        {activeTab === "exports" && <MidwifeExports />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/midwife/midwife-shell.tsx
git commit -m "feat(midwife): add MidwifeShell orchestrator with 6-tab navigation"
```

---

## Task 16: Wire Up — `app/midwife/page.tsx`

**Files:**
- Modify: `app/midwife/page.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MidwifeShell } from "@/components/midwife/midwife-shell"

export default function MidwifePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.push("/"); return }
    if (user.role !== "Midwife") { router.push("/dashboard"); return }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (user.role !== "Midwife") return null

  return (
    <DashboardLayout>
      <MidwifeShell />
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/midwife/page.tsx
git commit -m "feat(midwife): wire MidwifeShell into /midwife page"
```

---

## Task 17: Retire — `app/midwife/anc/page.tsx`

**Files:**
- Modify: `app/midwife/anc/page.tsx`

- [ ] **Step 1: Replace the file with a redirect** (ANC tab is now in the shell)

```tsx
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MidwifeAncRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/midwife") }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Redirecting…</div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/midwife/anc/page.tsx
git commit -m "fix(midwife): redirect /midwife/anc to /midwife (ANC is now in shell)"
```

---

## Task 18: Fix — Remove `DoctorDashboard` Embed from `midwife-dashboard.tsx`

**Files:**
- Modify: `components/dashboards/midwife-dashboard.tsx`

- [ ] **Step 1: Remove the embedded DoctorDashboard**

Remove lines 3 and 193 of the file. The import on line 3:
```
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
```
And the JSX at line 193:
```tsx
<div className="rounded-xl border border-rose-200 bg-rose-50/50 p-1 shadow-sm shadow-rose-100">
  <DoctorDashboard title="Midwifery Dashboard" />
</div>
```

The `MidwifeDashboard` component is no longer rendered in the app (the page now renders `MidwifeShell`). However, it may still be imported elsewhere. Clean up the `DoctorDashboard` embed so it doesn't cause import errors if the file is ever referenced.

- [ ] **Step 2: Verify no remaining references to `MidwifeDashboard`**

```bash
grep -rn "MidwifeDashboard" c:/Users/ssego/Documents/dayspring-his/dayspring-his/app/ c:/Users/ssego/Documents/dayspring-his/dayspring-his/components/
```

Expected output: Only the file itself defines it. No pages should be importing it.

- [ ] **Step 3: Commit**

```bash
git add components/dashboards/midwife-dashboard.tsx
git commit -m "fix(midwife): remove embedded DoctorDashboard from midwife-dashboard"
```

---

## Task 19: Settings — Add `MidwifePreferences` to Settings Page

**Files:**
- Modify: `app/midwife/settings/page.tsx`

- [ ] **Step 1: Add inline MidwifePreferences card** — no new file needed (one-time component):

```tsx
"use client"

import { useState } from "react"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { HeartHandshake } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

function MidwifePreferences() {
  const [eddMethod, setEddMethod] = useState("lmp")
  const [eddAlertWeeks, setEddAlertWeeks] = useState("4")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ midwifeEddMethod: eddMethod, midwifeEddAlertWeeks: parseInt(eddAlertWeeks) }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Midwifery preferences saved")
    } catch {
      toast.error("Failed to save preferences")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-rose-600" /> Midwifery Preferences
        </CardTitle>
        <CardDescription className="text-xs">Configure defaults for your ANC and delivery workflows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="text-xs font-medium">EDD Calculation Method</Label>
          <Select value={eddMethod} onValueChange={setEddMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lmp">Last Menstrual Period (LMP)</SelectItem>
              <SelectItem value="ultrasound">Ultrasound Dating</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium">Upcoming Delivery Alert (weeks before EDD)</Label>
          <Input type="number" min={1} max={40} value={eddAlertWeeks} onChange={(e) => setEddAlertWeeks(e.target.value)} className="w-24" />
          <p className="text-xs text-muted-foreground">Show in Overview dashboard when EDD is within this many weeks.</p>
        </div>
        <Button
          size="sm"
          className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function MidwifeSettingsPage() {
  return (
    <SettingsLayout
      title="Midwifery Settings"
      description="Manage your midwifery practice settings and patient care preferences"
      icon={<HeartHandshake className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <MidwifePreferences />
            <PreferenceSettings />
          </>
        }
        secondary={
          <>
            <EmailSettings />
            <PasswordSettings />
            <NotificationSettings />
          </>
        }
      />
    </SettingsLayout>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/midwife/settings/page.tsx
git commit -m "feat(midwife): add MidwifePreferences card to settings page"
```

---

## Task 20: Build Verification

- [ ] **Step 1: Run the Next.js build**

```bash
cd c:/Users/ssego/Documents/dayspring-his/dayspring-his && npm run build
```

Expected: Build completes with no TypeScript errors and no missing module errors.

Common issues and fixes:
- `Module not found: @/lib/patient-context` — if `usePatients` / `searchPatients` hook doesn't exist, replace with a direct `fetch("/api/patients?search=…")` call inside the component and handle the results locally.
- `can(..., "medical", "delete") not a valid permission` — if the `can` function in `lib/security.ts` doesn't accept `"delete"`, use `can(auth.role, "medical", "update")` as the permission check for deletes.
- Any missing ShadCN components (`AlertDialog`, `Sheet`, `Select`) — run `npx shadcn@latest add alert-dialog sheet select` to install them.

- [ ] **Step 2: Fix any TypeScript errors** before committing.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(midwife): complete Midwife Portal overhaul — shell, CRUD, APIs, migration, settings"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Migration: `labor_delivery_records` + `postnatal_visits` with RLS → Task 1
- [x] DELETE on assessments/[id] → Task 2
- [x] patientId filter on obstetrics/visits → Task 3
- [x] Extended summary metrics → Task 4
- [x] Labor API (GET/POST/PATCH/DELETE) → Tasks 5 & 6
- [x] Postnatal API (GET/POST/PATCH/DELETE) → Task 7
- [x] MidwifeNotificationBell → Task 8
- [x] MidwifeOverview with 6 stat cards + quick actions → Task 9
- [x] MidwifeANCVisits full CRUD → Task 10
- [x] MidwifePatientRecords with history slide-over → Task 11
- [x] MidwifeLaborDelivery with baby details + postnatal nested → Task 12
- [x] MidwifeClinicalActions (Rx, lab, referral) → Task 13
- [x] MidwifeExports (3 datasets × 3 formats) → Task 14
- [x] MidwifeShell 6-tab orchestrator → Task 15
- [x] Page wired up → Task 16
- [x] /midwife/anc redirected → Task 17
- [x] DoctorDashboard embed removed → Task 18
- [x] MidwifePreferences in settings → Task 19
- [x] Build verification → Task 20

**Type consistency:** All components use `PatientOption` with `{ id, patientNumber, firstName, lastName }`. All API payloads use camelCase (patientId, admissionDate, etc.). All DB responses use snake_case (patient_id, admission_date, etc.).

**No placeholders:** All steps contain actual code. All form fields map to real DB columns. All API endpoints match the migration schema.
