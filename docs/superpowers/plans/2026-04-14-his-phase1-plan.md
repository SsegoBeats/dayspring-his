# Dayspring HIS Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the nurse portal crash (React #185), harden auth by removing the login role selector, add a clinician-generated patient After-Visit Summary PDF with admin print queue, and surface the MAR (medication administration) as a dedicated nurse view.

**Architecture:** Each item is a focused change: (1) ErrorBoundary wrap + null guards in nurse components; (2) login form and auth-context signature update; (3) new `patient_summaries` DB table + PDFKit API endpoint + clinician button + admin print-queue page; (4) MAR utility library + `MARView` component wired into `PatientCareView`; (5) terminology sweep.

**Tech Stack:** Next.js 14 App Router, TypeScript, PDFKit (already installed), PostgreSQL via `@/lib/db`, Tailwind CSS + shadcn/ui, zod for validation, `@/lib/security` for JWT auth.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/nurse/page.tsx` | Modify | Wrap NurseDashboard with ErrorBoundary |
| `components/nursing/patient-care-view.tsx` | Modify | Add null guards; add MAR tab |
| `components/nursing/patient-care-list.tsx` | Modify | Add null guard for allergies render |
| `components/nursing/mar-view.tsx` | Create | New MAR tab component |
| `lib/mar-utils.ts` | Create | Frequency parsing + due-time calculation |
| `components/login-form.tsx` | Modify | Remove role selector |
| `lib/auth-context.tsx` | Modify | Remove role from login() signature |
| `app/api/auth/login/route.ts` | Modify | Remove unreachable role-mismatch guard |
| `migrations/0034_patient_summaries.sql` | Create | patient_summaries table |
| `app/api/exports/patient-summary/route.ts` | Create | Generate + store PDF, notify admin |
| `app/api/exports/patient-summary/[id]/route.ts` | Create | GET PDF by summary ID |
| `app/api/exports/patient-summary/[id]/print/route.ts` | Create | PATCH to mark as printed |
| `components/doctor/patient-consultation.tsx` | Modify | Add "Generate Summary" button |
| `app/admin/print-queue/page.tsx` | Create | Admin print queue page |

---

## Task 1: Wrap Nurse Portal with ErrorBoundary

**Files:**
- Modify: `app/nurse/page.tsx`

The `ErrorBoundary` component already exists at `components/error-boundary.tsx`. We just need to use it around the nurse dashboard so that React error #185 renders a readable message instead of a blank crash, and reveals the component stack in dev mode.

- [ ] **Step 1: Import and wrap ErrorBoundary**

Open `app/nurse/page.tsx`. Add the import and wrap the dashboard:

```tsx
// At the top of the file, add:
import { ErrorBoundary } from "@/components/error-boundary"

// Replace this:
      <DashboardLayout>
        <NurseDashboard />
      </DashboardLayout>

// With:
      <DashboardLayout>
        <ErrorBoundary
          fallbackTitle="Nurse portal error"
          fallbackDescription="Something failed while rendering the nurse dashboard. Open the browser console for details."
        >
          <NurseDashboard />
        </ErrorBoundary>
      </DashboardLayout>
