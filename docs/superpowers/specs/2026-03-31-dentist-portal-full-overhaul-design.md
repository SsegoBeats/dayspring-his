# Dentist Portal — Full Clinical Overhaul Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Supersedes:** `2026-03-21-dentist-portal-overhaul-design.md`
**Approach:** B — Full Clinical Suite (fixes + FDI chart + tabs + notification bell + clinical actions)

---

## 1. Overview

The Dentist portal (`/dentist`) and the Dental tab in patient consultation (`components/doctor/consultation-tabs/dental-tab.tsx`) receive a complete professional overhaul. Goals:

1. Fix all 5 confirmed bugs (B1–B5)
2. Replace the single-page flat layout with a 5-tab sub-navigation shell
3. Introduce an interactive FDI 32-tooth chart
4. Add a dedicated dentist notification bell
5. Add a Clinical Actions tab for in-portal prescriptions, lab orders, and radiology requests
6. Deliver a 6-stat dashboard overview with quick-action shortcuts
7. Apply a clinic-clean cyan/pearl visual identity consistently across all components

The portal currently has ~1,300 lines of dentist-specific code. Post-overhaul it will be a fully self-contained clinical workspace.

---

## 2. Confirmed Bugs

### B1 — `toothNotes` silently dropped on CREATE
**File:** `app/api/dental/records/route.ts`
**Problem:** Client sends `toothNotes` as a top-level field. `CreateDentalSchema` has no `toothNotes` field — value is dropped before reaching the DB.
**Fix:** Add `toothNotes: z.string().optional().nullable()` to `CreateDentalSchema`. On insert, merge into the JSONB column: `tooth_chart = JSON.stringify({ ...(input.toothChart ?? {}), notes: input.toothNotes })`.

### B2 — `toothNotes` silently dropped on PATCH
**File:** `app/api/dental/records/[id]/route.ts`
**Problem:** `UpdateDentalSchema` also lacks `toothNotes`. Editing tooth notes in the UI has no effect.
**Fix:** Add `toothNotes: z.string().optional().nullable()` to `UpdateDentalSchema`. In the dynamic UPDATE builder, when `toothNotes` is present use surgical JSONB update:
```sql
tooth_chart = jsonb_set(COALESCE(tooth_chart, '{}'), '{notes}', to_jsonb($N::text))
```
This writes only the `notes` key without clobbering per-tooth FDI state data stored in the same JSONB column.

### B3 — DELETE uses wrong permission check AND Dentist lacks `delete` permission
**File:** `app/api/dental/records/[id]/route.ts` line 81 + `lib/security.ts`
**Problem (a):** `can(auth.role, "medical", "update")` used for DELETE — wrong action.
**Problem (b):** Dentist role in `lib/security.ts` only has `medical: ["read", "create", "update"]` — no `"delete"`. Fixing (a) alone makes deletion impossible for dentists.
**Fix:**
1. Add `"delete"` to Dentist role's `medical` permission array in `lib/security.ts`.
2. Change DELETE route permission check to `can(auth.role, "medical", "delete")`.
RLS already restricts dentists to deleting only their own records (`dentist_id = current_user`).

### B4 — Export cursor uses non-unique `visit_date`; SQL cast mismatch
**File:** `lib/exports/datasets/dental.ts`
**Problem (a):** Cursor key is `visit_date` — multiple records can share the same timestamp, causing silent record skips at page boundaries.
**Problem (b):** Cursor condition uses `$3::timestamp` cast but parameter 3 is `after` (the cursor value). When switching to `id`-based cursor, the cast must change to `$3::uuid`.
**Fix:**
- Change `ORDER BY dr.visit_date ASC` to `ORDER BY dr.id ASC`
- Change `AND ($3::timestamp IS NULL OR dr.visit_date > $3)` to `AND ($3::uuid IS NULL OR dr.id > $3)`
- Change `nextCursor` to `{ after: rows[rows.length - 1].id }`

### B5 — `patientsCount` fetched but never displayed
**File:** `components/dashboards/dentist-dashboard.tsx`
**Problem:** `/api/dental/summary` returns `patientsCount` but the dashboard only renders `visitsCount`. The metric is silently discarded.
**Fix:** Surfaced in the new 6-stat overview card grid (Section 6.1).

