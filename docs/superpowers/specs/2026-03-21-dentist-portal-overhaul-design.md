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
**File:** `app/api/dental/records/route.ts`
**Problem:** The client sends `toothNotes` as a top-level payload field, but `CreateDentalSchema` only has `toothChart` (JSONB record) and `notes`. The `toothNotes` value is silently dropped.
**Fix:** Add `toothNotes: z.string().optional().nullable()` to `CreateDentalSchema`. When building the insert, merge: `tooth_chart = { ...input.toothChart, notes: input.toothNotes }` — so per-tooth FDI data and the general notes key coexist in the same JSONB column without overwriting each other.

### B2 — `toothNotes` never saved on PATCH
**File:** `app/api/dental/records/[id]/route.ts`
**Problem:** Same mismatch — `UpdateDentalSchema` has no `toothNotes` field; tooth notes silently ignored on edit.
**Fix:** Add `toothNotes: z.string().optional().nullable()` to `UpdateDentalSchema`. In the dynamic UPDATE builder, when `toothNotes` is present, use:
```sql
tooth_chart = jsonb_set(COALESCE(tooth_chart, '{}'), '{notes}', to_jsonb($N::text))
```
This writes only the `notes` key without clobbering per-tooth FDI state data stored in the same JSONB column.

### B3 — DELETE uses wrong permission check AND Dentist lacks `delete` permission
**File:** `app/api/dental/records/[id]/route.ts` line 81 + `lib/security.ts`
**Problem (a):** `can(auth.role, "medical", "update")` is used instead of `can(auth.role, "medical", "delete")`.
**Problem (b):** The Dentist role in `lib/security.ts` only has `medical: ["read", "create", "update"]` — no `"delete"`. Fixing (a) alone would make deletion impossible for dentists.
**Fix:**
1. Add `"delete"` to the Dentist role's `medical` permission array in `lib/security.ts`.
2. Change the DELETE route permission check to `can(auth.role, "medical", "delete")`.
This is intentional: dentists should be able to delete their own records (RLS already restricts to `dentist_id = current_user`).

### B4 — Export cursor uses non-unique `visit_date`; SQL cast mismatch
**File:** `lib/exports/datasets/dental.ts`
**Problem (a):** Cursor pagination uses `visit_date` as cursor key — multiple records can share the same timestamp, causing silent record skips at page boundaries.
**Problem (b):** The cursor SQL uses `$3::timestamp` cast. Switching to `id` (a UUID) requires changing the cast to `$3::uuid`.
**Fix:** Change `ORDER BY dr.visit_date ASC` to `ORDER BY dr.id ASC`. Change `AND ($3::timestamp IS NULL OR dr.visit_date > $3)` to `AND ($3::uuid IS NULL OR dr.id > $3)`. Update `nextCursor` to `{ after: rows[rows.length - 1].id }`.

### B5 — `patientsCount` fetched but never displayed
**File:** `components/dashboards/dentist-dashboard.tsx`
**Problem:** The summary API returns `patientsCount` but the dashboard only shows `visitsCount`.
**Fix:** Surfaced in the new 6-stat overview card grid (see Section 5.1).

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
| `components/doctor/consultation-tabs/dental-tab.tsx` | Full redesign: FDI chart + improved form + cyan theme |
| `app/api/dental/records/route.ts` | Fix B1 (`toothNotes` merge into `toothChart`) |
| `app/api/dental/records/[id]/route.ts` | Fix B2 (`jsonb_set` for toothNotes) + Fix B3 (DELETE permission) |
| `app/api/dental/summary/route.ts` | Extended (not replaced) to return all 6 stat values |
| `lib/exports/datasets/dental.ts` | Fix B4 (cursor uses `id`, cast changed to `::uuid`) |
| `lib/security.ts` | Add `"delete"` to Dentist role's `medical` permissions |

### 3.3 API: extend `/api/dental/summary` (not a new route)

The existing `GET /api/dental/summary` is **extended** (not replaced) to return all 6 stat values. No new route is created. The existing `visitsCount` and `patientsCount` fields remain unchanged for backward compatibility. Four new fields are added:

