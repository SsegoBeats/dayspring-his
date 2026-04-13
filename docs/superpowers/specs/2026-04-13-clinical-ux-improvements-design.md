# Clinical UX Improvements — Design Spec
**Date:** 2026-04-13  
**Scope:** Dayspring HIS — 8 bugs + console warning sweep  

---

## 1. Navbar missing on some portals

**Affected pages:**
- `/app/clinician/page.tsx` — renders in a bare JSX fragment `<>` instead of inside `DashboardLayout`
- `/app/appointments/book/page.tsx` — no layout wrapper
- `/app/appointments/calendar/page.tsx` — no layout wrapper
- `/app/clinician/schedules/page.tsx` — no layout wrapper

**Fix:** Wrap each of the above in `<DashboardLayout>`. For `clinician/page.tsx`, remove the outer `<>` fragment and replace it with `<DashboardLayout>`.

---

## 2. Mobile responsiveness

**Affected file:** `components/dashboard-layout.tsx`

**Problems:**
- Header is a single-row flex with 4–5 buttons; overflows on small screens
- `px-6` padding is too wide on mobile

**Fix (no new dependencies):**
- Change `px-6` → `px-3 md:px-6` on the header inner div
- The user/role text block: hide on `xs`, show on `sm:`
- Buttons (Midwifery Portal, Schedules, Settings, Logout): wrap in a `flex flex-wrap gap-2` container so they reflow instead of overflow
- `h-16` header: change to `min-h-16` so it can grow on very small screens

---

## 3. Baby age support in patient registration

**Affected files:**
- `app/api/migrate/route.ts` (add migration SQL)
- `components/patient/patient-registration.tsx`
- `app/api/patients/route.ts`
- `lib/patient-context.tsx` (Patient type)

**DB migration (idempotent):**
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

**Form change:** Replace the single "Age (years)" input with a two-control row:
- Number input: `ageValue` (replaces `ageYears`)
- Unit selector: `ageUnit` — options: Years / Months / Days

**Validation:**
| Unit | Min | Max |
|------|-----|-----|
| years | 0 | 130 |
| months | 0 | 11 |
| days | 0 | 30 |

**API:** Accept `ageValue` (integer) + `ageUnit` (string). Store `age_years` as the existing column for backwards-compat (set to `null` when unit is not years), and `age_unit` as the new column.

**Display:** Patient card shows "2 months" or "5 days" or "34 years".

---

## 4. Clinical notes field restructure

**Affected files:**
- `app/api/migrate/route.ts` (add migration SQL)
- `lib/medical-context.tsx` (MedicalRecord type)
- `components/doctor/consultation-tabs/consultation-tab.tsx`
- `app/api/medical/records/route.ts`

**DB migration (idempotent):**
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

**Field order in consultation form:**
1. Complaints (was: Symptoms) — `chief_complaint`
2. Patient History — `history` (new)
3. Impression / Clinical Suspicion — `impression` (new)
4. Treatment Plan — `treatment_plan`
5. Diagnosis — `diagnosis`

**Validation:** At least one of Complaints, Impression, or Diagnosis must be filled (replacing the old "symptoms or diagnosis" check).

**API:** POST body adds `history` and `impression` fields. GET response maps them from new DB columns.

---

## 5. Specimen multi-select

**Affected file:** `components/doctor/order-lab-test.tsx`

**Current:** Single `<Select>` with `specimenType` string state.

**Fix:** Replace with a checkbox group. Use the same list of specimen types (Blood, Serum, Plasma, Urine, Stool, Sputum + add Swab, CSF). State changes from `string` to `string[]`. Serialise as comma-separated string before sending to the API (the `specimen_type TEXT` column in DB stays unchanged).

**UI:** A compact wrap of `<Checkbox>` + label pairs inside the existing form grid. Selected values shown as pills above the checkbox group (similar to the existing test-selection badges).

---

## 6. Lab tech parameter inputs

**Affected file:** `components/dashboards/lab-tech-dashboard.tsx`

**Current situation:** `lab-test-details.tsx` already renders structured `resultJson` parameter inputs. But in the lab-tech dashboard test queue, tests are shown as a table row without a clear way to open the details form.

**Fix:** Make each test row in the lab-tech queue table clickable (or add an explicit "Enter Results" button per row) that opens the existing `LabTestDetails` dialog with that test's ID. No new component needed — the dialog is already built.

---

## 7. Mark reviewed 400 error

**Affected file:** `components/doctor/consultation-tabs/labs-tab.tsx`

**Root cause:** Line 56 sends `{ status: "Reviewed" }` but the PATCH endpoint's review path expects `{ reviewed: true }`.

**Fix (one line):**
```diff
- body: JSON.stringify({ status: "Reviewed" }),
+ body: JSON.stringify({ reviewed: true }),
```

---

## 8. Consultation save fire-and-forget

**Affected files:**
- `lib/medical-context.tsx`
- `components/doctor/consultation-tabs/consultation-tab.tsx`

**Root cause:** `addMedicalRecord` is fire-and-forget. `doSave` calls `toast.success(...)` synchronously before the API call completes. Any API failure is silently caught.

**Fix:**
1. `addMedicalRecord` returns `Promise<boolean>` (true = saved, false = failed)
2. `doSave` becomes `async`, awaits `addMedicalRecord`, and shows:
   - `toast.success("Consultation saved.")` on true
   - `toast.error("Failed to save consultation. Please try again.")` on false
3. Form is cleared only on success (not before the API call)

---

## Console warnings — form field accessibility

Continue the sweep started in the previous session. New fields added by this spec (History, Impression, ageValue, ageUnit) must include `id`, `name`, and `autoComplete="off"` from the start. Any remaining gaps found during implementation are fixed inline.

---

## DB migrations — delivery

All SQL above is appended to the existing `app/api/migrate/route.ts` migration script (which already handles idempotent `IF NOT EXISTS` patterns). No separate migration file needed.

---

## Out of scope

- `/doctor-schedules` page layout (separate task)
- Print pages (`lab-tests/print`, `patient-receipt`) — intentionally no nav (print views)
- Receptionist ANC sub-portal — separate component