---

## 3. Architecture

### 3.1 New directory: `components/dentist/`

```
components/dentist/
  dentist-shell.tsx               ← 5-tab router + portal header + notification bell
  dentist-overview.tsx            ← 6-stat grid + quick actions + recent records
  dentist-patient-records.tsx     ← Searchable full record history with slide-over
  dentist-schedule.tsx            ← Today's header card + embedded DoctorDashboard
  dentist-clinical-actions.tsx    ← Write Rx + Order Lab + Request Radiology
  dentist-exports.tsx             ← Date-range CSV/XLSX/PDF exports
  dentist-notification-bell.tsx   ← 30-second polling bell, cyan badge
  fdi-tooth-chart.tsx             ← Interactive 32-tooth FDI chart
  dental-visit-summary.tsx        ← Per-visit composed timeline (record + labs + Rx + radiology)
```

### 3.2 Modified files

| File | Change |
|---|---|
| `components/dashboards/dentist-dashboard.tsx` | Thin wrapper only — imports and renders `DentistShell` |
| `components/doctor/consultation-tabs/dental-tab.tsx` | Full redesign: FDI chart + cyan theme + B1/B2/B3 fixes |
| `app/api/dental/records/route.ts` | B1 fix + optional `patientId` + `mode`, `search`, `page` params |
| `app/api/dental/records/[id]/route.ts` | B2 + B3 fix |
| `app/api/dental/summary/route.ts` | Extended with 4 new stat fields |
| `lib/exports/datasets/dental.ts` | B4 fix: cursor key → `id`, cast → `::uuid` |
| `lib/security.ts` | Add `"delete"` to Dentist role's `medical` permissions |
| `app/dentist/settings/page.tsx` | Cosmetic: replace `Sparkles` icon with `Stethoscope` |

### 3.3 No new database tables
All Clinical Actions (prescriptions, lab tests, radiology) route through existing API endpoints that the Dentist role already has permission to call. No migrations required. The `dental_records.tooth_chart` JSONB column already stores arbitrary structure — new FDI data is backward compatible.

### 3.4 Extended `/api/dental/summary`

Existing `visitsCount` and `patientsCount` remain. Four new fields added:

```ts
{
  visitsCount: number            // today's visit count for this dentist
  patientsCount: number          // distinct patients in date range
  proceduresThisWeek: number     // NEW — records with non-null procedure_performed this week
  pendingFollowUps: number       // NEW — appointments status='pending', dental dept
  pendingLabResults: number      // NEW — lab_tests ordered by this dentist, status != 'completed'
  pendingPreAuths: number        // NEW — insurance_authorizations status='pending', dental category
  recentRecords: [...]           // existing — last 8 records (increased from 5)
}
```

### 3.5 Extended `GET /api/dental/records`

`patientId` becomes optional. New optional query parameters:
- `?mode=mine` — returns all records where `dentist_id = current_user` (RLS enforces)
- `?search=<string>` — ILIKE filter on `p.first_name || ' ' || p.last_name` and `p.patient_number`
- `?page=<n>` — offset-based pagination, 20 records per page

When `patientId` is omitted and `mode=mine` is set, returns the dentist's full cross-patient history. When `patientId` is provided (existing usage from `dental-tab.tsx`), behavior is unchanged.

---

## 4. Visual Design System

### 4.1 Color Palette

| Token | Tailwind | Purpose |
|---|---|---|
| Primary | `cyan-600` | Active tabs, primary CTAs, icon fills, badge backgrounds |
| Primary light | `cyan-50` | Card backgrounds, row hover states |
| Primary border | `cyan-100` | Card outlines, dividers, input focus rings |
| Accent | `teal-500` | Secondary badges, procedure status indicators |
| Pearl bg | `slate-50` | Page and panel backgrounds |
| Heading | `slate-800` | All headings, stat numbers |
| Body | `slate-600` | Body text, descriptions |
| Muted | `slate-400` | Labels, captions, placeholder text |
| Danger | `rose-500` | Delete buttons, critical alerts |
| Warning | `amber-500` | Pending/in-progress states |
| Success | `emerald-500` | Completed states |

