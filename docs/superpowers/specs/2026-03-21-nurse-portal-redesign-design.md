# Nurse Portal — Full Audit, Redesign & Hardening
**Date:** 2026-03-21
**Status:** Approved by user
**Identity:** "Vital Force" — pearl white base, deep violet primary, fuchsia critical accent, cyan vitals accent

---

## 1. Scope

A comprehensive audit, bug-fix, and visual redesign of the Dayspring HIS Nurse Portal. Every page, sub-page, tab, feature, API, component, export, settings page, and notification area is in scope.

### Files to modify
- `app/nurse/page.tsx` — minor only (no layout changes needed)
- `app/nurse/settings/page.tsx` — icon swap + identity accent
- `components/dashboards/nurse-dashboard.tsx` — full redesign + Dialog→Sheet + dev text removal + live clock + collapsible export
- `components/nursing/patient-care-list.tsx` — full redesign + shadcn Table + critical highlighting
- `components/nursing/patient-care-view.tsx` — full redesign (Sheet content layout, pill tabs, colored inputs, segmented note categories, history cards)
- `components/patient/triage-form.tsx` — wrapper styling only (see §2.0 boundary definition)

### Files to create
- `lib/vital-formatting.ts` — extracted shared formatting utilities
- `components/nursing/nurse-notification-bell.tsx` — new notification bell component

### Files audited, no changes required
- `lib/nursing-context.tsx` — audit complete; state management, optimistic updates, deduplication, error callbacks all correct
- `lib/vital-signs-validation.ts` — audit complete; age-based thresholds, critical/warning levels all correct; this file is the canonical source for critical vitals detection
- `app/api/vitals/route.ts` — RLS, auth, BP parsing all correct
- `app/api/vitals/latest/route.ts` — DISTINCT ON, filtering, fallback query all correct
- `app/api/vitals/export/route.ts` — CSV/XLSX/PDF export, audit logging all correct
- `app/api/nursing-notes/route.ts` — type mapping, RLS, auth all correct
- `app/api/nursing-notes/latest/route.ts` — DISTINCT ON, filtering all correct
- `app/api/nursing-notes/export/route.ts` — export, audit logging all correct
- `app/api/triage/route.ts` — Zod validation, auto-table-create, category calculation, RLS all correct

Total API routes audited: **9**

### Out of scope
- Other portal dashboards
- Database schema migrations
- `triage-form.tsx` internal logic (see §2.0)

---

## 2.0 Boundary: triage-form.tsx

**Allowed changes:**
- Wrapping the form output in a `bg-violet-50 rounded-2xl p-4` container inside the Triage tab (in `patient-care-view.tsx`, not inside `triage-form.tsx`)
- No live category pill prop is needed — `TriageForm` already renders its own `suggestedCategory` Badge internally
- Restyling the submit button via a CSS descendant wrapper (see §4.4 Triage tab)

**Not allowed:**
- Changing any field, validation logic, Zod schema, calculation logic, or data submission behavior
- Modifying the internal layout of fields within `TriageForm`
- Adding or removing form fields

---

## 2. Bug & Code Quality Fixes

### 2.1 Dev/debug text in production UI

**File:** `components/dashboards/nurse-dashboard.tsx`

| Location (approx. line) | Current text | Replace with |
|---|---|---|
| Hero pill badge (~line 430) | `"Nurse Command Center"` | `"Nurse Portal"` |
| Patient care section subtitle (~line 491) | `"Buttons now open the exact tab requested for the selected patient."` | `"Select a patient to record vitals, add notes, or complete triage."` |
| Patient care badge (~line 492) | Badge: `"Nurse actions stay in nurse flow"` | Remove entirely |
| Shift snapshot card description (~line 473) | `"Notification clicks now open the correct nurse workflow instead of falling into clinician-only paths."` | `"Refreshes every 30 seconds. Range selector drives all summaries and exports."` |
| Export panel description (~line 505) | `"The same range now drives the summary cards, latest vitals table, and exported files."` | Remove; the UI is self-explanatory |

### 2.2 Duplicate formatting utility functions

**Files:** `components/nursing/patient-care-list.tsx` (lines 43–72) and `components/nursing/patient-care-view.tsx` (lines 92–147)

