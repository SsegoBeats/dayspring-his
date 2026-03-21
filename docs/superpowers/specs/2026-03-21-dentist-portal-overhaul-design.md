# Dentist Portal Overhaul — Design Spec
**Date:** 2026-03-21
**Status:** Approved
**Scope:** Full audit, bug fixes, and redesign of the Dentist portal

---

## 1. Overview

The Dentist portal (`/dentist`) and the Dental tab in patient consultation (`components/doctor/consultation-tabs/dental-tab.tsx`) are being overhauled. The goals are:

1. Fix all identified bugs
2. Introduce sub-navigation tabs within `/dentist`
3. Redesign with an aqua/cyan + pearl white visual identity
4. Add an interactive FDI 32-tooth chart
5. Add a dedicated clinician-grade notification bell
6. Deliver a 6-stat dashboard overview

---

## 2. Bugs to Fix

### B1 — `toothNotes` never saved on CREATE
**File:** `app/api/dental/records/route.ts` + `components/doctor/consultation-tabs/dental-tab.tsx`
**Problem:** The client sends `toothNotes` as a top-level payload field, but `CreateDentalSchema` has no `toothNotes` field — only `toothChart` (a JSONB record) and `notes`. The value is silently dropped; tooth chart notes are never persisted.
**Fix:** Add `toothNotes: z.string().optional().nullable()` to `CreateDentalSchema`. In the insert query, map it to `tooth_chart: { notes: toothNotes }` when `toothNotes` is present.

### B2 — `toothNotes` never saved on PATCH
**File:** `app/api/dental/records/[id]/route.ts`
**Problem:** Same mismatch — `UpdateDentalSchema` has no `toothNotes` field.
**Fix:** Add `toothNotes` to `UpdateDentalSchema` and map it to `tooth_chart->>'notes'` in the UPDATE statement.

### B3 — DELETE uses wrong permission check
**File:** `app/api/dental/records/[id]/route.ts` line 81
**Problem:** `can(auth.role, "medical", "update")` is used instead of `can(auth.role, "medical", "delete")`. A user without delete permission can delete records as long as they have update.
**Fix:** Change to `can(auth.role, "medical", "delete")`.

### B4 — Export cursor uses non-unique `visit_date`
**File:** `lib/exports/datasets/dental.ts` line 64
**Problem:** Cursor pagination uses `visit_date` as the cursor key. Multiple records can share the same `visit_date`, causing records to be silently skipped on page boundaries.
**Fix:** Use `dr.id` as the cursor key. Change the ORDER to `ORDER BY dr.id ASC` and update `nextCursor` to `{ after: rows[rows.length - 1].id }`.

### B5 — `patientsCount` fetched but never displayed
**File:** `components/dashboards/dentist-dashboard.tsx`
**Problem:** The summary API returns `patientsCount` but the dashboard only shows `visitsCount`.
**Fix:** Display `patientsCount` in the new 6-stat overview card grid.

---

## 3. Architecture

### 3.1 New directory: `components/dentist/`

```
components/dentist/
  dentist-shell.tsx               ← Sub-navigation tab router
  dentist-overview.tsx            ← Overview tab: 6 stats + queue + recent records
  dentist-patient-records.tsx     ← Patient Records tab: searchable record history
  dentist-schedule.tsx            ← Schedule tab: today's appointments + queue
  dentist-exports.tsx             ← Exports tab: date-range CSV/XLSX/PDF
  dentist-notification-bell.tsx   ← Polling notification bell
  fdi-tooth-chart.tsx             ← Interactive 32-tooth FDI chart component
```

### 3.2 Modified files

| File | Change |
|---|---|
| `components/dashboards/dentist-dashboard.tsx` | Becomes thin wrapper importing `DentistShell` |
| `components/doctor/consultation-tabs/dental-tab.tsx` | Full redesign: FDI chart + improved form + new styles |
| `app/api/dental/records/route.ts` | Fix B1 (`toothNotes` in CreateDentalSchema) |
| `app/api/dental/records/[id]/route.ts` | Fix B2 (`toothNotes` in UpdateDentalSchema) + Fix B3 (DELETE permission) |
| `lib/exports/datasets/dental.ts` | Fix B4 (cursor uses `id`) |