### 4.2 Reusable Class Patterns

```
Stat card:
  rounded-2xl border border-cyan-100
  bg-gradient-to-br from-cyan-50 via-white to-teal-50/30
  shadow-sm shadow-cyan-100/40

Icon container:
  rounded-xl bg-cyan-50 p-2.5 text-cyan-600

Active tab:
  border-b-2 border-cyan-600 text-cyan-700 font-semibold

Inactive tab:
  text-slate-500 hover:text-slate-700 hover:border-b-2
  hover:border-slate-200 transition-colors

Section label:
  text-[10px] font-bold uppercase tracking-widest text-cyan-500

Timeline card:
  rounded-xl border-l-4 border-cyan-400 bg-white
  shadow-sm px-4 py-3 hover:shadow-md transition-shadow

Quick action button:
  rounded-xl border-2 border-cyan-100 bg-white
  hover:bg-cyan-50 hover:border-cyan-300
  transition-all p-4 text-left
```

### 4.3 Typography

- Portal header: `text-lg font-bold text-slate-800` + dentist name sub-label `text-sm text-cyan-600`
- Stat number: `text-3xl font-bold tabular-nums text-slate-800`
- Stat label: `text-xs font-medium text-slate-500`
- Card title: `text-sm font-semibold text-slate-700`
- Section label: `text-[10px] font-bold uppercase tracking-widest text-cyan-500`

### 4.4 Loading / Empty / Error States

All components follow the same pattern:
- **Loading:** Inline `—` for numbers; soft pulsing skeleton rows for lists
- **Empty:** Centered `text-slate-400` message + relevant icon + CTA button where appropriate
- **Error:** `sonner` toast with specific message + graceful fallback to empty state (no crash)

---

## 5. Shell Component (`dentist-shell.tsx`)

The shell is the full-page wrapper that replaces the current flat `DentistDashboard` layout.

**Portal header strip** (above tabs):
- Background: `bg-white border-b border-cyan-100 shadow-sm`
- Left: Dayspring logo / portal name
- Center: dentist display name + `"Dental Surgeon"` sub-label in `text-cyan-600`
- Right: `DentistNotificationBell` + settings icon link (`/dentist/settings`)

**5 horizontal tabs** (below header strip):
```
Overview  |  Patients  |  Schedule  |  Clinical  |  Exports
```
Tab state managed with `useState<Tab>`. Active tab renders the corresponding component.

---

## 6. Tab Specifications

### 6.1 Overview Tab (`dentist-overview.tsx`)

**6-stat grid** (3 cols desktop / 2 tablet / 1 mobile):

| Card | Icon | Metric |
|---|---|---|
| Today's Visits | `Stethoscope` | `visitsCount` |
| Patients This Month | `Users` | `patientsCount` (extended) |
| Procedures This Week | `Activity` | `proceduresThisWeek` |
| Pending Follow-ups | `Clock` | `pendingFollowUps` |
| Pending Lab Results | `FlaskConical` | `pendingLabResults` |
| Insurance Pre-Auths | `ShieldCheck` | `pendingPreAuths` |

**Quick Actions panel** (3 equal-width cards in a row below stats):
- "New Dental Record" → triggers patient search → opens consultation
- "Order Lab Test" → switches to Clinical tab, opens lab section
- "Write Prescription" → switches to Clinical tab, opens Rx section

**Recent Dental Records list** (last 8):
- Timeline cards: patient name + diagnosis + procedure + date
- Clicking a row → Radix `Sheet` slide-over with full record (FDI chart in read-only mode)

---

### 6.2 Patients Tab (`dentist-patient-records.tsx`)

**Header row:**
- Search input (debounced 300ms) — searches patient name + patient number
- "My records only" toggle (default on)

**Table columns:** Date · Patient No. · Patient Name · Diagnosis · Procedure · Actions

**Row actions:**
- Eye icon → Radix `Sheet` slide-over: full record with FDI chart (read-only)
- Pencil icon (dentist/admin only) → Radix `Sheet` slide-over: full record with FDI chart (interactive)
- Trash icon (dentist/admin only) → Radix `AlertDialog` confirm → DELETE `/api/dental/records/[id]`