Both files define **identical** implementations (verified byte-for-byte) of: `numInt`, `numFloat`, `fmtBP`, `fmtTemp`, `fmtBpm`, `fmtRR`, `fmtSpO2`, `fmtKg`, `fmtCm`.

**Fix:** Create `lib/vital-formatting.ts` (see §5). Remove inline definitions from both components. Import named functions.

### 2.3 Raw `<table>` in PatientCareList

**File:** `components/nursing/patient-care-list.tsx` (lines 278–380)
Uses raw `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` instead of shadcn components.
No print CSS classes are on this table — safe to replace.

**Fix:** Replace with shadcn `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`. Column structure is preserved: checkbox, P.ID, Name, Age, Sex, Blood Group, Latest Vitals, Actions.

### 2.4 Missing critical vitals highlighting in PatientCareList

**File:** `components/nursing/patient-care-list.tsx`
The Latest Vitals table in `nurse-dashboard.tsx` calls `hasCriticalVitals()` and `parseBloodPressure()` to highlight critical rows. The Patient Care List does not, so nurses have no visual cue that a patient in the care list has critical vitals.

**Fix:** In the row renderer, import `hasCriticalVitals`, `parseBloodPressure` from `lib/vital-signs-validation`. For each patient, call `getLatestVitals(patient.id)` then evaluate:
```typescript
const lv = getLatestVitals(patient.id)
const bp = lv ? parseBloodPressure(lv.bloodPressure ?? "") : { systolic: null, diastolic: null }
const isCritical = lv
  ? hasCriticalVitals({
      temperature: lv.temperature != null ? Number(lv.temperature) : null,
      systolicBP: bp.systolic,
      diastolicBP: bp.diastolic,
      heartRate: lv.heartRate != null ? Number(lv.heartRate) : null,
      respiratoryRate: lv.respiratoryRate != null ? Number(lv.respiratoryRate) : null,
      oxygenSaturation: lv.oxygenSaturation != null ? Number(lv.oxygenSaturation) : null,
    }, patientAge)
  : false
```
Apply `className={isCritical ? "bg-fuchsia-50 border-l-[3px] border-fuchsia-500" : ""}` to the `TableRow`. Add a pulsing fuchsia dot `<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-fuchsia-500 mr-2" />` before the patient name when `isCritical`.

### 2.5 Dialog → Sheet for PatientCareView

**File:** `components/dashboards/nurse-dashboard.tsx` (lines 591–598)

`PatientCareView` is **only rendered in `nurse-dashboard.tsx`** (verified — no other file imports or renders it). The migration is safe.

**Fix:** Replace `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` imports and JSX with `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` from `@/components/ui/sheet`. Props: `side="right"`, `className="w-full sm:w-[80vw] sm:max-w-none overflow-y-auto"`.

**Important:** `SheetContent` has `sm:max-w-sm` hardcoded in its `side="right"` variant. Since `cn()` uses `tailwind-merge`, adding `sm:max-w-none` in `className` properly overrides the built-in constraint. Without `sm:max-w-none`, the sheet will be capped at ~384px on desktop regardless of the `sm:w-[80vw]` class.

### 2.6 Missing nurse notification bell

**File:** New — `components/nursing/nurse-notification-bell.tsx`
The pharmacist portal has `PharmacistNotificationBell`. The nurse portal has no equivalent.

**Fix:** Create `NurseNotificationBell` (see §4.6). Import and render it in the Patient Care card header in `patient-care-list.tsx`.

### 2.7 Settings page DashboardLayout

**Verdict: Not a bug.** Verified that all portal settings pages (`/pharmacist/settings`, `/nurse/settings`, etc.) use `SettingsLayout` directly without `DashboardLayout`. This is the correct consistent pattern. No fix needed.

---

## 3. Color System — "Vital Force"

### 3.1 Color tokens

