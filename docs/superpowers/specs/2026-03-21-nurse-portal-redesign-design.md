# Nurse Portal — Full Audit, Redesign & Hardening
**Date:** 2026-03-21
**Status:** Approved by user
**Identity:** "Vital Force" — pearl white base, deep violet primary, fuchsia critical accent, cyan vitals accent

---

## 1. Scope

A comprehensive audit, bug-fix, and visual redesign of the Dayspring HIS Nurse Portal. Every page, sub-page, tab, feature, API, component, export, settings page, and notification area is in scope.

### In scope
- `app/nurse/page.tsx`
- `app/nurse/settings/page.tsx`
- `components/dashboards/nurse-dashboard.tsx`
- `components/nursing/patient-care-list.tsx`
- `components/nursing/patient-care-view.tsx`
- `components/patient/triage-form.tsx` (wrapper styling only — logic untouched)
- `lib/nursing-context.tsx`
- `lib/vital-signs-validation.ts`
- `app/api/vitals/route.ts`
- `app/api/vitals/latest/route.ts`
- `app/api/vitals/export/route.ts`
- `app/api/nursing-notes/route.ts`
- `app/api/nursing-notes/latest/route.ts`
- `app/api/nursing-notes/export/route.ts`
- `app/api/triage/route.ts`
- New file: `lib/vital-formatting.ts`
- New file: `components/nursing/nurse-notification-bell.tsx`

### Out of scope
- Other portal dashboards
- Database schema migrations
- `triage-form.tsx` internal logic (only visual wrapper changes)

---

## 2. Bug & Code Quality Fixes

### 2.1 Dev/debug text leaked into production UI
**Location:** `nurse-dashboard.tsx` lines ~488–493, ~597
- `"Nurse actions stay in nurse flow"` badge — remove
- `"Buttons now open the exact tab requested for the selected patient."` — replace with real subtitle
- `"Notification clicks now open the correct nurse workflow instead of falling into clinician-only paths."` — replace with a real shift snapshot description
- `"The same range now drives the summary cards, latest vitals table, and exported files."` — replace with real label copy

### 2.2 Duplicate formatting utility functions
**Location:** `patient-care-list.tsx` lines 43–72 and `patient-care-view.tsx` lines 92–147
Both files define identical `numInt`, `numFloat`, `fmtBP`, `fmtTemp`, `fmtBpm`, `fmtRR`, `fmtSpO2`, `fmtKg`, `fmtCm` functions.

**Fix:** Extract to `lib/vital-formatting.ts` as named exports. Import in both components.

### 2.3 Raw `<table>` in PatientCareList
**Location:** `patient-care-list.tsx` lines 278–380
Uses raw HTML `<table>/<thead>/<tbody>/<tr>/<td>` instead of shadcn `Table` components.

**Fix:** Replace with shadcn `Table, TableHeader, TableBody, TableRow, TableHead, TableCell`.

### 2.4 No critical vitals highlighting in PatientCareList
The Latest Vitals table (nurse-dashboard.tsx) correctly highlights critical rows. The Patient Care List does not show any visual indication that a patient's latest vitals are critical.

**Fix:** In the patient care list row renderer, call `hasCriticalVitals()` on the patient's `getLatestVitals()` result and apply `bg-fuchsia-50` row background + a pulsing fuchsia dot next to the patient name when critical.

### 2.5 Dialog → Sheet for PatientCareView
**Location:** `nurse-dashboard.tsx` lines 591–598
The `Dialog` restricts screen real estate, especially for the long triage form.

**Fix:** Replace `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription` with `Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription` from shadcn. Sheet slides from the right, `side="right"`, `className="w-full sm:w-[80vw] overflow-y-auto"`.

### 2.6 Missing nurse-specific notification bell
The pharmacist portal has a `PharmacistNotificationBell` component in its card header. The nurse portal has no equivalent — notifications only come via the global dashboard bell and EventSource toasts.