**Pagination:** Previous / Next, 20 per page, current page indicator

**API:** Uses extended `GET /api/dental/records?mode=mine&search=<s>&page=<n>`

---

### 6.3 Schedule Tab (`dentist-schedule.tsx`)

**Today's header card:**
- Count of today's dental appointments
- Next patient's name (if any)
- Sourced from appointments table filtered to dental department

**Below:** Embeds `DoctorDashboard` with `showDentalQueueFilter={true}`.
This coupling is a known trade-off — documented here so any future `DoctorDashboard` refactor includes updating this tab.

---

### 6.4 Clinical Actions Tab (`dentist-clinical-actions.tsx`)

Three accordion sections (one open at a time by default):

**Write Prescription**
- Patient search typeahead (autocomplete by name/patient number)
- Medication name, dosage, frequency, duration, instructions
- "Add another medication" button
- Submit → `POST /api/prescriptions` (existing endpoint)
- Success → sonner toast + prescription reference shown

**Order Lab Test**
- Patient search typeahead
- Lab test type (dropdown from existing test type list)
- Clinical notes
- Priority: Routine / Urgent
- Submit → `POST /api/lab-tests` (existing endpoint; dentist has `lab.create` permission)
- Success → sonner toast + order number shown

**Request Radiology**
- Patient search typeahead
- Scan type dropdown: OPG Panoramic · Periapical · Bitewing · CBCT · Other
- Clinical indication text
- Submit → `POST /api/radiology-requests` (existing endpoint; dentist has `radiology.create` permission)
- Success → sonner toast + request ID shown

---

### 6.5 Exports Tab (`dentist-exports.tsx`)

Extracted from current `dentist-dashboard.tsx` — identical logic, promoted to its own tab.
- From / To date range pickers
- "My records only" toggle
- Export buttons: CSV · XLSX · PDF
- Brief description of export content under buttons
- Styling updated to cyan theme

---

## 7. FDI Tooth Chart (`fdi-tooth-chart.tsx`)

### Layout (two rows of 16, center divider)

```
Upper right ← | → Upper left
18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28
48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38
Lower right ← | → Lower left
```

Each tooth: `w-8 h-8 rounded border text-[10px] font-bold flex items-center justify-center transition-all`

### 6 tooth states (click to cycle; Shift+click resets to normal)

| State | Code | Tailwind classes |
|---|---|---|
| Normal | — | `bg-white border-cyan-200` |
| Caries | C | `bg-amber-100 border-amber-400 text-amber-700` |
| Filled | F | `bg-blue-100 border-blue-400 text-blue-700` |
| Crown | Cr | `bg-purple-100 border-purple-400 text-purple-700` |
| Missing | M | `bg-slate-100 border-slate-400 text-slate-500` |
| Extracted | X | `bg-rose-100 border-rose-400 text-rose-600` |

### Interaction

- **Click** tooth → cycles state
- **Shift+click** tooth → reset to Normal
- **Selected tooth** → `ring-2 ring-cyan-500 ring-offset-1`; notes panel appears **below the chart** (not a popover)
- **Legend row** below chart: `text-[10px]` colour swatches + state codes
- **Read-only mode:** teeth not interactive, notes panel hidden, legend visible

### Props

```ts
interface FdiToothChartProps {
  value: ToothChartData
  onChange: (data: ToothChartData) => void
  readOnly?: boolean
}

type ToothState = "normal" | "caries" | "filled" | "crown" | "missing" | "extracted"

type ToothChartData = {
  [toothId: string]: { state: ToothState; notes?: string }
  notes?: string  // top-level general chart notes → maps to existing toothNotes field
}
```

### Backward compatibility

Existing `dental_records.tooth_chart` values handled gracefully:
- `null` → all teeth Normal, no notes
- `{}` → all teeth Normal, no notes
- `{ notes: "some text" }` → all teeth Normal, general notes populated
- `{ "11": { state: "caries" }, notes: "..." }` → full FDI state (new format)

No migration required.

---

## 8. Notification Bell (`dentist-notification-bell.tsx`)