```
Page background:        #F8F7FF   (pearl white, violet-tinted — apply via className="bg-[#F8F7FF]" on root or use bg-violet-50/30)
Primary / identity:     violet-700   (#6D28D9)
Hero dark start:        violet-950   (#2E1065)
Hero gradient end:      indigo-900   (#312E81)

Critical vitals accent: fuchsia-600  (#C026D3)   — used ONLY for "patient's vitals are outside safe range"
Vitals data accent:     cyan-600     (#0891B2)
Notes accent:           amber-600    (#D97706)

Triage: Emergency:      red-600      (#DC2626)    — distinct from fuchsia; Emergency = red
Triage: Very Urgent:    orange-600   (#EA580C)    — warm orange, not fuchsia (avoids color collision)
Triage: Urgent:         amber-500    (#F59E0B)
Triage: Routine:        emerald-600  (#059669)
Not triaged:            slate-400    (#94A3B8)

Card borders:           violet-100   (#EDE9FE)
Card background:        white        (#FFFFFF)
Violet surface:         violet-50    (#F5F3FF)
Muted text:             slate-500
Body text:              slate-700
```

**Color semantic separation:**
- `fuchsia` = critical vitals (physiological danger — heart rate, BP, SpO2 outside range)
- `red` = Emergency triage category
- `orange` = Very Urgent triage category
- These three are distinct and never overlap in meaning.

### 3.2 Typography tokens

```
Page section label:     text-xs font-semibold uppercase tracking-widest text-violet-400
Section heading:        text-xl font-bold tracking-tight text-slate-900
Card title:             text-base font-semibold text-slate-900
Stat number:            text-4xl font-bold text-slate-900
Table header:           text-xs font-semibold uppercase tracking-widest text-slate-400
Table cell body:        text-sm text-slate-700
Mono (IDs, vitals):     font-mono text-sm
Muted / caption:        text-xs text-slate-500
Error / critical:       text-sm text-fuchsia-600 font-medium
Warning:                text-sm text-amber-600 font-medium
Success:                text-sm text-emerald-600 font-medium
```

### 3.3 Spacing & shape tokens

```
Card border radius:     rounded-2xl  (16px)
Hero border radius:     rounded-[28px]
Icon badge:             rounded-xl p-2
Pill badge:             rounded-full px-3 py-1 text-xs
Input focus ring:       focus-visible:ring-violet-400
Triage row border:      border-l-[3px]  (left accent on table rows)
Sheet width:            w-full sm:w-[80vw]
Card shadow:            shadow-sm
```

---

## 4. Component Designs

### 4.1 Hero Banner (`nurse-dashboard.tsx`)

**Background:** `bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-900`
**Shape:** `rounded-[28px] overflow-hidden`
**Decorative blobs:** `absolute -left-16 top-12 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl` + `absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl`

**Left column:**
- Pill: `"Nurse Portal"` — `bg-white/10 border border-white/15 text-violet-200 text-xs uppercase tracking-[0.28em] rounded-full px-3 py-1`
- Headline: `"Your shift. Your patients. Your command."` — `text-3xl md:text-4xl font-bold text-white`
- Subtext: `"Monitor vitals, document care, and triage patients — all from one place."` — `text-sm md:text-base text-violet-200/90`
- 3 quick-action cards: `bg-white/10 border border-white/15 rounded-2xl p-4 hover:bg-white/15 transition`, each with:
  - Icon (from `quickActions` array, already defined)
  - `ArrowUpRight` that translates `group-hover:translate-x-0.5 group-hover:-translate-y-0.5`
  - Title: `text-sm font-medium text-white`
  - Description: `text-xs text-violet-200/80`

**Right column (Shift Snapshot):**
- Card: `bg-white/12 backdrop-blur border border-white/20 rounded-2xl text-white shadow-none`
- Title: `"Shift Snapshot"` — `text-sm font-semibold text-white/90`
- Date range pill: current range label in `bg-black/20 rounded-full px-3 py-1 text-xs`
- Two stat boxes side by side:
  - Critical Patients: `bg-black/15 rounded-2xl p-4`, label `text-xs uppercase tracking-widest text-fuchsia-300/80`, number `text-3xl font-bold`, pulsing fuchsia dot `animate-pulse` if count > 0
  - Awaiting Triage: same structure, label `text-amber-300/80`
- Thin `border-t border-white/10` divider
- Live clock: `text-2xl font-mono text-white/90`, updated every second via `useEffect` with `setInterval(1000)`
- Description: `"Refreshes every 30 seconds. Range selector drives all summaries and exports."` — `text-xs text-violet-200/60`

### 4.2 Stat Cards Row