**Fix:** Create `components/nursing/nurse-notification-bell.tsx` — a compact bell icon button that fetches recent nurse-relevant notifications (new patient registrations, triage alerts) and shows an unread count badge. Clicking opens a dropdown listing notifications. Clicking a notification fires `openNursePatientCare` CustomEvent with the patient ID.

### 2.7 Settings page — DashboardLayout missing
**Location:** `app/nurse/settings/page.tsx`
The settings page uses `SettingsLayout` but is not wrapped in `DashboardLayout`. The nurse main page wraps in `DashboardLayout`, so this is inconsistent — the sidebar nav is absent on the settings page.

**Fix:** Verify whether `SettingsLayout` already renders inside `DashboardLayout` via the app shell. If not, wrap `NurseSettingsPage` the same way as `NursePortalPage`.

---

## 3. Color System — "Vital Force"

```
Base page background:  #F8F7FF  (pearl white, violet-tinted)
Primary / identity:    violet-700  (#6D28D9)
Hero dark:             violet-950  (#2E1065)
Hero gradient end:     indigo-900  (#312E81)
Critical accent:       fuchsia-600  (#C026D3)
Vitals accent:         cyan-600  (#0891B2)
Notes accent:          amber-600  (#D97706)
Triage Emergency:      red-600
Triage Very Urgent:    fuchsia-600
Triage Urgent:         amber-500
Triage Routine:        emerald-600
Not triaged:           slate-400
Card borders:          violet-100
Card backgrounds:      white (#FFFFFF)
Violet-tinted surface: violet-50 (#F5F3FF)
```

**Typography:**
- Section labels: `text-xs font-semibold uppercase tracking-widest text-violet-400`
- Stat numbers: `text-4xl font-bold`
- Section headings: `text-xl font-bold tracking-tight`
- Table headers: `text-xs font-semibold uppercase tracking-widest text-slate-400`
- Body: `text-slate-700`

---

## 4. Component Designs

### 4.1 Hero Banner (`nurse-dashboard.tsx`)

**Layout:** Full-width, `rounded-[28px]`, `overflow-hidden`
**Background:** `bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-900`
**Decorative elements:** Two blurred circle overlays (`bg-fuchsia-400/20 blur-3xl`, `bg-cyan-400/15 blur-3xl`)
**Content grid:** `lg:grid-cols-[1.6fr_1fr]`

Left column:
- Pill badge: `"Nurse Portal"` — `bg-white/10 border-white/15 text-violet-200 uppercase tracking-[0.28em] text-xs`
- Headline: `"Your shift. Your patients. Your command."` — `text-3xl md:text-4xl font-bold text-white`
- Subtext: `"Monitor vitals, document care, and triage patients — all from one place."` — `text-violet-200/90 text-sm md:text-base`
- 3 quick-action cards: `bg-white/10 border-white/15 rounded-2xl hover:bg-white/15`, each with icon, title, description, animated `ArrowUpRight`

Right column (Shift Snapshot card):
- `bg-white/12 backdrop-blur border-white/20 rounded-2xl text-white`
- Date range pill at top
- Two stat boxes: Critical Patients (fuchsia dot pulses if > 0), Awaiting Triage (amber accent)
- Thin divider
- Live clock (updates every second via `setInterval`)
- Remove current dev-text description

### 4.2 Stat Cards Row

Four white cards with `border-t-4` accent, icon badge, large stat number:

| Card | Border color | Icon bg | Icon color |
|---|---|---|---|
| Total Patients | `border-violet-500` | `bg-violet-100` | `text-violet-600` |
| Vitals Logged | `border-cyan-500` | `bg-cyan-100` | `text-cyan-600` |
| Notes Added | `border-amber-500` | `bg-amber-100` | `text-amber-600` |
| Critical Watch | `border-fuchsia-500` | `bg-fuchsia-100` | `text-fuchsia-600` |

Icon badge positioned top-right of card (`rounded-xl p-2`). Critical Watch pulses if count > 0.

### 4.3 Patient Care List (`patient-care-list.tsx`)