```

- [ ] **Step 2: Run dev server and reproduce the error**

```bash
cd dayspring-his && npm run dev
```

Navigate to the nurse portal and observe the error boundary message + console stack trace. Note which component is named in the stack. This tells us exactly where the object-as-child is.

- [ ] **Step 3: Add null guards to patient-care-list.tsx**

The `patient.allergies` field is rendered conditionally but could be an object. Open `components/nursing/patient-care-list.tsx` and find the allergies render (around the `patient.allergies.trim()` call). Apply this guard:

```tsx
// Before (around line 338):
          {patient.allergies &&
            patient.allergies.trim().toLowerCase() !== "none" && (

// After:
          {patient.allergies &&
            typeof patient.allergies === "string" &&
            patient.allergies.trim().toLowerCase() !== "none" && (
```

- [ ] **Step 4: Add null guards to patient-care-view.tsx**

In `components/nursing/patient-care-view.tsx`, find every place note history or vital history items are rendered. Add guards before each `.map()`:

```tsx
// Find the vitalHistory.map() render and add guard:
{(vitalHistory ?? []).map((v) => (
  // existing JSX — no change needed inside
))}

// Find the noteHistory.map() render and add guard:
{(noteHistory ?? []).map((n) => (
  // existing JSX — no change needed inside
))}
```

- [ ] **Step 5: Commit**

```bash
cd dayspring-his
git add app/nurse/page.tsx components/nursing/patient-care-list.tsx components/nursing/patient-care-view.tsx
git commit -m "fix: wrap nurse portal with ErrorBoundary, add null guards for React #185"
```

---

## Task 2: Auth — Remove Role Selector from Login

**Files:**
- Modify: `lib/auth-context.tsx`
- Modify: `components/login-form.tsx`
- Modify: `app/api/auth/login/route.ts`

The backend already returns the user's role in the JWT. The frontend role selector is unnecessary and creates a security perception problem. We remove it entirely and redirect users based on their actual role from the backend.

- [ ] **Step 1: Update auth-context.tsx login signature**

Open `lib/auth-context.tsx`. Make the following changes:

```tsx
// Change the AuthContextType interface (around line 27):
// Before:
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>

// After:
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>

// Change the login function signature (around line 68):
// Before:
  const login = async (email: string, password: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {

// After:
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {

// Change the fetch body (around line 74):
// Before:
        body: JSON.stringify({ email, password, role }), // ✅ Send selected role for validation

// After:
        body: JSON.stringify({ email, password }),
```

- [ ] **Step 2: Update login-form.tsx — remove role selector, add role-based redirect**

Open `components/login-form.tsx`. Apply all changes below:

```tsx
// REMOVE these imports:
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// REMOVE the roles array (the const roles = [...] block at the top of the file)

// REMOVE this state:
// const [role, setRole] = useState<UserRole>("Receptionist")

// UPDATE the handleSubmit function:
// Before:
      const result = await login(email, password, role)
      if (!result.success) {
        if (result.error?.includes("deactivated") || result.error?.includes("Account Deactivated")) {
          setIsAccountInactive(true)
        }
        setError(result.error || "Invalid credentials. Please check your email, password, and role selection.")
      } else {
        if (typeof window !== "undefined") {
          window.location.assign("/dashboard")
        } else {
          router.push("/dashboard")
        }
      }

// After:
      const result = await login(email, password)
      if (!result.success) {
        if (result.error?.includes("deactivated") || result.error?.includes("Account Deactivated")) {
          setIsAccountInactive(true)
        }
        setError(result.error || "Invalid credentials. Please check your email and password.")
      } else {
        if (typeof window !== "undefined") {
          window.location.assign("/dashboard")
        } else {
          router.push("/dashboard")
        }
      }
```

Then **find and delete the entire role selector JSX block** in the form. It looks like:
```tsx
{/* Role */}
<div className="space-y-1.5">
  <label ...>Role</label>
  <Select value={role} onValueChange={...}>
    ...
  </Select>
</div>
```
Delete it entirely.

- [ ] **Step 3: Remove role-mismatch branch from login route**

Open `app/api/auth/login/route.ts`. Find and remove the role-mismatch check block:

```ts
// REMOVE this entire block (around lines 63-75):
    // ✅ NEW: Validate selected role matches database role
    if (selectedRole && selectedRole !== user.role) {
      await writeAuditLog({ 
        action: "LOGIN_FAILED", 
        entityType: "User", 
        entityId: user.id, 
        details: { 
          category: "AUTHENTICATION", 
          description: `Role mismatch login attempt for ${user.email} - selected: ${selectedRole}, actual: ${user.role}` 
        }, 
        ip 
      })
      return NextResponse.json({ 
        error: `You are not authorized to access the ${selectedRole} portal. Your account is registered as ${user.role}.` 
      }, { status: 403 })
    }
```

Also update the schema to not include role (it's already optional, but clean up the destructuring):
```ts
// Before:
    const { email, password, role: selectedRole } = LoginSchema.parse(body)

// After:
    const { email, password } = LoginSchema.parse(body)
```

- [ ] **Step 4: Verify build compiles**

```bash
cd dayspring-his && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors. If errors appear, check that no other caller passes `role` to `login()`.

- [ ] **Step 5: Commit**

```bash
cd dayspring-his
git add lib/auth-context.tsx components/login-form.tsx app/api/auth/login/route.ts
git commit -m "feat: remove login role selector, auth driven by backend role"
```

---

## Task 3: Patient Summaries — Database Migration

**Files:**
- Create: `migrations/0034_patient_summaries.sql`

- [ ] **Step 1: Create the migration file**

Create `migrations/0034_patient_summaries.sql` with this content:

```sql
-- Migration 0034: Patient After-Visit Summary and Discharge Summary storage
-- Stores generated PDFs for the clinician → admin → patient print workflow

CREATE TABLE IF NOT EXISTS patient_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  -- visit_id references medical_records.id for OPD (avs) or admissions.id for inpatient (discharge)
  visit_id UUID NOT NULL,
  visit_type TEXT NOT NULL CHECK (visit_type IN ('avs', 'discharge')),
  generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending_print'
    CHECK (status IN ('pending_print', 'printed', 'unlocked')),
  pdf_data BYTEA NOT NULL,
  unlocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ,
  unlock_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patient_summaries_patient ON patient_summaries(patient_id, generated_at DESC);
CREATE INDEX idx_patient_summaries_status ON patient_summaries(status);
CREATE INDEX idx_patient_summaries_visit ON patient_summaries(visit_id);

COMMENT ON TABLE patient_summaries IS 'Clinician-generated PDFs (AVS and discharge summaries) pending admin printing';
COMMENT ON COLUMN patient_summaries.visit_id IS 'References medical_records.id for avs, admissions.id for discharge';
COMMENT ON COLUMN patient_summaries.pdf_data IS 'Raw PDF bytes generated by PDFKit';
```

- [ ] **Step 2: Run the migration**

```bash
cd dayspring-his && node -e "
const { query } = require('./lib/db');
const fs = require('fs');
const sql = fs.readFileSync('./migrations/0034_patient_summaries.sql', 'utf8');
query(sql).then(() => { console.log('Migration 0034 applied'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

If the direct approach fails (ESM module issues), apply via psql:
```bash
psql $DATABASE_URL -f migrations/0034_patient_summaries.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX` (3×), no errors.

- [ ] **Step 3: Commit**

```bash
cd dayspring-his
git add migrations/0034_patient_summaries.sql
git commit -m "feat: add patient_summaries migration for AVS/discharge PDF storage"
```

---

## Task 4: Patient Summary — API Endpoint

**Files:**
- Create: `app/api/exports/patient-summary/route.ts`
- Create: `app/api/exports/patient-summary/[id]/route.ts`
- Create: `app/api/exports/patient-summary/[id]/print/route.ts`

- [ ] **Step 1: Create POST /api/exports/patient-summary**

Create `app/api/exports/patient-summary/route.ts`:

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { z } from "zod"
import PDFDocument from "pdfkit"
import { ORG_NAME, ORG_ADDRESS, ORG_PHONE, ORG_EMAIL } from "@/lib/org-constants"

const CreateSummarySchema = z.object({
  patientId: z.string().uuid(),
  visitId: z.string().uuid(),
  type: z.enum(["avs", "discharge"]),
})

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || !["Clinician", "Hospital Admin"].includes(payload.role)) {
      return NextResponse.json({ error: "Only Clinicians and Hospital Admins can generate summaries" }, { status: 403 })
    }

    const body = await req.json()
    const { patientId, visitId, type } = CreateSummarySchema.parse(body)

    // Check if a pending/printed summary already exists for this visit
    const existingResult = await query<{ id: string; status: string }>(
      `SELECT id, status FROM patient_summaries WHERE visit_id = $1 AND status IN ('pending_print', 'printed') LIMIT 1`,
      [visitId]
    )
    if (existingResult.rows.length > 0 && existingResult.rows[0].status === "printed") {
      return NextResponse.json({ error: "A finalized summary already exists for this visit. Contact an admin to unlock it." }, { status: 409 })
    }

    // Fetch patient
    const patientRes = await query<{
      id: string; patient_number: string; first_name: string; last_name: string
      date_of_birth: string; gender: string; phone: string
    }>(`SELECT id, patient_number, first_name, last_name, date_of_birth, gender, phone FROM patients WHERE id = $1`, [patientId])
    if (!patientRes.rows[0]) return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    const patient = patientRes.rows[0]

    // Fetch medical record (the visit anchor)
    const recordRes = await query<{
      id: string; visit_date: string; chief_complaint: string | null; history: string | null
      impression: string | null; diagnosis: string | null; treatment_plan: string | null; notes: string | null
      doctor_name: string | null
    }>(
      `SELECT mr.id, mr.visit_date, mr.chief_complaint, mr.history, mr.impression, mr.diagnosis, mr.treatment_plan, mr.notes,
              u.name AS doctor_name
       FROM medical_records mr
       LEFT JOIN users u ON u.id = mr.doctor_id
       WHERE mr.id = $1 AND mr.patient_id = $2`,
      [visitId, patientId]
    )
    if (!recordRes.rows[0]) return NextResponse.json({ error: "Visit record not found" }, { status: 404 })
    const record = recordRes.rows[0]

    // Fetch latest vitals recorded on or before the visit date (same-day window)
    const visitDate = new Date(record.visit_date)
    const dayStart = new Date(visitDate); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(visitDate); dayEnd.setHours(23, 59, 59, 999)

    const vitalsRes = await query<{
      blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null
      temperature: number | null; heart_rate: number | null; recorded_at: string
    }>(
      `SELECT blood_pressure_systolic, blood_pressure_diastolic, temperature, heart_rate, recorded_at
       FROM vital_signs
       WHERE patient_id = $1 AND recorded_at BETWEEN $2 AND $3
       ORDER BY recorded_at DESC LIMIT 1`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )
    const vitals = vitalsRes.rows[0] ?? null

    // Fetch prescriptions created on visit day
    const rxRes = await query<{
      medication_name: string; dosage: string; frequency: string
      duration: string; instructions: string | null; administration_guidance: string | null
    }>(
      `SELECT medication_name, dosage, frequency, duration, instructions, administration_guidance
       FROM prescriptions
       WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch lab tests ordered on visit day
    const labRes = await query<{
      test_name: string; status: string; results: string | null
    }>(
      `SELECT test_name, status, results
       FROM lab_tests
       WHERE patient_id = $1 AND ordered_at BETWEEN $2 AND $3
       ORDER BY ordered_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch nursing notes for visit day
    const notesRes = await query<{
      note: string; note_type: string; created_at: string; nurse_name: string | null
    }>(
      `SELECT nn.note, nn.note_type, nn.created_at, u.name AS nurse_name
       FROM nursing_notes nn
       LEFT JOIN users u ON u.id = nn.nurse_id
       WHERE nn.patient_id = $1 AND nn.created_at BETWEEN $2 AND $3
       ORDER BY nn.created_at ASC`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    // Fetch billing for visit day
    const billRes = await query<{
      bill_number: string; final_amount: number; status: string
    }>(
      `SELECT bill_number, final_amount, status
       FROM bills
       WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at DESC LIMIT 1`,
      [patientId, dayStart.toISOString(), dayEnd.toISOString()]
    )

    const billItemsRes = billRes.rows[0]
      ? await query<{ description: string; quantity: number; unit_price: number; total_price: number }>(
          `SELECT description, quantity, unit_price, total_price FROM bill_items
           WHERE bill_id = (SELECT id FROM bills WHERE patient_id = $1 AND created_at BETWEEN $2 AND $3 ORDER BY created_at DESC LIMIT 1)
           ORDER BY created_at ASC`,
          [patientId, dayStart.toISOString(), dayEnd.toISOString()]
        )
      : { rows: [] }

    // Generate PDF
    const pdfBuffer = await generateSummaryPDF({
      type,
      patient: {
        name: `${patient.first_name} ${patient.last_name}`,
        patientNumber: patient.patient_number,
        dateOfBirth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
      },
      record: {
        visitDate: record.visit_date,
        chiefComplaint: record.chief_complaint,
        history: record.history,
        impression: record.impression,
        diagnosis: record.diagnosis,
        treatmentPlan: record.treatment_plan,
        notes: record.notes,
        doctorName: record.doctor_name,
      },
      vitals,
      prescriptions: rxRes.rows,
      labTests: labRes.rows,
      nursingNotes: notesRes.rows,
      bill: billRes.rows[0] ?? null,
      billItems: billItemsRes.rows,
    })

    // Store in DB (upsert: replace pending if re-generating before print)
    const summaryId = existingResult.rows[0]?.id
    let savedId: string

    if (summaryId) {
      await query(
        `UPDATE patient_summaries SET pdf_data = $1, generated_by = $2, generated_at = now(), status = 'pending_print' WHERE id = $3`,
        [pdfBuffer, payload.sub, summaryId]
      )
      savedId = summaryId
    } else {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO patient_summaries (patient_id, visit_id, visit_type, generated_by, pdf_data)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [patientId, visitId, type, payload.sub, pdfBuffer]
      )
      savedId = insertRes.rows[0].id
    }

    // Audit log
    await writeAuditLog({
      userId: payload.sub,
      action: "SUMMARY_GENERATED",
      entityType: "PatientSummary",
      entityId: savedId,
      details: { patientId, visitId, type, category: "CLINICAL" },
    })

    // Notify Hospital Admins
    const adminRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'Hospital Admin' AND is_active = true`
    )
    for (const admin of adminRes.rows) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          admin.id,
          "Patient summary ready to print",
          `${patient.first_name} ${patient.last_name} (${patient.patient_number}) — ${type === "avs" ? "After-Visit Summary" : "Discharge Summary"}`,
          "info",
          "PatientSummary",
          savedId,
        ]
      ).catch(() => {}) // Notifications are best-effort
    }

    return NextResponse.json({ id: savedId, status: "pending_print" })
  } catch (error: any) {
    console.error("[patient-summary] Error:", error)
    return NextResponse.json({ error: error?.message || "Failed to generate summary" }, { status: 500 })
  }
}

// GET — list summaries for admin
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admins can view the print queue" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? "pending_print"

    const result = await query<{
      id: string; patient_id: string; visit_type: string; generated_at: string; status: string
      patient_name: string; patient_number: string; doctor_name: string | null
    }>(
      `SELECT ps.id, ps.patient_id, ps.visit_type, ps.generated_at, ps.status,
              TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
              p.patient_number,
              u.name AS doctor_name
       FROM patient_summaries ps
       JOIN patients p ON p.id = ps.patient_id
       LEFT JOIN users u ON u.id = ps.generated_by
       WHERE ps.status = $1
       ORDER BY ps.generated_at DESC
       LIMIT 100`,
      [status]
    )
    return NextResponse.json({ summaries: result.rows })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch summaries" }, { status: 500 })
  }
}