Four cards, full width grid `grid gap-4 md:grid-cols-4`. Each card:
```
className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden"
```
Inside: `border-t-4` in accent color at top. Layout: `flex items-start justify-between p-5`.
Left: label `text-xs font-semibold uppercase tracking-widest text-slate-500`, number `text-4xl font-bold text-slate-900 mt-2`, caption `text-xs text-slate-500 mt-1`.
Right: icon badge `rounded-xl p-2` with icon.

| Card | `border-t` | Icon bg | Icon color | Pulse if > 0 |
|---|---|---|---|---|
| Total Patients | `border-violet-500` | `bg-violet-100` | `text-violet-600` | No |
| Vitals Logged | `border-cyan-500` | `bg-cyan-100` | `text-cyan-600` | No |
| Notes Added | `border-amber-500` | `bg-amber-100` | `text-amber-600` | No |
| Critical Watch | `border-fuchsia-500` | `bg-fuchsia-100` | `text-fuchsia-600` | Yes (`animate-pulse` on icon) |

### 4.3 Patient Care List (`patient-care-list.tsx`)

**Card:** `rounded-2xl border-l-4 border-violet-600 shadow-sm bg-white`
**Card header:** flex row, title `"Patient Care"` `text-base font-semibold`, subtitle `"Select a patient to record vitals, add notes, or complete triage."`, `<NurseNotificationBell />` pushed to the right.

**Search:** `focus-visible:ring-violet-400`, Search icon in `text-violet-400`.

**Bulk vitals panel:** `bg-violet-50 border border-violet-200 rounded-2xl p-4`. Header: `text-violet-700 font-semibold`. Submit: `bg-violet-700 hover:bg-violet-800 text-white`. Clear: `variant="outline"`.

**Table columns:** checkbox | P.ID | Name | Age | Sex | Blood | Latest Vitals | Actions
**Table header cells:** `text-xs font-semibold uppercase tracking-widest text-violet-400`

**Row triage border colors** (same hue as triage badges):
| Triage | `TableRow` className |
|---|---|
| Emergency | `border-l-[3px] border-red-500` |
| Very Urgent | `border-l-[3px] border-orange-500` |
| Urgent | `border-l-[3px] border-amber-500` |
| Routine | `border-l-[3px] border-emerald-500` |
| Not triaged | `border-l-[3px] border-slate-200` |

**Critical row:** additionally add `bg-fuchsia-50` + pulsing fuchsia dot before name (see §2.4).

**Latest vitals chips:** each value in `bg-cyan-50 text-cyan-700 text-xs px-1.5 py-0.5 rounded font-mono`.

**Allergy badge:** `bg-red-50 text-red-700 border border-red-200 text-xs rounded-full px-2 py-0.5`.

**Action buttons:**
- Vitals: `<Button size="sm" className="bg-violet-700 hover:bg-violet-800 text-white">`
- Note: `<Button size="sm" variant="outline" className="border-cyan-400 text-cyan-700 hover:bg-cyan-50">`
- Triage: `<Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50">`

**Empty state:** `<Search className="h-8 w-8 text-violet-300 mb-3" />` centered, `text-violet-400`.

**Loading state:** Preserved — existing `Loader2` skeleton behavior kept, but spinner color changed to `text-violet-500`.

**Accessibility:** ARIA labels preserved. Critical rows get `aria-label="Critical vitals"` added to the pulsing dot span.

### 4.4 Patient Care View (`patient-care-view.tsx`) — Sheet

**Ownership clarification:** `PatientCareView` is a plain content component — it returns a `<div>` with no Dialog or Sheet of its own. The `Sheet` wrapper lives entirely in `nurse-dashboard.tsx` (§2.5 and §4.5). §4.4 describes the content layout rendered *inside* `SheetContent` in the dashboard — **not** a new Sheet emitted by `patient-care-view.tsx`. Do **not** add Sheet or Dialog imports to `patient-care-view.tsx`.

**Content root** (what `PatientCareView` returns, rendered as a child of `SheetContent` in `nurse-dashboard.tsx`):