Card: `border-l-4 border-violet-600 rounded-2xl`
Card header: title "Patient Care" bold, subtitle "Select a patient to record vitals, add notes, or complete triage.", `NurseNotificationBell` component top-right.

Search: violet focus ring (`focus-visible:ring-violet-400`).

Bulk vitals panel: `bg-violet-50 border border-violet-200 rounded-2xl p-4`. Header: `"Recording for {N} patients"` in `text-violet-700 font-semibold`. "Record Vitals" button: `bg-violet-700 hover:bg-violet-800`.

Table (shadcn `Table`):
- Headers: uppercase, `tracking-widest`, `text-xs`, `text-violet-400`
- Rows: left border 3px colored by triage category (CSS via `border-l-[3px]` on `TableRow` className)
- Critical rows: `bg-fuchsia-50` + pulsing fuchsia dot (`animate-pulse rounded-full bg-fuchsia-500 h-2 w-2`) beside patient name
- Allergy badge: `bg-red-50 text-red-700 border border-red-200 text-xs`
- Latest vitals chips: `bg-cyan-50 text-cyan-700 text-xs px-1.5 py-0.5 rounded` per value
- Action buttons: Vitals=`variant="default" className="bg-violet-700"`, Note=`variant="outline" className="border-cyan-400 text-cyan-700"`, Triage=`variant="outline" className="border-fuchsia-400 text-fuchsia-700"`

Empty state: centered, violet icon, `text-violet-400`.

### 4.4 Patient Care View (`patient-care-view.tsx`) — Sheet

`Sheet` from shadcn, `side="right"`, width `sm:w-[80vw]`.

Sticky sheet header: patient name (`font-bold text-lg`), P.ID (`font-mono text-sm text-violet-600`), age + gender chips (`bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full`), blood group chip, allergy badge (`bg-red-50 text-red-700`), close button.

Tab bar: horizontal, pill-style. Active: `bg-violet-700 text-white`. Inactive: `text-violet-600 hover:bg-violet-50`. Tabs: Activity icon + "Vitals", FileText + "Note", Clock + "History", AlertCircle + "Triage".

**Vitals tab:**
- 2-column input grid desktop, 1-column mobile
- Input left accent bars: `border-l-4 border-cyan-400` for BP/HR/RR/SpO2; `border-l-4 border-amber-400` for Temp; `border-l-4 border-violet-400` for Weight/Height
- Inline validation: critical=`text-fuchsia-600`, warning=`text-amber-600`, normal=`text-emerald-600`
- Submit: `bg-violet-700 w-full`, keyboard hint badge `Ctrl+Enter`

**Note tab:**
- Segmented button group for category (not dropdown):
  - Assessment: `bg-violet-100 text-violet-700 border-violet-300`
  - Medication: `bg-cyan-100 text-cyan-700 border-cyan-300`
  - Procedure: `bg-amber-100 text-amber-700 border-amber-300`
  - Observation: `bg-emerald-100 text-emerald-700 border-emerald-300`
  - Other: `bg-slate-100 text-slate-700 border-slate-300`
- Textarea with character counter
- Submit: `bg-violet-700 w-full`

**History tab:**
- "Vitals History" section header, then "Notes History" section header separated by a `<Separator />`
- Vitals cards: `border-l-4 border-cyan-400 bg-cyan-50/30`, header shows date/time + nurse name, vitals as colored chips
- Notes cards: border-l-4 colored by category (violet/cyan/amber/emerald/slate), header shows category + date/time

**Triage tab:**
- Wrapper: `bg-violet-50 rounded-2xl p-4`
- Live triage category result pill at top of form, updates as fields change
- Submit button: `bg-violet-700 w-full`

### 4.5 Latest Vitals Table (`nurse-dashboard.tsx`)

Card: `border-l-4 border-cyan-500`. Header: `bg-cyan-50/50`, title "Latest Vitals", cyan record count pill, + export toggle button (`Download` icon).