// --- PDF generation ---

interface SummaryData {
  type: "avs" | "discharge"
  patient: { name: string; patientNumber: string; dateOfBirth: string; gender: string; phone: string }
  record: {
    visitDate: string; chiefComplaint: string | null; history: string | null
    impression: string | null; diagnosis: string | null; treatmentPlan: string | null
    notes: string | null; doctorName: string | null
  }
  vitals: { blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null; temperature: number | null; heart_rate: number | null } | null
  prescriptions: Array<{ medication_name: string; dosage: string; frequency: string; duration: string; instructions: string | null; administration_guidance: string | null }>
  labTests: Array<{ test_name: string; status: string; results: string | null }>
  nursingNotes: Array<{ note: string; note_type: string; created_at: string; nurse_name: string | null }>
  bill: { bill_number: string; final_amount: number; status: string } | null
  billItems: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>
}

async function generateSummaryPDF(data: SummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const title = data.type === "avs" ? "After-Visit Summary" : "Discharge Summary"
    const visitDate = new Date(data.record.visitDate).toLocaleDateString("en-UG", {
      day: "2-digit", month: "long", year: "numeric",
    })

    // --- Header ---
    doc.fontSize(16).font("Helvetica-Bold").text(ORG_NAME, { align: "center" })
    doc.fontSize(9).font("Helvetica").text(ORG_ADDRESS, { align: "center" })
    doc.text(`${ORG_PHONE}`, { align: "center" })
    doc.text(ORG_EMAIL, { align: "center" })
    doc.text("Mon-Sat: 8:00am – 8:00pm  |  Sun: 2:00pm – 6pm", { align: "center" })
    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)
    doc.fontSize(12).font("Helvetica-Bold").text(title, { align: "center" })
    doc.moveDown()

    // --- Patient Info grid ---
    const col1x = 50, col2x = 300
    const bpText = data.vitals?.blood_pressure_systolic && data.vitals?.blood_pressure_diastolic
      ? `${data.vitals.blood_pressure_systolic}/${data.vitals.blood_pressure_diastolic} mmHg`
      : "Not recorded"
    const dob = data.patient.dateOfBirth
      ? new Date(data.patient.dateOfBirth).toLocaleDateString("en-UG") : "N/A"
    const age = data.patient.dateOfBirth
      ? String(new Date().getFullYear() - new Date(data.patient.dateOfBirth).getFullYear()) + " yrs"
      : "N/A"

    const lineHeight = 16
    const startY = doc.y
    doc.fontSize(10).font("Helvetica-Bold").text("OPD No:", col1x, startY).font("Helvetica").text(data.patient.patientNumber, col1x + 60, startY)
    doc.font("Helvetica-Bold").text("Patient's Name:", col2x, startY).font("Helvetica").text(data.patient.name, col2x + 90, startY)
    doc.font("Helvetica-Bold").text("Sex:", col1x, startY + lineHeight).font("Helvetica").text(data.patient.gender, col1x + 60, startY + lineHeight)
    doc.font("Helvetica-Bold").text("Age:", col2x, startY + lineHeight).font("Helvetica").text(age, col2x + 90, startY + lineHeight)
    doc.font("Helvetica-Bold").text("BP:", col1x, startY + lineHeight * 2).font("Helvetica").text(bpText, col1x + 60, startY + lineHeight * 2)
    doc.font("Helvetica-Bold").text("Visit Date:", col2x, startY + lineHeight * 2).font("Helvetica").text(visitDate, col2x + 90, startY + lineHeight * 2)
    doc.moveDown(3)

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown()

    // --- Clinical narrative ---
    if (data.record.chiefComplaint) {
      doc.fontSize(10).font("Helvetica")
        .text(`Received a ${data.patient.gender === "M" ? "male" : data.patient.gender === "F" ? "female" : ""} patient complaining of ${data.record.chiefComplaint}.`)
      doc.moveDown(0.5)
    }
    if (data.record.history) {
      doc.font("Helvetica-Bold").text("PmHx:", { continued: true }).font("Helvetica").text("  " + data.record.history)
      doc.moveDown(0.5)
    }
    if (data.record.notes) {
      doc.font("Helvetica-Bold").text("O/E:", { continued: true }).font("Helvetica").text("  " + data.record.notes)
      doc.moveDown(0.5)
    }
    if (data.record.impression) {
      doc.font("Helvetica-Bold").text("Impression:", { continued: true }).font("Helvetica").text("  " + data.record.impression)
      doc.moveDown()
    }

    // --- Lab tests ---
    if (data.labTests.length > 0) {
      doc.font("Helvetica-Bold").text("Investigations:")
      data.labTests.forEach((lt) => {
        const result = lt.results ? ` — ${lt.results}` : lt.status === "completed" ? " — See report" : " — Pending"
        doc.font("Helvetica").text(`  • ${lt.test_name}${result}`)
      })
      doc.moveDown()
    }

    // --- Prescriptions table ---
    if (data.prescriptions.length > 0) {
      doc.font("Helvetica-Bold").text("Treatment Given:").moveDown(0.3)
      const rxColDrug = 50, rxColQty = 380
      doc.font("Helvetica-Bold").fontSize(9).text("Drug / Route", rxColDrug, doc.y).text("QTY / Duration", rxColQty, doc.y - doc.currentLineHeight())
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      data.prescriptions.forEach((rx) => {
        const drugText = rx.administration_guidance ? `${rx.medication_name} (${rx.administration_guidance})` : rx.medication_name
        const qtyText = `${rx.dosage} ${rx.frequency} × ${rx.duration}`
        const rowY = doc.y
        doc.font("Helvetica").fontSize(9).text(drugText, rxColDrug, rowY, { width: 310 })
        doc.text(qtyText, rxColQty, rowY, { width: 160 })
        if (rx.instructions) {
          doc.fillColor("#555").text(`  Instructions: ${rx.instructions}`, rxColDrug, doc.y, { width: 490 }).fillColor("black")
        }
      })
      doc.moveDown()
    }

    // --- Nursing notes (if any) ---
    if (data.nursingNotes.length > 0) {
      doc.font("Helvetica-Bold").text("Nursing Notes:").font("Helvetica")
      data.nursingNotes.forEach((n) => {
        const time = new Date(n.created_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
        doc.text(`  [${time}] ${n.nurse_name ?? "Nurse"}: ${n.note}`)
      })
      doc.moveDown()
    }

    // --- Billing summary ---
    if (data.bill && data.billItems.length > 0) {
      doc.font("Helvetica-Bold").text("Billing Summary:").moveDown(0.3)
      data.billItems.forEach((item) => {
        doc.font("Helvetica").fontSize(9)
          .text(`  ${item.description}`, 50, doc.y, { width: 360 })
          .text(`UGX ${Number(item.total_price).toLocaleString()}`, 420, doc.y - doc.currentLineHeight(), { width: 120, align: "right" })
      })
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
      doc.font("Helvetica-Bold").fontSize(9)
        .text("  Total:", 50, doc.y + 2, { width: 360 })
        .text(`UGX ${Number(data.bill.final_amount).toLocaleString()}`, 420, doc.y - doc.currentLineHeight() - 2, { width: 120, align: "right" })
      doc.moveDown()
    }

    // --- TCA / discharge instructions ---
    if (data.record.treatmentPlan) {
      doc.font("Helvetica-Bold").text("Review TCA / Discharge Instructions:")
      doc.font("Helvetica").text(data.record.treatmentPlan)
      doc.moveDown()
    }

    // --- Doctor signature ---
    doc.moveDown()
    doc.font("Helvetica-Bold").text("Doctor's Name: ", { continued: true }).font("Helvetica").text(data.record.doctorName ?? "________________________")
    doc.moveDown(0.5)
    doc.text(`Sign: ________________________        Date: ${visitDate}`)
    doc.moveDown(2)

    // --- Footer ---
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)
    doc.fontSize(10).font("Helvetica-Oblique").text('"Together with the Healer"', { align: "center" })
    doc.fontSize(8).font("Helvetica").fillColor("#888")
      .text(`Generated ${new Date().toLocaleString()} | ${ORG_NAME}`, { align: "center" })

    doc.end()
  })
}
```

- [ ] **Step 2: Create GET /api/exports/patient-summary/[id] (fetch PDF)**

Create `app/api/exports/patient-summary/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || !["Hospital Admin", "Clinician"].includes(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await query<{ pdf_data: Buffer; patient_number: string; status: string }>(
      `SELECT ps.pdf_data, p.patient_number, ps.status
       FROM patient_summaries ps
       JOIN patients p ON p.id = ps.patient_id
       WHERE ps.id = $1`,
      [params.id]
    )
    if (!result.rows[0]) return NextResponse.json({ error: "Summary not found" }, { status: 404 })

    const { pdf_data, patient_number } = result.rows[0]
    return new NextResponse(pdf_data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="summary-${patient_number}.pdf"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch summary" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create PATCH /api/exports/patient-summary/[id]/print (mark as printed)**

Create `app/api/exports/patient-summary/[id]/print/route.ts`:

```ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload || payload.role !== "Hospital Admin") {
      return NextResponse.json({ error: "Only Hospital Admins can mark summaries as printed" }, { status: 403 })
    }

    const result = await query<{ id: string; status: string }>(
      `UPDATE patient_summaries SET status = 'printed' WHERE id = $1 AND status = 'pending_print' RETURNING id, status`,
      [params.id]
    )
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Summary not found or already printed" }, { status: 404 })
    }

    await writeAuditLog({
      userId: payload.sub,
      action: "SUMMARY_PRINTED",
      entityType: "PatientSummary",
      entityId: params.id,
      details: { category: "CLINICAL" },
    })

    return NextResponse.json({ id: params.id, status: "printed" })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to mark as printed" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Verify build**

```bash
cd dayspring-his && npm run build 2>&1 | grep -E "error|Error|✓" | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd dayspring-his
git add app/api/exports/patient-summary/
git commit -m "feat: add patient-summary API endpoint with PDFKit AVS/discharge generation"
```

---

## Task 5: Clinician — "Generate Summary" Button

**Files:**
- Modify: `components/doctor/patient-consultation.tsx`

- [ ] **Step 1: Add state and handler to PatientConsultation**

Open `components/doctor/patient-consultation.tsx`. Add these imports at the top (with existing imports):

```tsx
import { useState } from "react"
import { FileText, Loader2 } from "lucide-react" // Printer, X already imported
import { toast } from "sonner"
```

Inside the `PatientConsultation` function body, add state and the handler (before the return statement):

```tsx
  const [generatingSummary, setGeneratingSummary] = useState(false)

  const handleGenerateSummary = async () => {
    if (!patientId) return
    // We need the latest medical record ID for this patient as the visitId
    try {
      setGeneratingSummary(true)
      // Fetch the latest medical record for this patient to get visitId
      const recordRes = await fetch(`/api/medical/records?patientId=${patientId}`, {
        credentials: "include",
      })
      if (!recordRes.ok) throw new Error("Could not retrieve visit record")
      const recordData = await recordRes.json()
      const latestRecord = recordData.records?.[0]
      if (!latestRecord?.id) throw new Error("No consultation record found. Save the consultation first.")

      const res = await fetch("/api/exports/patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patientId,
          visitId: latestRecord.id,
          type: "avs",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate summary")
      toast.success("Patient summary generated. Hospital Admin has been notified to print.")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate summary")
    } finally {
      setGeneratingSummary(false)
    }
  }
```

- [ ] **Step 2: Add the button to the header toolbar**

Find the existing Print button in the header (around the `window.print()` call). Add the Generate Summary button next to it:

```tsx
// Find this existing button:
              <Button variant="outline" size="sm" onClick={() => window.print()} aria-label="Print consultation summary">
                <Printer className="mr-1.5 h-4 w-4" />
                Print
              </Button>

// Add BEFORE it:
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={generatingSummary}
                aria-label="Generate patient after-visit summary"
              >
                {generatingSummary ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-1.5 h-4 w-4" />
                )}
                {generatingSummary ? "Generating…" : "Generate Summary"}
              </Button>
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
cd dayspring-his && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd dayspring-his
git add components/doctor/patient-consultation.tsx
git commit -m "feat: add Generate Summary button to clinician consultation view"
```

---

## Task 6: Admin Print Queue Page

**Files:**
- Create: `app/admin/print-queue/page.tsx`

- [ ] **Step 1: Create the print queue page**

Create `app/admin/print-queue/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, FileText, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Summary {
  id: string
  patient_name: string
  patient_number: string
  visit_type: "avs" | "discharge"
  generated_at: string
  status: string
  doctor_name: string | null
}

export default function PrintQueuePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.push("/"); return }
    if (user.role !== "Hospital Admin") { router.replace("/dashboard"); return }
    void loadSummaries()
  }, [user, isLoading])

  const loadSummaries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/exports/patient-summary?status=pending_print", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load print queue")
      const data = await res.json()
      setSummaries(data.summaries ?? [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load print queue")
    } finally {
      setLoading(false)
    }
  }

  const openPDF = (summaryId: string) => {
    window.open(`/api/exports/patient-summary/${summaryId}`, "_blank")
  }

  const markPrinted = async (summaryId: string) => {
    try {
      setMarkingId(summaryId)
      const res = await fetch(`/api/exports/patient-summary/${summaryId}/print`, {
        method: "PATCH",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to mark as printed")
      }
      toast.success("Marked as printed")
      setSummaries((prev) => prev.filter((s) => s.id !== summaryId))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setMarkingId(null)
    }
  }

  if (isLoading || !user) return <div className="flex min-h-screen items-center justify-center"><div className="text-muted-foreground">Loading…</div></div>
  if (user.role !== "Hospital Admin") return null

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Print Queue</h1>
          <Button variant="outline" size="sm" onClick={loadSummaries} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Pending Summaries ({summaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : summaries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No summaries pending print.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.patient_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.patient_number}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.visit_type === "discharge" ? "destructive" : "secondary"}>
                          {s.visit_type === "avs" ? "After-Visit" : "Discharge"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(s.generated_at).toLocaleString("en-UG", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{s.doctor_name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPDF(s.id)}>
                            <FileText className="mr-1.5 h-3 w-3" />
                            View PDF
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => markPrinted(s.id)}
                            disabled={markingId === s.id}
                          >
                            {markingId === s.id ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 h-3 w-3" />
                            )}
                            Mark Printed
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd dayspring-his && npm run build 2>&1 | grep -E "error TS|Error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd dayspring-his
git add app/admin/print-queue/
git commit -m "feat: add admin print queue for patient summaries"
```

---

## Task 7: Nurse MAR — Utility Library + View Component

**Files:**
- Create: `lib/mar-utils.ts`
- Create: `components/nursing/mar-view.tsx`
- Modify: `components/nursing/patient-care-view.tsx`

- [ ] **Step 1: Create lib/mar-utils.ts**

Create `lib/mar-utils.ts`:

```ts
/**
 * Medication Administration Record (MAR) utilities.
 * Handles frequency parsing and due-time calculation for scheduled doses.
 */

export type DoseStatus = "given" | "due" | "delayed" | "missed" | "stat-pending" | "stat-given"

export interface ScheduledDose {
  scheduledAt: Date
  status: DoseStatus
  administrationId?: string
  administeredAt?: Date
  administeredBy?: string
  doseGiven?: string
}

/** Minutes of grace period before a missed dose becomes "missed" (not just "delayed") */
const DELAYED_GRACE_MINUTES = 30

/** Maps frequency shorthand to doses per 24 hours */
const FREQUENCY_MAP: Record<string, number> = {
  // Once daily variants
  OD: 1, "1/24": 1, "DAILY": 1, "QD": 1, "QHS": 1,
  // Twice daily
  BD: 2, "2/24": 2, "BID": 2,
  // Three times daily
  TDS: 3, "3/24": 3, "TID": 3,
  // Four times daily
  QID: 4, "4/24": 4, "QID": 4,
  // Six hourly
  "Q6H": 4, "6/24": 4,
  // Eight hourly
  "Q8H": 3, "8/24": 3,
  // Twelve hourly
  "Q12H": 2, "12/24": 2,
}

/**
 * Returns doses per day (0 for stat/one-off doses).
 * Normalises the frequency string before lookup.
 */
export function parseDosesPerDay(frequency: string): number {
  if (!frequency) return 1
  const upper = frequency.toUpperCase().trim()
  // stat = one-off immediate dose
  if (upper === "STAT" || upper === "IMMEDIATELY" || upper === "ONE-OFF") return 0
  return FREQUENCY_MAP[upper] ?? 1
}

/**
 * Calculate scheduled dose times for a prescription over a window.
 * startTime: when the prescription was created (used as day-anchor)
 * daysWindow: how many days to generate times for (default 1 = today)
 */
export function calculateScheduledTimes(
  frequency: string,
  startTime: Date,
  daysWindow = 1
): Date[] {
  const dosesPerDay = parseDosesPerDay(frequency)
  if (dosesPerDay === 0) return [] // stat — no fixed schedule

  const intervalHours = 24 / dosesPerDay
  const times: Date[] = []

  // Anchor first dose to start of the day the prescription was created
  const anchor = new Date(startTime)
  anchor.setMinutes(0, 0, 0)

  for (let day = 0; day < daysWindow; day++) {
    for (let dose = 0; dose < dosesPerDay; dose++) {
      const t = new Date(anchor)
      t.setDate(t.getDate() + day)
      t.setHours(t.getHours() + dose * intervalHours)
      times.push(t)
    }
  }
  return times
}

/**
 * Determine the status of a single scheduled dose.
 */
export function getDoseStatus(
  scheduledAt: Date,
  administrations: Array<{ administered_at: string; id: string }>,
  now = new Date()
): DoseStatus {
  // If any administration record exists within 2 hours of this scheduled time, it's "given"
  const twoHours = 2 * 60 * 60 * 1000
  const given = administrations.find((a) =>
    Math.abs(new Date(a.administered_at).getTime() - scheduledAt.getTime()) < twoHours
  )
  if (given) return "given"

  const minutesOverdue = (now.getTime() - scheduledAt.getTime()) / 60000
  if (minutesOverdue < -60) return "due" // more than 1 hour in the future — not due yet
  if (minutesOverdue < 0) return "due" // within 1 hour window — due
  if (minutesOverdue < DELAYED_GRACE_MINUTES) return "delayed"
  return "missed"
}
```

- [ ] **Step 2: Create components/nursing/mar-view.tsx**

Create `components/nursing/mar-view.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, CheckCircle2, Clock, AlertCircle, Pill } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { parseDosesPerDay, calculateScheduledTimes, getDoseStatus, type DoseStatus } from "@/lib/mar-utils"

