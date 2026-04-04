# Doctor's Portal — Full Audit, Fix & Polish
## Design Specification

**Date:** 2026-03-30
**Sprint:** Doctor Portal Comprehensive Audit & Redesign
**Baseline:** `2026-03-21-doctor-portal-redesign-design.md` (approved, partially implemented)
**Approach:** Component-by-component — fix AND polish each component before moving to the next
**Roles in scope:** Clinician, Dentist, Midwife, Hospital Admin
**Status:** Approved for implementation

---

## Table of Contents

1. [Overview & Audit Findings](#1-overview--audit-findings)
2. [Implementation Order](#2-implementation-order)
3. [Design Language (Refined)](#3-design-language-refined)
4. [Component 1 — Dashboard](#4-component-1--dashboard-doctor-dashboardtsx)
5. [Component 2 — Patient Queue](#5-component-2--patient-queue-patient-queuetsx)
6. [Component 3 — Consultation Shell](#6-component-3--consultation-shell-patient-consultationtsx)
7. [Components 4–12 — All 9 Consultation Tabs](#7-components-412--all-9-consultation-tabs)
8. [Component 13 — Order Lab Test](#8-component-13--order-lab-test-order-lab-testtsx)
9. [Component 14 — Notification Bell](#9-component-14--notification-bell-clinician-notification-belltsx)
10. [Component 15 — Settings Pages](#10-component-15--settings-pages)
11. [New Backend: Obstetric API](#11-new-backend-obstetric-api)
12. [New Backend: Billing Gate](#12-new-backend-billing-gate)
13. [Routing Fixes](#13-routing-fixes)
14. [Exports](#14-exports)
15. [Inter-Portal Communication Flows](#15-inter-portal-communication-flows)
16. [API Route Inventory](#16-api-route-inventory)

---

## 1. Overview & Audit Findings

### 1.1 Audit Summary

The portal was audited against the March 21 spec. Current completion: **~77%**. All major structural work (tab split, Sheet migration, shadcn Table) is done. The following issues were found:

| Severity | Issue | File |
|---|---|---|
| CRITICAL | `/api/obstetrics/assessments` route does not exist | `history-tab.tsx` calls it |
| HIGH | `order-lab-test.tsx` has 3 `any` types | `order-lab-test.tsx` lines 16, 17, 50 |
| MEDIUM | `/doctor` root page missing | Should redirect to `/clinician` |
| MEDIUM | Tab bar only shows 5 tabs; 9 are implemented | `patient-consultation.tsx` |
| LOW | Notification bell uses polling only; SSE stream unused | `clinician-notification-bell.tsx` |
| LOW | Export buttons unstyled / unverified for all data types | `clinician/page.tsx` |

### 1.2 New Features Added This Sprint

- **Billing Gate**: prescriptions flow cashier → pharmacy, not directly to pharmacy
- **Obstetric API**: create missing `/api/obstetrics/assessments` routes
- **Notification SSE**: upgrade bell from polling-only to SSE-first with polling fallback
- **Tab Bar Expansion**: expose all 9 tabs in the pill tab bar

---

## 2. Implementation Order

Each task = one commit. App must build and function after every commit.

| # | Component | Type | Commit message |
|---|---|---|---|
| 1 | `doctor-dashboard.tsx` | Fix + Polish | `feat(doctor): dashboard polish — shift snapshot, export group, stat card accents` |
| 2 | `patient-queue.tsx` | Polish | `feat(doctor): patient queue polish — row hover, search ring, empty/loading states` |
| 3 | `patient-consultation.tsx` (shell) | Fix + Polish | `feat(doctor): expand tab bar to all 9 tabs, refine sticky header` |
| 4 | `consultation-tab.tsx` | Fix + Polish | `feat(doctor): consultation tab — verify AlertDialog, vitals accents, section labels` |
| 5 | `prescription-tab.tsx` | Fix + Polish | `feat(doctor): prescription tab — billing status chip, amber accents, visit type buttons` |
| 6 | `labs-tab.tsx` | Polish | `feat(doctor): labs tab — critical row highlight, violet accents, status badges` |
| 7 | `history-tab.tsx` | Fix + Polish | `feat(doctor): history tab — emerald accents, obstetric cards` |
| 8 | `/api/obstetrics/assessments` | Fix (new route) | `feat(api): add obstetric assessments route — GET, POST, PATCH` |
| 9 | `dental-tab.tsx` | Polish | `feat(doctor): dental tab — indigo accents, tooth chart textarea` |
| 10 | `allergies-tab.tsx` | Polish | `feat(doctor): allergies tab — severity badge colors, rose accents` |
| 11 | `chronic-conditions-tab.tsx` | Polish | `feat(doctor): conditions tab — status chips, slate accents` |
| 12 | `immunizations-tab.tsx` | Polish | `feat(doctor): immunizations tab — overdue highlight, next-dose chip` |
| 13 | `documents-tab.tsx` | Polish | `feat(doctor): documents tab — upload area, doc type chips` |
| 14 | `order-lab-test.tsx` | Fix + Polish | `fix(doctor): order lab test — remove any types, polish catalog cards` |
| 15 | `clinician-notification-bell.tsx` | Fix + Polish | `feat(doctor): notification bell — SSE-first, unread border accent, notification cards` |
| 16 | Settings pages | Polish | `feat(doctor): settings polish — consistent inputs, section cards, alert dialogs` |
| 17 | Billing gate | New feature | `feat(billing): prescription billing gate — cashier must clear before pharmacy sees rx` |
| 18 | `/api/billing/items/[id]` | New route | `feat(api): billing item PATCH — cashier marks paid, unlocks pharmacy queue` |
| 19 | Routing fixes | Fix | `fix(routing): add /doctor redirect page` |
| 20 | Exports | Fix + Polish | `feat(doctor): exports — verify all data types, styled button group` |
| 21 | Build gate | Verify | `chore: verify build passes post-doctor-portal-audit` |

---

## 3. Design Language (Refined)

Extends the March 21 teal theme. No new colors introduced.

### 3.1 Color Tokens (unchanged from baseline)

| Token | Tailwind | Usage |
|---|---|---|
| Primary | `teal-700` / `teal-800` | Buttons, active tabs, card accents |
| Surface | `white` / `teal-50` | Card backgrounds |
| Vitals accent | `sky-500` / `sky-400` | Vitals input borders, vitals cards |
| Prescription accent | `amber-500` / `amber-400` | Medication cards, Rx buttons |
| Lab accent | `violet-500` / `violet-400` | Lab badges, lab cards |
| Obstetric accent | `emerald-500` / `emerald-400` | OB assessment cards |
| Dental accent | `indigo-500` / `indigo-400` | Dental record cards |
| Critical / Alert | `rose-600` / `rose-500` | Allergy badges, critical rows, alerts |
| Conditions | `slate-500` / `slate-400` | Chronic condition cards |
| Hero gradient | `from-teal-900 via-teal-800 to-cyan-900` | Dashboard hero |

### 3.2 Typography Rules

| Element | Classes |
|---|---|
| Page heading | `text-3xl font-bold tracking-tight` |
| Section heading | `text-xl font-bold tracking-tight text-slate-900` |
| Section label | `text-xs font-semibold uppercase tracking-widest text-<accent>-500` |
| Card title | `text-base font-semibold text-slate-900` |
| Card subtitle | `text-xs text-slate-500` |
| Patient ID | `font-mono text-sm text-teal-600` |
| Info chip | `rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700` |
| Allergy chip | `rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700` |

### 3.3 Shape & Spacing Rules

| Element | Classes |
|---|---|
| Content card | `rounded-2xl border border-teal-100 bg-white shadow-sm` |
| Accented section | `rounded-xl border-l-4 border-<accent>-400 bg-<accent>-50/30 p-4` |
| Content padding | `px-6 py-6` |
| Grid gap | `gap-4` |
| Submit button | `w-full bg-<accent>-700 hover:bg-<accent>-800 text-white` |
| Row action button | `size="sm" variant="outline"` |
| Dashed add button | `border-dashed border-<accent>-400 text-<accent>-700 hover:bg-<accent>-50` |

---

## 4. Component 1 — Dashboard (`doctor-dashboard.tsx`)

### 4.1 Hero Banner (refine existing)

- Keep gradient + blobs + portal pill + headline
- **Shift Snapshot card** (right column):
  ```tsx
  <div className="border border-white/15 bg-white/10 rounded-xl p-4 text-white">
    <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Shift Snapshot</p>
    <p className="mt-2 text-3xl font-bold tabular-nums">{clockTime}</p>
    <div className="mt-3 flex gap-4 text-sm">
      <span>{todayConsultations} consultations</span>
      <span>{pendingLabReviews} pending labs</span>
    </div>
  </div>
  ```
- Clock state:
  ```typescript
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(tick)
  }, [])
  ```

### 4.2 Stat Cards (4-card grid)

Layout: `grid gap-4 md:grid-cols-4`

Each card: `overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm`

| # | Label | Top accent | Icon | Icon bg |
|---|---|---|---|---|
| 1 | Total Patients | `border-t-4 border-teal-500` | `Users` | `bg-teal-100 text-teal-700` |
| 2 | Today's Consultations | `border-t-4 border-sky-500` | `Stethoscope` | `bg-sky-100 text-sky-700` |
| 3 | Active Prescriptions | `border-t-4 border-amber-500` | `Pill` | `bg-amber-100 text-amber-700` |
| 4 | Pending Lab Reviews | `border-t-4 border-violet-500` | `FlaskConical` | `bg-violet-100 text-violet-700` |

Card 4 count: add `animate-pulse` when count > 0.

### 4.3 Export Button Group

Placed top-right of the page, above the hero:
```tsx
<div className="flex rounded-lg overflow-hidden border border-teal-200 divide-x divide-teal-200">
  {["CSV", "XLSX", "PDF"].map((fmt) => (
    <button
      key={fmt}
      onClick={() => handleExport(fmt)}
      disabled={exporting === fmt}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 transition-colors"
    >
      {exporting === fmt
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />
      }
      {fmt}
    </button>
  ))}
</div>
```

### 4.4 Preserved Behaviors

- `openClinicianConsult` custom event listener: **MUST NOT be touched**
- Sheet open/close: **MUST NOT be touched**
- Role-based portal pill title derivation: **MUST NOT be touched**

---

## 5. Component 2 — Patient Queue (`patient-queue.tsx`)

### 5.1 Search Input

```tsx
<Input
  placeholder="Search patients..."
  className="focus-visible:ring-teal-400 border-teal-200 rounded-xl"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
/>
```

### 5.2 Table Refinements

```tsx
<TableRow
  key={p.id}
  className="hover:bg-teal-50/50 transition-colors"
>
  <TableCell className="font-medium text-slate-900">{p.name}</TableCell>
  <TableCell className="font-mono text-sm text-teal-600">{p.patient_id}</TableCell>
  <TableCell className="text-slate-600">{p.age} / {p.gender}</TableCell>
  <TableCell>
    {p.allergies?.length ? (
      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700"
            title={p.allergies.join(", ")}>
        ⚠ {p.allergies.slice(0, 2).join(", ")}{p.allergies.length > 2 ? ` +${p.allergies.length - 2}` : ""}
      </span>
    ) : (
      <span className="text-xs text-slate-400">None</span>
    )}
  </TableCell>
  <TableCell>
    <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white"
            onClick={() => onSelectPatient(p.id)}>
      Consult
    </Button>
  </TableCell>
</TableRow>
```

### 5.3 Empty & Loading States

```tsx
{loading && (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
  </div>
)}
{!loading && patients.length === 0 && (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <Users className="h-10 w-10 text-teal-300" />
    <p className="text-sm text-slate-500">{emptyMessage ?? "No patients in queue."}</p>
  </div>
)}
```

---

## 6. Component 3 — Consultation Shell (`patient-consultation.tsx`)

### 6.1 Full 9-Tab Bar

```typescript
const tabs = [
  { id: "consultation",  label: "Consultation" },
  { id: "prescription",  label: "Prescription" },
  { id: "labs",          label: "Labs" },
  { id: "history",       label: "History" },
  { id: "allergies",     label: "Allergies" },
  { id: "conditions",    label: "Conditions" },
  { id: "immunizations", label: "Immunizations" },
  { id: "documents",     label: "Documents" },
  ...(user.role === "Dentist" ? [{ id: "dental", label: "Dental" }] : []),
] as const

export type ConsultTab =
  | "consultation" | "prescription" | "labs" | "history"
  | "allergies" | "conditions" | "immunizations" | "documents" | "dental"
```

Tab bar: `flex gap-1 border-b border-teal-100 px-6 pt-4 pb-0 overflow-x-auto`

Each pill: `whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium transition-colors`
- Active: `bg-teal-700 text-white`
- Inactive: `text-teal-600 hover:bg-teal-50`

### 6.2 Sticky Patient Header (refine)

Allergy chip shows only if `patient.allergies?.length > 0`. Chip truncates at 2 allergens with `+N` overflow:
```tsx
{patient.allergies?.length > 0 && (
  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs text-rose-700"
        title={patient.allergies.join(", ")}>
    ⚠ Allergies: {patient.allergies.slice(0, 2).join(", ")}
    {patient.allergies.length > 2 ? ` +${patient.allergies.length - 2}` : ""}
  </span>
)}
```

### 6.3 Tab Content Router

```tsx
<div className="px-6 py-6">
  {activeTab === "consultation"  && <ConsultationTab  patient={patient} user={user} />}
  {activeTab === "prescription"  && <PrescriptionTab  patient={patient} user={user} />}
  {activeTab === "labs"          && <LabsTab          patient={patient} user={user} labStream={labStreamRef.current} />}
  {activeTab === "history"       && <HistoryTab       patient={patient} user={user} />}
  {activeTab === "allergies"     && <AllergiesTab     patient={patient} user={user} />}
  {activeTab === "conditions"    && <ChronicConditionsTab patient={patient} user={user} />}
  {activeTab === "immunizations" && <ImmunizationsTab patient={patient} user={user} />}
  {activeTab === "documents"     && <DocumentsTab     patient={patient} user={user} />}
  {activeTab === "dental" && user.role === "Dentist" && <DentalTab patient={patient} user={user} />}
</div>
```

---

## 7. Components 4–12 — All 9 Consultation Tabs

### 7.1 Consultation Tab (`consultation-tab.tsx`)

**Verify these are implemented; fix if not:**
- Vitals grid: `grid gap-4 sm:grid-cols-2`
- BP/HR/RR/SpO2 input accent: `border-l-4 border-sky-400 pl-3`
- Temperature input accent: `border-l-4 border-amber-400 pl-3`
- Section labels: `text-xs font-semibold uppercase tracking-widest text-sky-500` (vitals), `text-teal-500` (clinical)
- All inputs: `focus-visible:ring-teal-400`
- `onBlur` formatters: `fmtBP`, `fmtTemp`, `fmtBpm`, `fmtRR`, `fmtSpO2`
- `AlertDialog` (not `window.confirm`) for critical vitals — rose accent
- Ctrl+Enter keyboard shortcut via `useCallback`
- Submit button: `bg-teal-700 hover:bg-teal-800 w-full text-white`

### 7.2 Prescription Tab (`prescription-tab.tsx`)

**Verify + add billing chip:**
- Visit type segmented buttons: active `bg-teal-700 text-white`, inactive `border-teal-300 text-teal-700 hover:bg-teal-50`
- Medication cards: `rounded-xl border-l-4 border-amber-400 bg-amber-50/30 p-4`
- Section label: `text-xs font-semibold uppercase tracking-widest text-amber-500`
- Add Medication: `border-dashed border-amber-400 text-amber-700 hover:bg-amber-50`
- Save button: `bg-amber-600 hover:bg-amber-700 w-full text-white`
- **New billing chip** after save:
  ```tsx
  {savedPrescription && savedPrescription.visit_type !== "INPATIENT" && (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-xs font-medium",
      billingCleared
        ? "bg-emerald-100 text-emerald-700"
        : "bg-amber-100 text-amber-700"
    )}>
      {billingCleared ? "Cleared for Pharmacy" : "Awaiting Billing Clearance"}
    </span>
  )}
  ```
- Inpatient prescriptions skip billing gate entirely (save directly as `"active"`)

### 7.3 Labs Tab (`labs-tab.tsx`)

**Verify:**
- Order Lab Test button: `bg-violet-700 hover:bg-violet-800 text-white`
- Section label: `text-xs font-semibold uppercase tracking-widest text-violet-500`
- Status badges: Pending `bg-amber-100 text-amber-700`, Completed `bg-emerald-100 text-emerald-700`, Reviewed `bg-teal-100 text-teal-700`
- Critical rows: `bg-rose-50 border-l-[3px] border-rose-500`
- SSE handler updates rows in-place without full reload
- Mark Reviewed button: `variant="outline" border-teal-400 text-teal-700 hover:bg-teal-50`
- Download PDF button: `variant="outline" border-violet-400 text-violet-700 hover:bg-violet-50`

### 7.4 History Tab (`history-tab.tsx`)

Polish (API fix is in Section 11):
- Obstetric section label: `text-xs font-semibold uppercase tracking-widest text-emerald-500`
- Obstetric assessment cards: `rounded-xl border-l-4 border-emerald-400 bg-emerald-50/30 p-4`
- Add Assessment button: `bg-emerald-600 hover:bg-emerald-700 text-white`
- Medical records section label: `text-xs font-semibold uppercase tracking-widest text-teal-500`
- Medical record cards: `rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-4`
- Edit dialog: preserve as-is (shadcn Dialog is acceptable for focused edit actions)

### 7.5 Dental Tab (`dental-tab.tsx`)

- Record cards: `rounded-xl border-l-4 border-indigo-400 bg-indigo-50/30 p-4`
- Section label: `text-xs font-semibold uppercase tracking-widest text-indigo-500`
- Add Record button: `bg-indigo-600 hover:bg-indigo-700 text-white`
- Tooth chart notes: `Textarea` with `focus-visible:ring-indigo-400`
- Edit/Delete visible only when `user.role === "Dentist" || user.role === "Hospital Admin"`

### 7.6 Allergies Tab (`allergies-tab.tsx`)

- Section label: `text-xs font-semibold uppercase tracking-widest text-rose-500`
- Severity badges:
  - mild: `bg-amber-100 text-amber-700`
  - moderate: `bg-orange-100 text-orange-700`
  - severe: `rounded-full border border-rose-200 bg-rose-50 text-rose-700`
- Add Allergy button: `bg-rose-600 hover:bg-rose-700 text-white`

### 7.7 Chronic Conditions Tab (`chronic-conditions-tab.tsx`)

- Cards: `rounded-xl border-l-4 border-slate-400 bg-slate-50/30 p-4`
- Section label: `text-xs font-semibold uppercase tracking-widest text-slate-500`
- Status chips:
  - Active: `bg-rose-100 text-rose-700`
  - Controlled: `bg-emerald-100 text-emerald-700`
  - Resolved: `bg-slate-100 text-slate-600`

### 7.8 Immunizations Tab (`immunizations-tab.tsx`)

- Cards: `rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-4`
- Section label: `text-xs font-semibold uppercase tracking-widest text-teal-500`
- Overdue row: next dose date < today → `bg-amber-50 border-l-[3px] border-amber-400` + `"Overdue"` badge (`bg-amber-100 text-amber-700`)
- Next dose chip: `rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-700`

### 7.9 Documents Tab (`documents-tab.tsx`)

- Upload area: `border-2 border-dashed border-teal-200 rounded-xl p-8 text-center hover:border-teal-400 transition-colors cursor-pointer`
- Upload instruction: `text-sm text-slate-500`
- Document type chips:
  - Lab Report: `bg-violet-100 text-violet-700`
  - Imaging: `bg-sky-100 text-sky-700`
  - Referral: `bg-amber-100 text-amber-700`
  - Other: `bg-slate-100 text-slate-600`
- Each doc row: file icon + filename + upload date + type chip + download `Button size="sm" variant="outline"`

---

## 8. Component 13 — Order Lab Test (`order-lab-test.tsx`)

### 8.1 Type Fixes

Replace all `any` types:

```typescript
// Before (broken)
const [catalog, setCatalog] = useState<any[]>([])
const [selected, setSelected] = useState<any[]>([])
const addTest = (item: any) => { ... }

// After (typed)
interface LabCatalogItem {
  id: string
  loinc_code: string
  test_name: string
  category: string
  turnaround_hours?: number
}

const [catalog, setCatalog] = useState<LabCatalogItem[]>([])
const [selected, setSelected] = useState<LabCatalogItem[]>([])
const addTest = (item: LabCatalogItem) => { ... }
```

### 8.2 Dialog Stays as Dialog

`order-lab-test.tsx` renders a modal form for selecting tests — shadcn `Dialog` is correct here (focused action, not a side panel). The Dialog configuration (`sm:max-w-[1200px]`) is intentional for the catalog grid.

### 8.3 Catalog Card Polish

Each test card in the catalog:
```tsx
<div className="rounded-xl border border-violet-200 bg-violet-50/30 p-3 cursor-pointer
                hover:border-violet-400 hover:bg-violet-50 transition-colors
                data-[selected=true]:border-violet-600 data-[selected=true]:bg-violet-100">
  <p className="text-sm font-medium text-slate-900">{item.test_name}</p>
  <p className="text-xs text-violet-600 font-mono">{item.loinc_code}</p>
  {item.turnaround_hours && (
    <p className="text-xs text-slate-500 mt-1">TAT: {item.turnaround_hours}h</p>
  )}
</div>
```

Order button: `bg-violet-700 hover:bg-violet-800 text-white`

---

## 9. Component 14 — Notification Bell (`clinician-notification-bell.tsx`)

### 9.1 SSE-First Architecture

```typescript
useEffect(() => {
  let polling: ReturnType<typeof setInterval> | null = null

  // Attempt SSE first
  const es = new EventSource("/api/notifications/stream", { withCredentials: true })

  es.onmessage = (e: MessageEvent) => {
    const notification = JSON.parse(e.data)
    setNotifications((prev) => {
      const exists = prev.find((n) => n.id === notification.id)
      if (exists) return prev.map((n) => n.id === notification.id ? notification : n)
      return [notification, ...prev].slice(0, 20)
    })
  }

  es.onerror = () => {
    es.close()
    // Fallback: 60-second polling
    // fetchNotifications must be defined with useCallback outside this effect
    // to avoid stale closure issues
    polling = setInterval(fetchNotifications, 60_000)
    fetchNotifications()
  }

  fetchNotifications() // Initial load regardless

  return () => {
    es.close()
    if (polling) clearInterval(polling)
  }
}, [])
```

### 9.2 Notification Card Design

```tsx
<div className={cn(
  "rounded-lg border-l-4 p-3 transition-colors cursor-pointer hover:bg-slate-50",
  notification.read_at
    ? "border-l-slate-200 bg-white"
    : "border-l-teal-500 bg-teal-50"
)}>
  <div className="flex items-start justify-between gap-2">
    <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
    {!notification.read_at && (
      <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500 mt-1" />
    )}
  </div>
  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{notification.message}</p>
  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(notification.created_at)}</p>
</div>
```

### 9.3 Unread Badge

Bell icon: `text-teal-600` when unread > 0, `text-slate-500` otherwise.
Badge: `absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center`
Count: `unreadCount > 9 ? "9+" : unreadCount`

---

## 10. Component 15 — Settings Pages

### 10.1 All 5 Panels — Consistent Shell

Each panel:
```tsx
<div className="rounded-2xl border border-teal-100 bg-white shadow-sm p-6">
  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
  <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
  <div className="mt-6 space-y-4">
    {/* fields */}
  </div>
  <Button className="mt-6 bg-teal-700 hover:bg-teal-800 text-white w-full">
    Save Changes
  </Button>
</div>
```

### 10.2 Input Consistency

All `<Input>` and `<Textarea>` fields: `focus-visible:ring-teal-400 border-slate-200`
All `<Label>`: `text-sm font-medium text-slate-700`

### 10.3 Destructive Confirmations

Change password and change email flows: replace any `window.confirm` with shadcn `AlertDialog`:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
      Change Email
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Confirm Email Change</AlertDialogTitle>
      <AlertDialogDescription>
        A verification link will be sent to your new email address.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-teal-700 hover:bg-teal-800" onClick={handleEmailChange}>
        Proceed
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 10.4 Notification Preferences

Group toggles by category with `Switch` components:
```tsx
<div className="space-y-4">
  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Lab Results</p>
  <div className="flex items-center justify-between">
    <Label className="text-sm text-slate-700">Critical lab alerts</Label>
    <Switch checked={prefs.criticalLabs} onCheckedChange={(v) => updatePref("criticalLabs", v)} />
  </div>
  {/* repeat per category */}
</div>
```

---

## 11. New Backend: Obstetric API

### 11.1 Route File

**Path:** `app/api/obstetrics/assessments/route.ts`

**Table:** `obstetric_assessments` (already exists in schema from migration `0018`)

### 11.2 GET Handler

```typescript
// GET /api/obstetrics/assessments?patientId=X
// Auth: Clinician, Midwife, Dentist, Hospital Admin
// Returns: ObstetricAssessment[] ordered by created_at DESC
export async function GET(req: NextRequest) {
  const auth = await verifyToken(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const patientId = req.nextUrl.searchParams.get("patientId")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const result = await db.query(
    `SELECT id, patient_id, gravida, parity, gestational_age, edd,
            fundal_height, fetal_heart_rate, presentation, notes,
            created_at, created_by
     FROM obstetric_assessments
     WHERE patient_id = $1
     ORDER BY created_at DESC`,
    [patientId]
  )
  return NextResponse.json(result.rows)
}
```

### 11.3 POST Handler

```typescript
// POST /api/obstetrics/assessments
// Auth: Clinician, Midwife, Hospital Admin
// Body: { patientId, gravida?, parity?, gestationalAge?, edd?, fundalHeight?, fetalHeartRate?, presentation?, notes? }
export async function POST(req: NextRequest) {
  const auth = await verifyToken(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["Clinician", "Midwife", "Hospital Admin"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { patientId, gravida, parity, gestationalAge, edd,
          fundalHeight, fetalHeartRate, presentation, notes } = body

  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const result = await db.query(
    `INSERT INTO obstetric_assessments
       (patient_id, gravida, parity, gestational_age, edd,
        fundal_height, fetal_heart_rate, presentation, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [patientId, gravida, parity, gestationalAge, edd,
     fundalHeight, fetalHeartRate, presentation, notes, auth.userId]
  )
  return NextResponse.json(result.rows[0], { status: 201 })
}
```

### 11.4 PATCH Handler

```typescript
// PATCH /api/obstetrics/assessments?id=X
// Auth: original creator or Hospital Admin
export async function PATCH(req: NextRequest) {
  const auth = await verifyToken(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  // Ownership check
  const existing = await db.query(
    `SELECT created_by FROM obstetric_assessments WHERE id = $1`, [id]
  )
  if (!existing.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.rows[0].created_by !== auth.userId && auth.role !== "Hospital Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  // Explicit field map: camelCase body key → snake_case DB column
  const fieldMap: Record<string, string> = {
    gravida: "gravida", parity: "parity",
    gestationalAge: "gestational_age", edd: "edd",
    fundalHeight: "fundal_height", fetalHeartRate: "fetal_heart_rate",
    presentation: "presentation", notes: "notes",
  }
  const updates = Object.entries(fieldMap).filter(([camel]) => body[camel] !== undefined)
  if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

  const setClauses = updates.map(([, col], i) => `${col} = $${i + 2}`).join(", ")
  const values = [id, ...updates.map(([camel]) => body[camel])]

  const result = await db.query(
    `UPDATE obstetric_assessments SET ${setClauses} WHERE id = $1 RETURNING *`,
    values
  )
  return NextResponse.json(result.rows[0])
}
```

---

## 12. New Backend: Billing Gate

### 12.1 New Migration

**Path:** `migrations/0030_billing_items.sql`

```sql
CREATE TABLE billing_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  item_type       VARCHAR NOT NULL DEFAULT 'prescription',
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  status          VARCHAR NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','waived')),
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMP
);

CREATE INDEX billing_items_patient_idx ON billing_items(patient_id);
CREATE INDEX billing_items_prescription_idx ON billing_items(prescription_id);
CREATE INDEX billing_items_status_idx ON billing_items(status);
```

### 12.2 Prescription Save Change

In `POST /api/medical/prescriptions`:
- OPD / EMERGENCY: save prescription with `status = "pending_payment"`, then insert `billing_items` row
- INPATIENT: save prescription with `status = "active"`, skip billing insert

```typescript
const isPendingBilling = body.visitType !== "INPATIENT"
const prescriptionStatus = isPendingBilling ? "pending_payment" : "active"

// Insert prescription
const rx = await db.query(`INSERT INTO prescriptions ... RETURNING *`, [...])

// Insert billing item (OPD/EMERGENCY only)
if (isPendingBilling) {
  await db.query(
    `INSERT INTO billing_items (patient_id, prescription_id, item_type, description, created_by)
     VALUES ($1, $2, 'prescription', $3, $4)`,
    [body.patientId, rx.rows[0].id, `Prescription — ${rx.rows[0].id}`, auth.userId]
  )
}
```

### 12.3 New API Route: Cashier Marks Paid

**Path:** `app/api/billing/items/[id]/route.ts`

```typescript
// PATCH /api/billing/items/[id]
// Auth: Cashier, Hospital Admin
// Body: { status: "paid" | "waived", amount?: number }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyToken(req)
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["Cashier", "Hospital Admin"].includes(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { status, amount } = await req.json()
  if (!["paid", "waived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const item = await db.query(
    `UPDATE billing_items
     SET status = $1, amount = COALESCE($2, amount), paid_at = NOW()
     WHERE id = $3
     RETURNING prescription_id`,
    [status, amount ?? null, params.id]
  )
  if (!item.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Unlock prescription → pharmacy queue sees it
  if (item.rows[0].prescription_id) {
    await db.query(
      `UPDATE prescriptions SET status = 'active' WHERE id = $1`,
      [item.rows[0].prescription_id]
    )
    // Fire notification to pharmacy role — use same pattern as other API routes
    // (INSERT INTO notifications WHERE user_id IN (SELECT id FROM users WHERE role = 'Pharmacist'))
    await db.query(
      `INSERT INTO notifications (user_id, title, message, payload)
       SELECT id, 'Prescription Ready',
              'A prescription has been cleared for dispensing.',
              $1::jsonb
       FROM users WHERE role = 'Pharmacist' AND is_active = true`,
      [JSON.stringify({ prescriptionId: item.rows[0].prescription_id })]
    )
  }

  return NextResponse.json({ success: true })
}
```

### 12.4 Pharmacy Guard (Verify Existing)

Verify that the pharmacy portal's prescription fetch query includes:
```sql
WHERE status = 'active'
-- This automatically excludes 'pending_payment' prescriptions
```
If it uses `status != 'cancelled'` or has no status filter, add the `status = 'active'` constraint.

---

## 13. Routing Fixes

### 13.1 `/doctor` Root Page

**Path:** `app/doctor/page.tsx`

```typescript
import { redirect } from "next/navigation"
export default function DoctorPage() {
  redirect("/clinician")
}
```

### 13.2 `/doctor/settings` (Verify Existing)

Verify `app/doctor/settings/page.tsx` redirects to `/clinician/settings`. If not:

```typescript
import { redirect } from "next/navigation"
export default function DoctorSettingsPage() {
  redirect("/clinician/settings")
}
```

---

## 14. Exports

### 14.1 Verify Export Scope

The existing export at `app/clinician/page.tsx` lines 32–69 exports medical records. Verify — and extend if needed — to cover:
- Medical records (consultation notes, vitals, diagnosis)
- Prescriptions
- Lab results
- Schedules

If any of these are missing, add them as separate fetch calls within the same export handler, keyed by `format` and `dataType`.

### 14.2 Export Button Group (see Section 4.3 above)

Three-button group: CSV | XLSX | PDF. Loading spinner replaces label while exporting. Date range inputs above the button group.

---

## 15. Inter-Portal Communication Flows

### 15.1 Doctor → Lab (Clinician orders a test)

**Flow:** Doctor opens order dialog → selects tests → submits → lab technician sees order in queue
**Current status:** Implemented. `order-lab-test.tsx` → lab context `orderTest()` → `/api/lab-tests` → lab portal queue.
**Fix needed:** Verify lab portal query does NOT filter by `ordered_by` (lab techs see all orders, not just their own).

### 15.2 Lab → Doctor (Results come back)

**Flow:** Lab completes result → SSE push to doctor's Labs tab → doctor reviews → marks reviewed
**Current status:** Implemented via SSE stream (`/api/lab-tests/stream`).
**Verify:** SSE fires on lab result update; doctor's `labs-tab.tsx` updates row in-place.

### 15.3 Doctor → Pharmacy (via Billing Gate — new)

**Flow:** Doctor saves OPD/Emergency prescription → `pending_payment` → cashier marks paid → prescription flips to `active` → pharmacy queue unlocks → pharmacist dispenses
**Current status:** NEW — billing gate described in Section 12.
**Inpatient bypass:** Inpatient prescriptions go directly to pharmacy (billed at discharge).

### 15.4 Doctor → Nursing (Triaged patient appears in queue)

**Flow:** Nurse triages patient, records vitals → patient appears in doctor's queue
**Current status:** Patient queue (`patient-queue.tsx`) fetches all patients with `triage_status = "waiting"` or similar. Verify the nurse triage action updates the correct status field so the patient appears in the doctor's queue without a page refresh.
**Fix if needed:** Add a `PATCH /api/patients/[id]/status` call in the nursing portal that the doctor's queue polling picks up.

### 15.5 Doctor → Radiology (Imaging orders)

**Flow:** Doctor orders imaging → radiologist sees in their queue → uploads report → doctor sees result
**Current status:** Check if `/api/lab-tests` is used for imaging orders or if a separate radiology API exists. If imaging uses the same lab-tests table with a `category = "imaging"` filter, it's already covered by the labs flow. Verify the radiologist portal's queue fetch and the doctor's labs tab both use the shared table.

---

## 16. API Route Inventory

All routes used by the Doctor's Portal and their current status:

| Route | Methods | Status | Notes |
|---|---|---|---|
| `/api/clinician-schedules` | GET, POST, PATCH, DELETE | ✓ Exists | Schedule CRUD |
| `/api/medical/records` | GET, POST, PATCH | ✓ Exists | Consultation records |
| `/api/medical/prescriptions` | POST, PATCH | ✓ Exists | **Modify**: add billing gate logic |
| `/api/medical/prescription-history` | GET | ✓ Exists | |
| `/api/medical/allergies` | GET, POST, PATCH, DELETE | ✓ Exists | |
| `/api/medical/chronic-conditions` | GET, POST, PATCH, DELETE | ✓ Exists | |
| `/api/medical/immunizations` | GET, POST, PATCH, DELETE | ✓ Exists | |
| `/api/medical/documents` | GET, POST, DELETE | ✓ Exists | |
| `/api/lab-tests/stream` | GET (SSE) | ✓ Exists | |
| `/api/lab-tests/[id]` | GET, PATCH | ✓ Exists | |
| `/api/lab-tests/pdf` | GET | ✓ Exists | |
| `/api/lab-catalog` | GET | ✓ Exists | |
| `/api/obstetrics/assessments` | GET, POST, PATCH | ✗ **CREATE** | See Section 11 |
| `/api/dental/records` | GET, POST, PATCH, DELETE | ✓ Exists | |
| `/api/notifications` | GET, PATCH | ✓ Exists | |
| `/api/notifications/stream` | GET (SSE) | ✓ Exists | |
| `/api/settings/profile` | PATCH | ✓ Exists | |
| `/api/settings/change-password` | PATCH | ✓ Exists | |
| `/api/settings/change-email` | PATCH | ✓ Exists | |
| `/api/settings/notifications` | PATCH | ✓ Exists | |
| `/api/settings/preferences` | PATCH | ✓ Exists | |
| `/api/billing/items/[id]` | PATCH | ✗ **CREATE** | See Section 12 |

---

## Appendix A — Accessibility Checklist

- [ ] Sheet has `sr-only` SheetHeader with descriptive title and description
- [ ] All icon-only buttons have `aria-label`
- [ ] Tab buttons use `role="tab"` and `aria-selected`
- [ ] AlertDialog has focus trap (handled by shadcn)
- [ ] Allergy chip has `title` attribute with full allergy list
- [ ] Loading containers have `aria-busy="true"`
- [ ] Close button has `aria-label="Close consultation panel"`
- [ ] Upload area has `aria-label` for screen readers
- [ ] Switch components have associated `Label` elements

---

## Appendix B — Files Modified / Created

### Modified
- `components/dashboards/doctor-dashboard.tsx`
- `components/doctor/patient-consultation.tsx`
- `components/doctor/patient-queue.tsx`
- `components/doctor/clinician-notification-bell.tsx`
- `components/doctor/order-lab-test.tsx`
- `components/doctor/consultation-tabs/consultation-tab.tsx`
- `components/doctor/consultation-tabs/prescription-tab.tsx`
- `components/doctor/consultation-tabs/labs-tab.tsx`
- `components/doctor/consultation-tabs/history-tab.tsx`
- `components/doctor/consultation-tabs/dental-tab.tsx`
- `components/doctor/consultation-tabs/allergies-tab.tsx`
- `components/doctor/consultation-tabs/chronic-conditions-tab.tsx`
- `components/doctor/consultation-tabs/immunizations-tab.tsx`
- `components/doctor/consultation-tabs/documents-tab.tsx`
- `app/clinician/page.tsx`
- `app/clinician/settings/page.tsx`
- `app/api/medical/prescriptions/route.ts`

### Created
- `app/api/obstetrics/assessments/route.ts`
- `app/api/billing/items/[id]/route.ts`
- `app/doctor/page.tsx`
- `migrations/0030_billing_items.sql`

---

*Spec authored: 2026-03-30 — Dayspring HIS Doctor's Portal Comprehensive Audit & Redesign*