Filters: search (cyan focus ring), triage dropdown (colored dot per option), Critical Only toggle (`bg-fuchsia-600` when active).

Table headers: `text-xs uppercase tracking-widest text-slate-400`. Sort icon: `text-violet-500` when active.

Row styles:
- Critical: `bg-fuchsia-50 border-l-[3px] border-fuchsia-500` + pulsing dot
- Normal: `hover:bg-violet-50`
- Triage badges: colored `bg-*/text-*/border-*` pills per category
- Action links: violet/cyan/fuchsia `font-medium text-sm hover:underline`

Empty state: contextual message with cyan icon.

**Export panel:** Collapsible section inside vitals card footer (toggled by `Download` button in header). Horizontal row: Quick Range, From, To, Format selectors + "Export Vitals" (`bg-cyan-600`) + "Export Notes" (`bg-amber-600`) buttons. Remove the separate standalone export card.

### 4.6 Nurse Notification Bell (`nurse-notification-bell.tsx`)

Component: `NurseNotificationBell`
Renders: `Bell` icon button with an unread count badge (`bg-fuchsia-600 text-white`).

On mount: fetch `/api/notifications?limit=15` filtered for nurse-relevant events (new patient registrations). Poll every 60 seconds.

Dropdown (Popover): list of recent notifications, each showing patient name, event type, time ago. Clicking a notification:
1. Fires `window.dispatchEvent(new CustomEvent("openNursePatientCare", { detail: { patientId, initialTab: "triage", notificationId } }))`
2. Calls `PATCH /api/notifications` to mark as read
3. Closes popover

"Mark all read" button at bottom of dropdown.

### 4.7 Settings Page (`app/nurse/settings/page.tsx`)

- Icon: `Stethoscope` in `text-violet-600` (replacing `Heart`)
- `SettingsLayout` header bottom border: `border-b-4 border-violet-600`
- Verify `DashboardLayout` wrapping (audit only — fix if sidebar is absent)
- `PreferenceSettings` for nurses: "Default Dashboard View" selector with violet radio buttons clearly labeled

---

## 5. New Utility: `lib/vital-formatting.ts`

```typescript
// Extracted shared formatting functions for vital signs
export function numInt(s: string): number | null
export function numFloat(s: string): number | null
export function fmtBP(s: string): string
export function fmtTemp(s: string): string   // F→C conversion if > 45
export function fmtBpm(s: string): string
export function fmtRR(s: string): string
export function fmtSpO2(s: string): string
export function fmtKg(s: string): string     // lbs→kg conversion
export function fmtCm(s: string): string     // ft'in"→cm conversion
```

Both `patient-care-list.tsx` and `patient-care-view.tsx` import from this module. Inline definitions removed.

---

## 6. Cross-Portal Communication (unchanged, verified working)

| Signal | Direction | Mechanism |
|---|---|---|
| New patient registered | Receptionist → Nurse | EventSource `/api/notifications/stream` → toast |
| Open patient care | Dashboard layout → Nurse | `CustomEvent("openNursePatientCare", {patientId, initialTab, notificationId})` |
| Mark notification read | Nurse → System | `PATCH /api/notifications` |

No new cross-portal signals needed. Existing wiring is correct and verified.

---

## 7. API Layer (no changes needed)

All 9 API routes are complete, correctly use RLS (`queryWithSession`), have proper auth permission checks, and are well-validated. No changes required.

---

## 8. Implementation Order

1. Create `lib/vital-formatting.ts` (shared utilities)
2. Create `components/nursing/nurse-notification-bell.tsx`
3. Redesign `components/nursing/patient-care-list.tsx` (bugs + design)
4. Redesign `components/nursing/patient-care-view.tsx` (bugs + design, Sheet)
5. Redesign `components/dashboards/nurse-dashboard.tsx` (bugs + design, Dialog→Sheet, live clock, export collapse)
6. Update `app/nurse/settings/page.tsx` (icon + DashboardLayout audit)
7. Verify build passes (`npm run build`)