**Sticky header (plain `<div>` — do NOT use shadcn `SheetHeader` here; that lives in the dashboard wrapper):**
```
className="sticky top-0 z-10 bg-white border-b border-violet-100 px-6 py-4"
```
Contents: patient name `font-bold text-lg text-slate-900`, P.ID `font-mono text-sm text-violet-600`, chips for age/gender `bg-violet-50 text-violet-700 text-xs px-2 py-0.5 rounded-full`, blood group chip same style, allergy badge `bg-red-50 text-red-700 border border-red-200`.

**Tab bar:**
```
className="flex gap-1 px-6 pt-4 pb-0 border-b border-violet-100"
```
Each tab button: inactive=`text-violet-600 hover:bg-violet-50 rounded-t-lg px-4 py-2 text-sm font-medium flex items-center gap-2`, active=`bg-violet-700 text-white rounded-t-lg px-4 py-2 text-sm font-medium flex items-center gap-2`. Tabs: `<Activity size={14} /> Vitals`, `<FileText size={14} /> Note`, `<Clock size={14} /> History`, `<AlertCircle size={14} /> Triage`.

**Vitals tab:**
- 2-column grid `grid gap-4 sm:grid-cols-2 p-6`
- Input wrapper for BP/HR/RR/SpO2: `border-l-4 border-cyan-400 pl-3`
- Input wrapper for Temp: `border-l-4 border-amber-400 pl-3`
- Input wrapper for Weight/Height: `border-l-4 border-violet-400 pl-3`
- Validation inline: critical=`text-fuchsia-600 text-xs font-medium`, warning=`text-amber-600 text-xs font-medium`, normal=`text-emerald-600 text-xs font-medium`
- Submit: `bg-violet-700 hover:bg-violet-800 w-full` + keyboard hint `Ctrl+Enter`
- **Loading/error states:** Preserved — existing `savingVitals` spinner and toast error behavior kept
- **Accessibility:** Input `aria-label` attributes preserved. Validation alerts use `role="alert"`.

**Note tab:**
- Category: segmented button group `flex flex-wrap gap-2` (replace `<Select>`):
  - Assessment: `bg-violet-100 text-violet-700 border border-violet-300`
  - Medication: `bg-cyan-100 text-cyan-700 border border-cyan-300`
  - Procedure: `bg-amber-100 text-amber-700 border border-amber-300`
  - Observation: `bg-emerald-100 text-emerald-700 border border-emerald-300`
  - Other: `bg-slate-100 text-slate-700 border border-slate-300`
  - Active state adds `ring-2 ring-offset-1` in matching color
- Textarea: `min-h-[120px]` + character counter `text-xs text-slate-400 text-right`
- Submit: `bg-violet-700 hover:bg-violet-800 w-full`
- **Loading/error states:** `savingNote` spinner and toast error behavior preserved

**History tab:**
- "Vitals History" label: `text-xs font-semibold uppercase tracking-widest text-cyan-500`
- Vitals cards: `border-l-4 border-cyan-400 bg-cyan-50/30 rounded-xl p-4`, header: date/time + nurse name `text-xs text-slate-500`, vitals as chips `bg-cyan-50 text-cyan-700`
- `<Separator className="my-4" />`
- "Notes History" label: `text-xs font-semibold uppercase tracking-widest text-amber-500`
- Notes cards: `border-l-4` in category color (violet/cyan/amber/emerald/slate), `rounded-xl p-4`, header: category + date/time `text-xs text-slate-500`
- **Loading state:** `loadingHistory` spinner preserved

**Triage tab:**
- Wrapper: `bg-violet-50 rounded-2xl p-4 m-4`
- **No external `onCategoryChange` prop needed and none should be added.** `TriageForm` already renders its own live `suggestedCategory` Badge internally (lines 143–145 of triage-form.tsx). The live category display is already handled inside the form. §2.0 boundary is not crossed.
- Submit button: `TriageForm` has a submit Button inside it. Rather than modifying `triage-form.tsx` internals, apply a CSS override via a wrapper `<div className="[&_button[type='submit']]:bg-violet-700 [&_button[type='submit']]:hover:bg-violet-800 [&_button[type='submit']]:w-full">`. If `TriageForm` exposes a `className` prop in future, prefer that.

### 4.5 Latest Vitals Table & Sheet Wrapper (`nurse-dashboard.tsx`)