### 3.3 New API route

**`GET /api/dental/stats`**
Returns all 6 stat card values in a single request. Reduces dashboard to one fetch instead of multiple.

Response shape:
```ts
{
  visitsToday: number         // dental_records where visit_date = today, dentist_id = me
  patientsThisMonth: number   // distinct patients in current calendar month
  proceduresThisWeek: number  // records with non-null procedure_performed this week
  pendingFollowUps: number    // appointments with status = 'pending' in dental dept
  pendingLabResults: number   // lab_tests where requested_by = me AND status != 'completed'
  pendingPreAuths: number     // insurance_authorizations where status = 'pending' for dental category
}
```

---

## 4. UI & Color System

### Palette

| Token | Tailwind class | Usage |
|---|---|---|
| Primary | `cyan-600` | Active tabs, primary buttons, icons |
| Primary light | `cyan-50` | Card backgrounds, row hovers |
| Primary border | `cyan-100` | Card borders, dividers |
| Accent | `teal-500` | Secondary badges, accents |
| Pearl background | `slate-50` | Page/panel background |
| Text primary | `slate-800` | Headings |
| Text secondary | `slate-500` | Labels, captions |
| Danger | `rose-500` | Delete actions |

### Reusable class patterns

- **Card:** `rounded-2xl border border-cyan-100 bg-white shadow-sm shadow-cyan-100/50`
- **Stat card gradient:** `bg-gradient-to-br from-cyan-50 via-white to-teal-50/40`
- **Icon container:** `rounded-xl bg-cyan-50 p-2 text-cyan-600`
- **Active tab:** `border-b-2 border-cyan-600 text-cyan-700 font-medium`
- **Section label:** `text-xs font-semibold uppercase tracking-widest text-cyan-600`

---

## 5. Tab-by-Tab Feature Breakdown

### 5.1 Overview Tab (`DentistOverview`)

**6-stat card grid (2 rows × 3 columns on desktop, 2×2 on tablet, 1 col on mobile):**

| Card | Icon | Metric |
|---|---|---|
| Today's Visits | `Stethoscope` | `visitsToday` |
| Patients This Month | `Users` | `patientsThisMonth` |
| Procedures This Week | `Activity` | `proceduresThisWeek` |
| Pending Follow-ups | `Clock` | `pendingFollowUps` |
| Pending Lab Results | `FlaskConical` | `pendingLabResults` |
| Insurance Pre-auths | `ShieldCheck` | `pendingPreAuths` |

Below the stat grid: **Recent Dental Records** list (last 8, showing patient name + diagnosis + procedure + date, clickable rows that deep-link to patient consultation dental tab).

### 5.2 Patient Records Tab (`DentistPatientRecords`)

- Search input (patient name or number)
- Filtered table of all dental records accessible to this dentist
- Columns: Date · Patient · Diagnosis · Procedure · Dentist
- Row click → opens `PatientConsultation` with `initialTab="dental"` pre-selected
- Pagination (20 per page)
- API: `GET /api/dental/records` (existing, supports patientId filter; will add a "all mine" mode)

### 5.3 Schedule Tab (`DentistSchedule`)

- Embeds the existing `DoctorDashboard` patient queue with `showDentalQueueFilter` prop (same as current)
- Adds a "Today's Appointments" header card showing count and next patient
- Minimal wrapper — the heavy queue logic already exists

### 5.4 Exports Tab (`DentistExports`)

- Extracted from current `dentist-dashboard.tsx` into its own component
- Date range pickers (From / To)
- "My records only" toggle
- Export buttons: CSV · XLSX · PDF
- Below the export form: a short description of what each format contains

---

## 6. FDI Tooth Chart (`fdi-tooth-chart.tsx`)

### Layout

```
Upper Right (1x)    |    Upper Left (2x)
  18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
  48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
Lower Right (4x)    |    Lower Left (3x)
```

### Tooth states (cycle on click)