```ts
{
  visitsCount: number           // existing — today's visits
  patientsCount: number         // existing — distinct patients in range
  proceduresThisWeek: number    // NEW — records with non-null procedure_performed this week
  pendingFollowUps: number      // NEW — appointments status='pending' in dental dept
  pendingLabResults: number     // NEW — lab_tests ordered by me, status != 'completed'
  pendingPreAuths: number       // NEW — insurance_authorizations status='pending', dental category
  recentRecords: [...]          // existing — last 5 records
}
```

### 3.4 Notification bell — backend trigger audit

The existing `/api/notifications` endpoint and notifications table are used. Before implementing the bell, verify which notification types are already being inserted by the system:

| Notification type | Created by | Status to verify |
|---|---|---|
| `patient_queued` | Nurse check-in flow | Check nurse check-in API |
| `lab_result_ready` | Lab result update API | Check `app/api/lab-tests` routes |
| `appointment_reminder` | Likely not yet implemented | May need a cron/scheduled job |
| `preauth_status_change` | Insurance pre-auth update flow | Check insurance API routes |

If any of these notification types are not yet created by the system, the bell will silently show nothing for those types. Implementation will note which types are active and which are pending backend support. The bell will render correctly either way — missing event types simply show zero.

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

### Loading / empty / error states

All new components follow the existing dashboard pattern:
- **Loading:** skeleton placeholder (`—` or animated pulse) while fetching
- **Empty:** muted text (`"No records found"`, `"Nothing scheduled today"`)
- **Error:** toast via `sonner` + graceful fallback to empty state (no crash)

---

## 5. Tab-by-Tab Feature Breakdown

### 5.1 Overview Tab (`DentistOverview`)

**6-stat card grid (3 columns on desktop, 2 on tablet, 1 on mobile):**

| Card | Icon | Metric | Source |
|---|---|---|---|
| Today's Visits | `Stethoscope` | `visitsCount` | `/api/dental/summary` |
| Patients This Month | `Users` | `patientsThisMonth` (from extended summary) | `/api/dental/summary` |
| Procedures This Week | `Activity` | `proceduresThisWeek` | `/api/dental/summary` |
| Pending Follow-ups | `Clock` | `pendingFollowUps` | `/api/dental/summary` |
| Pending Lab Results | `FlaskConical` | `pendingLabResults` | `/api/dental/summary` |
| Insurance Pre-auths | `ShieldCheck` | `pendingPreAuths` | `/api/dental/summary` |

Below the stat grid: **Recent Dental Records** list (last 8, showing patient name + diagnosis + procedure + date).

### 5.2 Patient Records Tab (`DentistPatientRecords`)

**API change to `GET /api/dental/records`:** `patientId` becomes optional. New optional query parameters:
- `?mode=mine` — returns all records where `dentist_id = current_user` (scoped by RLS)
- `?search=<string>` — filters by patient first/last name or patient_number (ILIKE)
- `?page=<n>` — page number (20 per page)
- Without `patientId` and with `mode=mine`, the endpoint returns the dentist's full record history

**UI:**
- Search input (debounced, 300ms)
- Table: Date · Patient · Diagnosis · Procedure
- Row click → opens `PatientConsultation` sliding panel with `initialTab="dental"`
- Pagination controls (Previous / Next)
- Empty state: "No dental records found"

**Authorization:** Dentist sees only their own records (RLS enforces). Hospital Admin sees all.

### 5.3 Schedule Tab (`DentistSchedule`)

- Embeds existing `DoctorDashboard` with `showDentalQueueFilter` prop (existing, verified coupling)
- Note: This couples dentist portal to `DoctorDashboard`. If `DoctorDashboard` is refactored, this tab must be updated. Accepted as a known trade-off — the coupling already exists in the current portal.
- Adds a "Today's Appointments" header card showing count and next patient name

### 5.4 Exports Tab (`DentistExports`)

- Extracted from current `dentist-dashboard.tsx`
- Date range pickers (From / To)
- "My records only" toggle
- Export buttons: CSV · XLSX · PDF
- Brief description of export content below buttons

---

## 6. FDI Tooth Chart (`fdi-tooth-chart.tsx`)

### Layout

```
Upper Right (1x)  |  Upper Left (2x)
18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
Lower Right (4x)  |  Lower Left (3x)
```

### Tooth states (click to cycle)