**Sheet wrapper for PatientCareView** (replaces Dialog — see §2.5):
```tsx
<Sheet open={!!selected} onOpenChange={handleDialogChange}>
  <SheetContent side="right" className="w-full sm:w-[80vw] sm:max-w-none overflow-y-auto p-0">
    <SheetHeader className="sr-only">
      <SheetTitle>Patient Care</SheetTitle>
      <SheetDescription>Record vitals, add nursing notes, complete triage, and review patient care history.</SheetDescription>
    </SheetHeader>
    {selected && <PatientCareView ... />}
  </SheetContent>
</Sheet>
```
The `SheetHeader` is visually hidden (`sr-only`) because `PatientCareView` renders its own sticky header. `SheetTitle` and `SheetDescription` are included for accessibility (shadcn Sheet requires them to avoid console warnings).

**Card:** `rounded-2xl border-l-4 border-cyan-500 overflow-hidden shadow-sm`
**Card header:** `bg-cyan-50/50 border-b border-cyan-100`, flex row with title `"Latest Vitals"` + cyan record count pill `bg-cyan-100 text-cyan-700 text-xs rounded-full px-2 py-0.5` + `<Button variant="ghost" size="icon" onClick={toggleExport}><Download size={16} /></Button>`.

**Filters row:** search (cyan focus ring), triage dropdown (each option has a colored `●` dot inline), Critical Only toggle `bg-fuchsia-600 text-white` when active.

**Table headers:** `text-xs font-semibold uppercase tracking-widest text-slate-400`. Active sort icon: `text-violet-500`.

**Row styles:**
- Critical: `bg-fuchsia-50` + `border-l-[3px] border-fuchsia-500` + pulsing dot before name
- Normal: `hover:bg-violet-50`
- Triage badges:
  - Emergency: `bg-red-100 text-red-700 border border-red-200`
  - Very Urgent: `bg-orange-100 text-orange-700 border border-orange-200`
  - Urgent: `bg-amber-100 text-amber-700 border border-amber-200`
  - Routine: `bg-emerald-100 text-emerald-700 border border-emerald-200`
  - Not triaged: `text-xs text-slate-400`
- Action links: `text-violet-700 font-medium text-sm hover:underline`, `text-cyan-700`, `text-orange-700`

**Empty state:** cyan icon, contextual message.

**Loading state:** existing `Loader2` spinner preserved, `text-cyan-500`.

**Collapsible export panel:**
- State: `const [showExport, setShowExport] = useState(false)` in `nurse-dashboard.tsx`
- Toggle button in card header (Download icon)
- Panel renders below table with `AnimatePresence` or simple `{showExport && ...}` conditional
- Contents: Quick Range selector, From, To, Format — horizontal on desktop, stacked on mobile
- Export Vitals: `bg-cyan-600 hover:bg-cyan-700 text-white`
- Export Notes: `bg-amber-600 hover:bg-amber-700 text-white`
- The standalone export card is **removed** from the dashboard

**Accessibility:** Table `role` attributes preserved. Critical row pulsing dot: `aria-label="Critical vitals detected"`.

### 4.6 Nurse Notification Bell (`nurse-notification-bell.tsx`)

**Component:** `NurseNotificationBell`
**Export:** named export

**Props:** none (self-contained)

**CustomEvent contract:**
```typescript
// Dispatched when user clicks a notification
window.dispatchEvent(
  new CustomEvent("openNursePatientCare", {
    detail: {
      patientId: string,      // UUID of the patient
      initialTab: "triage",   // always "triage" for new patient registrations
      notificationId: string  // notification UUID, used to mark as read
    }
  })
)
```
This matches the existing listener in `nurse-dashboard.tsx` line 283–300 exactly.

**Bell rendering:** `<Button variant="ghost" size="icon" className="relative"><Bell size={16} />{unreadCount > 0 && <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-fuchsia-600 text-white text-[10px] flex items-center justify-center font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>}</Button>`

**Dropdown:** `<Popover>` with `<PopoverContent className="w-80 p-0">`. Header: `"Notifications"` bold + `"Mark all read"` ghost button. List: max 10 items, each: patient name, event label `"New patient registered"`, time ago `text-xs text-slate-400`. Clicking fires CustomEvent + PATCH + closes popover. Empty state: `"No new notifications"` `text-slate-400`.