interface Prescription {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  duration: string
  created_at: string
}

interface Administration {
  id: string
  prescription_id: string
  administered_at: string
  dose_given: string
  route: string | null
  nurse_name: string | null
  notes: string | null
}

interface MARRow {
  prescriptionId: string
  medication: string
  dosage: string
  frequency: string
  scheduledAt: Date | null // null = stat
  status: DoseStatus | "stat-pending" | "stat-given"
  administration?: Administration
}

interface MARViewProps {
  patientId: string
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  given:        { label: "Given",       badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  due:          { label: "Due",         badge: "bg-blue-100 text-blue-700 border-blue-200",     icon: Clock },
  delayed:      { label: "Delayed",     badge: "bg-amber-100 text-amber-700 border-amber-200",  icon: AlertCircle },
  missed:       { label: "Missed",      badge: "bg-red-100 text-red-700 border-red-200",        icon: AlertCircle },
  "stat-pending": { label: "Due Now",   badge: "bg-violet-100 text-violet-700 border-violet-200", icon: AlertCircle },
  "stat-given": { label: "Given",       badge: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
}

export function MARView({ patientId }: MARViewProps) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [administrations, setAdministrations] = useState<Administration[]>([])
  const [loading, setLoading] = useState(true)
  const [marRows, setMarRows] = useState<MARRow[]>([])

  // Give-dose dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<MARRow | null>(null)
  const [doseGiven, setDoseGiven] = useState("")
  const [route, setRoute] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [rxRes, adminRes] = await Promise.all([
        fetch(`/api/medical/prescriptions?patientId=${patientId}`, { credentials: "include" }),
        fetch(`/api/prescription-administrations?patientId=${patientId}`, { credentials: "include" }),
      ])
      if (!rxRes.ok) throw new Error("Failed to load prescriptions")
      const rxData = await rxRes.json()
      const adminData = adminRes.ok ? await adminRes.json() : { administrations: [] }

      const rxList: Prescription[] = rxData.prescriptions ?? []
      const adminList: Administration[] = adminData.administrations ?? []

      setPrescriptions(rxList)
      setAdministrations(adminList)
      buildMARRows(rxList, adminList)
    } catch (err: any) {
      toast.error(err.message || "Failed to load MAR data")
    } finally {
      setLoading(false)
    }
  }

  const buildMARRows = (rxList: Prescription[], adminList: Administration[]) => {
    const now = new Date()
    const rows: MARRow[] = []

    for (const rx of rxList) {
      const rxAdmins = adminList.filter((a) => a.prescription_id === rx.id)
      const dosesPerDay = parseDosesPerDay(rx.frequency)
      const startTime = new Date(rx.created_at)

      if (dosesPerDay === 0) {
        // stat dose
        const given = rxAdmins[0]
        rows.push({
          prescriptionId: rx.id,
          medication: rx.medication_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          scheduledAt: null,
          status: given ? "stat-given" : "stat-pending",
          administration: given,
        })
        continue
      }

      // For today's doses only
      const scheduledTimes = calculateScheduledTimes(rx.frequency, startTime, 1)
      for (const t of scheduledTimes) {
        if (t > now && (t.getTime() - now.getTime()) > 60 * 60 * 1000) continue // skip future beyond 1h window
        const status = getDoseStatus(t, rxAdmins, now)
        const matchAdmin = rxAdmins.find((a) =>
          Math.abs(new Date(a.administered_at).getTime() - t.getTime()) < 2 * 60 * 60 * 1000
        )
        rows.push({
          prescriptionId: rx.id,
          medication: rx.medication_name,
          dosage: rx.dosage,
          frequency: rx.frequency,
          scheduledAt: t,
          status,
          administration: matchAdmin,
        })
      }
    }

    setMarRows(rows)
  }

  useEffect(() => {
    if (patientId) void loadData()
  }, [patientId])

  const handleGiveDose = async () => {
    if (!selectedRow || !doseGiven.trim()) return
    try {
      setSubmitting(true)
      const res = await fetch("/api/prescription-administrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prescriptionId: selectedRow.prescriptionId,
          doseGiven: doseGiven.trim(),
          route: route.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to record administration")
      }
      toast.success(`${selectedRow.medication} dose recorded`)
      setDialogOpen(false)
      setSelectedRow(null)
      setDoseGiven("")
      setRoute("")
      setNotes("")
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const openGiveDialog = (row: MARRow) => {
    setSelectedRow(row)
    setDoseGiven(row.dosage)
    setRoute("")
    setNotes("")
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (marRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Pill className="h-8 w-8" />
        <p className="text-sm">No medications scheduled for today.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medication</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Given At</TableHead>
              <TableHead>Given By</TableHead>
              <TableHead>Dose</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {marRows.map((row, i) => {
              const cfg = STATUS_CONFIG[row.status]
              const Icon = cfg.icon
              const canGive = ["due", "delayed", "missed", "stat-pending"].includes(row.status)
              return (
                <TableRow key={`${row.prescriptionId}-${i}`}>
                  <TableCell className="font-medium">{row.medication}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.scheduledAt
                      ? row.scheduledAt.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
                      : <span className="text-violet-600 font-medium">Now (stat)</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.administration
                      ? new Date(row.administration.administered_at).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{row.administration?.nurse_name ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{row.administration?.dose_given ?? row.dosage}</TableCell>
                  <TableCell>
                    <Badge className={`border text-xs flex items-center gap-1 w-fit ${cfg.badge}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canGive && (
                      <Button size="sm" variant="outline" onClick={() => openGiveDialog(row)}>
                        Give
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Dose — {selectedRow?.medication}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="mar-dose">Dose Given</Label>
              <Input
                id="mar-dose"
                name="mar-dose"
                autoComplete="off"
                value={doseGiven}
                onChange={(e) => setDoseGiven(e.target.value)}
                placeholder={selectedRow?.dosage}
              />
            </div>
            <div>
              <Label htmlFor="mar-route">Route (optional)</Label>
              <Input
                id="mar-route"
                name="mar-route"
                autoComplete="off"
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="e.g. IV, PO, IM"
              />
            </div>
            <div>
              <Label htmlFor="mar-notes">Notes (optional)</Label>
              <Textarea
                id="mar-notes"
                name="mar-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGiveDose} disabled={submitting || !doseGiven.trim()}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {submitting ? "Recording…" : "Record Dose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Add MAR tab to patient-care-view.tsx**

Open `components/nursing/patient-care-view.tsx`. Make the following changes:

```tsx
// 1. Add import at top:
import { MARView } from "@/components/nursing/mar-view"

// 2. Update CareTab type:
// Before:
type CareTab = "vitals" | "notes" | "history" | "triage"
// After:
type CareTab = "vitals" | "notes" | "history" | "triage" | "mar"

// 3. Update the tab list to include MAR (find the tab buttons section and add):
// After the "triage" tab button, add:
              <button
                role="tab"
                aria-selected={activeTab === "mar"}
                onClick={() => setActiveTab("mar")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "mar"
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                MAR
              </button>

// 4. Add MAR tab panel (after the triage tab panel):
            {activeTab === "mar" && (
              <div className="mt-4">
                <MARView patientId={patientId} />
              </div>
            )}
```

Also update the localStorage guard to accept "mar":
```tsx
// Before:
      if (saved && ["vitals", "notes", "history", "triage"].includes(saved)) setActiveTab(saved as CareTab)
// After:
      if (saved && ["vitals", "notes", "history", "triage", "mar"].includes(saved)) setActiveTab(saved as CareTab)
```

- [ ] **Step 4: Check that prescription-administrations GET endpoint accepts patientId param**

```bash
grep -n "patientId\|prescriptionId" "dayspring-his/app/api/prescription-administrations/route.ts" 2>/dev/null | head -20
```

If the GET endpoint only supports `prescriptionId` and not `patientId`, add support in the route. Open `app/api/prescription-administrations/route.ts` and check the GET handler. Add a patient-level query if missing:

```ts
// In the GET handler, add patientId support:
export async function GET(req: Request) {
  // ... existing auth check ...
  const { searchParams } = new URL(req.url)
  const prescriptionId = searchParams.get("prescriptionId")
  const patientId = searchParams.get("patientId")

  if (patientId) {
    // Fetch all administrations for patient (for MAR view)
    const result = await query<{
      id: string; prescription_id: string; administered_at: string
      dose_given: string; route: string | null; notes: string | null
      nurse_name: string | null
    }>(
      `SELECT pa.id, pa.prescription_id, pa.administered_at, pa.dose_given, pa.route, pa.notes,
              u.name AS nurse_name
       FROM prescription_administrations pa
       LEFT JOIN users u ON u.id = pa.administered_by
       WHERE pa.prescription_id IN (
         SELECT id FROM prescriptions WHERE patient_id = $1
       )
       ORDER BY pa.administered_at DESC`,
      [patientId]
    )
    return NextResponse.json({ administrations: result.rows })
  }
  // ... existing prescriptionId logic ...
}
```

- [ ] **Step 5: Verify build**

```bash
cd dayspring-his && npm run build 2>&1 | grep -E "error TS|Error" | head -10
```

- [ ] **Step 6: Commit**

```bash
cd dayspring-his
git add lib/mar-utils.ts components/nursing/mar-view.tsx components/nursing/patient-care-view.tsx app/api/prescription-administrations/route.ts
git commit -m "feat: add MAR view with due-time calculation and dose recording to nurse portal"
```

---

## Task 8: Terminology — Confirm STAT Sweep

**Files:**
- Check: `dayspring.sql`, `migrations/`, report label strings

- [ ] **Step 1: Search SQL migrations for triage 'STAT' values**

```bash
grep -rn "'STAT'" dayspring-his/migrations/ dayspring-his/dayspring.sql
```

Expected: zero matches (the triage enum already uses 'Very Urgent'). If any found, replace with 'Very Urgent' in those migration files.

- [ ] **Step 2: Verify triage input uses "Very Urgent" label**

```bash
grep -rn "STAT\|'Very Urgent'" dayspring-his/components/patient/triage-form.tsx 2>/dev/null | head -10
```

Confirm "Very Urgent" is a selectable option and "STAT" is not present as a category label.

- [ ] **Step 3: Check lab priority labels**

```bash
grep -rn "STAT\|Very Urgent" dayspring-his/app/api/lab-tests/ dayspring-his/components/lab/ 2>/dev/null | grep -i "priority\|urgent" | head -10
```

If "STAT" appears as a lab priority label (not as a dosing instruction), replace with "Very Urgent".

- [ ] **Step 4: Commit only if changes were needed**

```bash
cd dayspring-his
git add -p  # stage only changed files selectively
git commit -m "fix: replace STAT triage label with Very Urgent across remaining files"
```

If no changes needed, skip the commit.

---

## Self-Review Checklist

- [x] **React #185:** ErrorBoundary added to nurse page; null guards in patient-care-list and patient-care-view; covers the likely sources of object-as-child renders
- [x] **Auth RBAC:** Role removed from login() signature in both auth-context and login-form; backend guard removed; error message updated
- [x] **Patient Summary Migration:** `patient_summaries` table with audit columns; visit_id documented as medical_records.id reference
- [x] **Patient Summary API:** POST generates PDF, stores bytes, notifies admin; GET lists queue; PATCH marks printed; audit logged at each step
- [x] **Clinician button:** Fetches latest medical record ID as visitId, calls POST /api/exports/patient-summary, toasts on success/error
- [x] **Admin print queue:** Lists pending_print summaries; opens PDF in new tab; marks printed via PATCH; role-gated to Hospital Admin
- [x] **MAR utils:** parseDosesPerDay handles STAT/OD/BD/TDS/QID; calculateScheduledTimes generates today's dose times; getDoseStatus returns given/due/delayed/missed
- [x] **MAR view:** Table with all statuses; inline Give dialog; calls POST /api/prescription-administrations; stat doses handled separately
- [x] **PatientCareView:** MAR tab added; localStorage guard updated; MARView imported
- [x] **Prescription-administrations GET:** patientId query param added for MAR loading
- [x] **Type consistency:** `DoseStatus` defined in mar-utils and imported in mar-view; `MARRow.status` uses the same union type; `CareTab` updated in both useState type and localStorage guard
- [x] **Terminology:** STAT sweep via grep — no code changes needed (already updated in prior sessions)