| State | Label | Fill |
|---|---|---|
| Normal | — | `bg-white border-cyan-200` |
| Caries | C | `bg-amber-100 border-amber-400` |
| Filled | F | `bg-blue-100 border-blue-400` |
| Crown | Cr | `bg-purple-100 border-purple-400` |
| Missing | M | `bg-slate-100 border-slate-400` |
| Extracted | X | `bg-rose-100 border-rose-400` |

### Interaction (accessible, cross-platform)

- **Click** a tooth → cycles through states
- **Selected tooth** → highlighted with `ring-2 ring-cyan-500`; a notes input appears **below the chart** in a dedicated panel (not a popover, not right-click — avoids browser context menu conflicts and mobile/accessibility issues)
- A compact legend row sits below the chart
- In **read-only** mode, teeth are not clickable; notes panel is hidden

### Props

```ts
interface FdiToothChartProps {
  value: ToothChartData               // { [toothId]: { state, notes? }, notes?: string }
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}

type ToothState = "normal" | "caries" | "filled" | "crown" | "missing" | "extracted"
type ToothChartData = {
  [toothId: string]: { state: ToothState; notes?: string }
  notes?: string  // top-level general chart notes (maps to existing toothNotes field)
}
```

### Backward compatibility

Existing `dental_records` rows may have:
- `tooth_chart = null` → render as all-normal teeth, no notes
- `tooth_chart = {}` → same
- `tooth_chart = { notes: "some text" }` → render all-normal, populate general notes field
- `tooth_chart = { "11": { state: "caries" }, notes: "..." }` → full FDI data (new format)

The component gracefully handles all these shapes. No migration is required — the column already stores JSONB and all formats are valid.

---

## 7. Dentist Notification Bell (`dentist-notification-bell.tsx`)

### Pattern

Identical polling architecture to `clinician-notification-bell.tsx`:
- Polls `GET /api/notifications` every 30 seconds
- Renders unread count badge in `cyan-600`
- Dropdown: last 10 notifications, grouped by type

### Notification types

| Type | Trigger (to be verified during implementation) |
|---|---|
| `patient_queued` | New patient checked into dental department |
| `lab_result_ready` | Lab test ordered by this dentist is completed |
| `appointment_reminder` | Appointment starting soon |
| `preauth_status_change` | Insurance pre-auth updated for dental |

If a notification type is not yet created by the backend, it simply won't appear — no runtime error.

### Integration

`DentistShell` renders `DentistNotificationBell` in the portal header.

---

## 8. Dental Tab Redesign (`dental-tab.tsx`)

1. **FDI Tooth Chart** at top — shows full mouth for this patient; loads from existing `tooth_chart` column (handles all legacy shapes)
2. **Record list** — existing records as timeline cards with cyan left-border accent
3. **New record form** — includes FDI chart in edit mode + all existing text fields
4. **Edit dialog** — pre-populates FDI chart from existing record data
5. **Color update** — `indigo` → `cyan` throughout to match portal identity

---

## 9. Cross-Portal Communication

| Portal | Communication |
|---|---|
| **Nurse** | Patient check-in to dental dept → `patient_queued` notification (if implemented) |
| **Lab** | Lab result ready for dentist-ordered test → `lab_result_ready` notification (if implemented) |
| **Cashier** | Dentist creates billing charge → cashier queue (existing, unchanged) |
| **Pharmacy** | Dentist prescriptions → pharmacist queue (existing, unchanged) |
| **Admin** | Dental records feed admin-overview activity stream (existing, unchanged) |

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

### Modified files
- `components/dashboards/dentist-dashboard.tsx` — thin wrapper only
- `components/doctor/consultation-tabs/dental-tab.tsx` — full redesign
- `app/api/dental/records/route.ts` — B1 fix + new query params for Patient Records tab
- `app/api/dental/records/[id]/route.ts` — B2 + B3 fix
- `app/api/dental/summary/route.ts` — extended with 4 new stat fields
- `lib/exports/datasets/dental.ts` — B4 fix (cursor key + SQL cast)
- `lib/security.ts` — add `"delete"` to Dentist role's medical permissions

### Unchanged
- `app/dentist/page.tsx` — imports `DentistDashboard` which wraps `DentistShell`; no changes needed
- `app/dentist/settings/page.tsx`
- All RLS policies and migrations
- Export registry