Pattern: identical to `clinician-notification-bell.tsx`.

- Polls `GET /api/notifications` every 30 seconds
- Unread count badge: `bg-cyan-600 text-white` small circle on top-right of bell icon
- Dropdown: last 10 notifications, each with type icon + message + timestamp + unread dot
- "Mark all read" button at top of dropdown
- Types shown when backend events exist: `patient_queued`, `lab_result_ready`, `appointment_reminder`, `preauth_status_change`
- Types with no backend events simply do not appear — no error, no empty state for those types specifically

---

## 9. Dental Tab Redesign (`dental-tab.tsx`)

1. Color scheme: `indigo-*` → `cyan-*` throughout
2. FDI Tooth Chart rendered at top of both the "New Record" form and the "Edit" dialog
3. Existing records displayed as timeline cards with `border-l-4 border-cyan-400`
4. Record card expanded view shows FDI chart in read-only mode
5. All B1/B2/B3 API fixes applied; tooth chart data now round-trips correctly

---

## 10. Settings Page (`app/dentist/settings/page.tsx`)

One cosmetic change: `import { Sparkles }` → `import { Stethoscope }`. The icon is updated to `<Stethoscope className="h-5 w-5" />`. All settings panels (Profile, Preference, Email, Password, Notification) unchanged — they are correct.

---

## 11. Cross-Portal Communication

| Portal | Channel | Status |
|---|---|---|
| **Nurse** | Patient check-in to dental dept → `patient_queued` notification | Notification bell will display if nurse check-in API inserts this type |
| **Lab** | Lab result ready for dentist-ordered test → `lab_result_ready` notification | Notification bell will display if lab result API inserts this type |
| **Cashier** | Dentist billing charge entries → cashier queue | Existing, unchanged |
| **Pharmacy** | Dentist prescriptions (via Clinical tab) → pharmacist queue | Existing endpoint, now surfaced in portal |
| **Radiology** | Dentist radiology requests (via Clinical tab) → radiologist worklist | Existing endpoint, now surfaced in portal |
| **Admin** | Dental records feed admin activity stream | Existing, unchanged |

---

## 12. Files Changed Summary

### New files (9)
```
components/dentist/dentist-shell.tsx
components/dentist/dentist-overview.tsx
components/dentist/dentist-patient-records.tsx
components/dentist/dentist-schedule.tsx
components/dentist/dentist-clinical-actions.tsx
components/dentist/dentist-exports.tsx
components/dentist/dentist-notification-bell.tsx
components/dentist/fdi-tooth-chart.tsx
components/dentist/dental-visit-summary.tsx
```

### Modified files (8)
```
components/dashboards/dentist-dashboard.tsx       ← thin wrapper only
components/doctor/consultation-tabs/dental-tab.tsx ← FDI chart + cyan + bug fixes
app/api/dental/records/route.ts                   ← B1 fix + extended query params
app/api/dental/records/[id]/route.ts              ← B2 + B3 fix
app/api/dental/summary/route.ts                   ← 4 new stat fields
lib/exports/datasets/dental.ts                    ← B4 cursor fix
lib/security.ts                                   ← add "delete" to Dentist.medical
app/dentist/settings/page.tsx                     ← Sparkles → Stethoscope icon
```

### Unchanged
```
app/dentist/page.tsx                 ← mounts DentistDashboard which wraps DentistShell
All RLS policies and migrations      ← no DB changes needed
Export registry                      ← dental dataset registered, no change needed
```

---

## 13. Implementation Order

Recommended sequence to minimise integration risk:

1. **Bug fixes first** — B3 (`security.ts` + DELETE route), B1, B2, B4, B5
2. **`fdi-tooth-chart.tsx`** — pure component, no API dependency
3. **`dental-tab.tsx` redesign** — integrates FDI chart, tests bug fixes
4. **Extended API routes** — summary (4 new fields) + records (search/page params)
5. **`dentist-notification-bell.tsx`** — independent component
6. **`dentist-shell.tsx`** + all tab components (can be built in parallel)
7. **`dentist-dashboard.tsx`** — swap to thin wrapper last, after shell is stable
8. **Settings icon** — cosmetic, last