**Data fetching:**
- On mount: `GET /api/notifications?limit=15` — filter items where `title` includes `"New Patient Registered"`
- Poll every 60 seconds via `setInterval`
- `unreadCount` = count of items where `read === false`
- PATCH `/api/notifications` with `{ ids: [id] }` on click or mark-all

**Loading/error states:** Bell renders normally during load. On fetch error: silent (no toast — bell is a secondary feature). Unread count shows `0` on error.

**Accessibility:** Bell button `aria-label="Notifications"`. Popover `aria-label="Notification list"`. Each item `role="button"` with `aria-label`.

### 4.7 Settings Page (`app/nurse/settings/page.tsx`)

- **DashboardLayout:** Confirmed NOT needed — all portal settings pages use `SettingsLayout` directly. No change needed.
- **Icon:** Change `<Heart className="h-5 w-5" />` to `<Stethoscope className="h-5 w-5 text-violet-600" />`. Update import.
- **Identity accent on SettingsLayout header:** The shared `SettingsLayout` component's header section uses a generic gradient. For the nurse portal, no override is needed at the page level — the icon color change is sufficient to signal identity without forking the shared layout.

---

## 5. New Utility: `lib/vital-formatting.ts`

Extracted from identical implementations in `patient-care-list.tsx` and `patient-care-view.tsx`. Verified identical — safe to consolidate.

```typescript
/** Parse first integer from a string. Returns null if none found. */
export function numInt(s: string): number | null

/** Parse first float from a string (handles comma decimal separator). Returns null if none found. */
export function numFloat(s: string): number | null

/** Format blood pressure string to "120/80". Handles separators: /, -, space. */
export function fmtBP(s: string): string

/** Format temperature. Auto-converts F→C if value > 45. Returns "{n.toFixed(1)} C". */
export function fmtTemp(s: string): string

/** Format heart rate. Returns "{n} bpm". */
export function fmtBpm(s: string): string

/** Format respiratory rate. Returns "{n}/min". */
export function fmtRR(s: string): string

/** Format oxygen saturation. Returns "{n}%". */
export function fmtSpO2(s: string): string

/** Format weight. Auto-converts lbs→kg if "lb" in string. Returns "{n.toFixed(1)} kg". */
export function fmtKg(s: string): string

/** Format height. Handles cm, ft'in", and bare numbers. Returns "{n} cm". */
export function fmtCm(s: string): string
```

---

## 6. Cross-Portal Communication

| Signal | Direction | Mechanism | Status |
|---|---|---|---|
| New patient registered | Receptionist → Nurse | EventSource `/api/notifications/stream` → toast | Verified working |
| Open patient care | Dashboard layout → Nurse | `CustomEvent("openNursePatientCare", {patientId, initialTab, notificationId})` | Verified working; new `NurseNotificationBell` fires same event |
| Mark notification read | Nurse → System | `PATCH /api/notifications` | Verified working |

No new cross-portal signals needed.

---

## 7. API Layer

All 9 API routes audited. **No changes required.** All routes correctly implement:
- RLS via `queryWithSession`
- Permission checks via `can(role, resource, action)`
- Input validation (Zod or manual)
- Audit logging
- Error handling with appropriate HTTP status codes

---

## 8. Implementation Order & Verification

Steps are ordered by dependency. Each step must not break existing functionality before the next begins.

1. **`lib/vital-formatting.ts`** — Create with 9 exported functions (copied from existing implementations)
2. **`components/nursing/nurse-notification-bell.tsx`** — Create new component
3. **`components/nursing/patient-care-list.tsx`** — Redesign + shadcn Table + import from vital-formatting + import NurseNotificationBell + critical highlighting
4. **`components/nursing/patient-care-view.tsx`** — Redesign + import from vital-formatting (Dialog→Sheet is done in step 5)
5. **`components/dashboards/nurse-dashboard.tsx`** — Redesign + Dialog→Sheet + dev text removal + live clock + collapsible export + remove standalone export card
6. **`app/nurse/settings/page.tsx`** — Icon swap only

**Verification gate (step 7):** Run `npm run build`. All TypeScript errors are **blocking** — implementation is not complete until the build passes clean. Any type errors found during build must be resolved before marking complete.