| State | Label | Fill color |
|---|---|---|
| Normal | — | `bg-white border-cyan-200` |
| Caries | C | `bg-amber-100 border-amber-400` |
| Filled | F | `bg-blue-100 border-blue-400` |
| Crown | Cr | `bg-purple-100 border-purple-400` |
| Missing | M | `bg-slate-100 border-slate-400 text-slate-400` |
| Extracted | X | `bg-rose-100 border-rose-400 line-through` |

### Props

```ts
interface FdiToothChartProps {
  value: ToothChartData               // { [toothId]: { state, notes? } }
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}
```

### Interaction

- Click a tooth square → cycles through states
- Right-click (or long-press on mobile) → opens inline notes popover for that tooth
- Selected tooth highlights with `ring-2 ring-cyan-500`
- A compact legend row sits below the chart
- In read-only mode, chart renders but clicks are disabled

### Data storage

`tooth_chart` JSONB column already exists on `dental_records`. Shape:
```json
{
  "11": { "state": "caries", "notes": "mesial caries" },
  "36": { "state": "filled" },
  "notes": "general chart notes"
}
```
The existing `notes` top-level key on `tooth_chart` maps to the current `toothNotes` field.

---

## 7. Dentist Notification Bell (`dentist-notification-bell.tsx`)

### Pattern

Identical polling architecture to `clinician-notification-bell.tsx`:
- Polls `GET /api/notifications` every 30 seconds
- Fires `new CustomEvent("dental:notification")` on new items
- Renders unread count badge in `cyan-600`
- Bell icon: `lucide-react` `Bell`
- Dropdown: last 10 notifications, grouped by type

### Notification types surfaced

| Type | Trigger |
|---|---|
| `patient_queued` | New patient checked into dental department |
| `lab_result_ready` | Lab test ordered by this dentist is completed |
| `appointment_reminder` | Dental appointment starting in 15 minutes |
| `preauth_status_change` | Insurance pre-auth updated for dental service category |

### Integration

`DentistShell` renders `DentistNotificationBell` in the portal header, same position as the clinician bell in `dashboard-layout.tsx`.

---

## 8. Dental Tab Redesign (`dental-tab.tsx`)

The dental tab used inside `PatientConsultation` is redesigned with:

1. **FDI Tooth Chart** at the top — shows the full mouth visual for this patient
2. **Record list** below — existing records rendered as timeline cards with cyan left-border
3. **New record form** — now includes the FDI chart in edit mode (pre-populated with existing chart state)
4. **Edit dialog** — uses same FDI chart component in edit mode
5. **Color update** — switches from `indigo` to `cyan` theme to match portal identity

---

## 9. Cross-Portal Communication

| Portal | Communication |
|---|---|
| **Nurse** | Nurse checks patient into dental dept → `patient_queued` notification fires to dentist bell |
| **Lab** | Lab marks result ready for a dentist-ordered test → `lab_result_ready` notification fires |
| **Cashier** | Dentist creates billing charge → feeds into cashier billing queue (existing, unchanged) |
| **Pharmacy** | Dentist prescriptions appear in pharmacist queue (existing RLS, unchanged) |
| **Admin** | Dental records feed into admin-overview activity stream (existing, unchanged) |
| **Clinician** | Patient consultation shell already shows dental tab when accessed by dentist role |

---

## 10. Files Changed Summary

### New files
- `components/dentist/dentist-shell.tsx`
- `components/dentist/dentist-overview.tsx`
- `components/dentist/dentist-patient-records.tsx`
- `components/dentist/dentist-schedule.tsx`
- `components/dentist/dentist-exports.tsx`
- `components/dentist/dentist-notification-bell.tsx`
- `components/dentist/fdi-tooth-chart.tsx`
- `app/api/dental/stats/route.ts`

### Modified files
- `components/dashboards/dentist-dashboard.tsx` — thin wrapper
- `components/doctor/consultation-tabs/dental-tab.tsx` — full redesign with FDI chart
- `app/api/dental/records/route.ts` — B1 fix
- `app/api/dental/records/[id]/route.ts` — B2 + B3 fix
- `lib/exports/datasets/dental.ts` — B4 fix

### Unchanged
- `app/dentist/page.tsx`
- `app/dentist/settings/page.tsx`
- All RLS policies and migrations
- Export registry
