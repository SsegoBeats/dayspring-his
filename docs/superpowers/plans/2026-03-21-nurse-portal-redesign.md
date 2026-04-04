# Nurse Portal — Vital Force Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully audit, bug-fix, and redesign the Dayspring HIS Nurse Portal with the "Vital Force" identity — pearl white base, deep violet primary, fuchsia critical accent, cyan vitals accent.

**Architecture:** 7 tasks in strict dependency order. Foundation utilities first (vital-formatting, notification bell), then component redesigns bottom-up (care list → care view → dashboard), finally settings and build gate. Each task is a standalone commit that leaves the app in a working state.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui (`Table`, `Sheet`, `Popover`, `Separator`, `Tabs`, `Badge`, `Button`, `Card`), Supabase (via existing API routes — no API changes), `sonner` for toasts, `lucide-react` for icons.

**Spec:** `docs/superpowers/specs/2026-03-21-nurse-portal-redesign-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/vital-formatting.ts` | 9 shared formatting utilities (extracted from care list + care view) |
| Create | `components/nursing/nurse-notification-bell.tsx` | Bell icon, unread badge, popover, fires `openNursePatientCare` CustomEvent |
| Modify | `components/nursing/patient-care-list.tsx` | Full redesign: shadcn Table, triage row borders, critical vitals highlighting, violet styling |
| Modify | `components/nursing/patient-care-view.tsx` | Full redesign: sticky header, pill tabs, colored inputs, segmented note categories, history cards |
| Modify | `components/dashboards/nurse-dashboard.tsx` | Full redesign: hero, stat cards, Dialog→Sheet, dev text removal, live clock, collapsible export |
| Modify | `app/nurse/settings/page.tsx` | Icon swap Heart → Stethoscope violet |

---

## Task 1: Create `lib/vital-formatting.ts`

**Files:**
- Create: `lib/vital-formatting.ts`

Both `patient-care-list.tsx` (lines 43–72) and `patient-care-view.tsx` (lines 92–147) contain byte-for-byte identical formatting functions. This task extracts them to a shared module.

- [ ] **Step 1.1: Create the utility file**

Create `lib/vital-formatting.ts` with this exact content:

```typescript
/** Parse first integer from a string. Returns null if none found. */
export function numInt(s: string): number | null {
  const m = String(s || "").match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Parse first float from a string (handles comma decimal separator). Returns null if none found. */
export function numFloat(s: string): number | null {
  const m = String(s || "").replace(",", ".").match(/-?\d+(?:\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

/** Format blood pressure string to "120/80". Handles separators: /, -, space. */
export function fmtBP(s: string): string {
  const raw = String(s || "")
  const m = raw.match(/(\d+)\D+(\d+)/)
  if (m) return `${m[1]}/${m[2]}`
  const nums = raw.match(/\d+/g)
  if (nums && nums.length >= 2) return `${nums[0]}/${nums[1]}`
  const n = numInt(raw)
  return n == null ? "" : String(n)
}

/** Format temperature. Auto-converts F→C if value > 45. Returns "{n.toFixed(1)} C". */
export function fmtTemp(s: string): string {
  const n = numFloat(s)
  if (n == null) return ""
  const c = n > 45 ? (n - 32) * (5 / 9) : n
  return `${c.toFixed(1)} C`
}

/** Format heart rate. Returns "{n} bpm". */
export function fmtBpm(s: string): string {
  return numInt(s) == null ? "" : `${numInt(s)} bpm`
}

/** Format respiratory rate. Returns "{n}/min". */
export function fmtRR(s: string): string {
  return numInt(s) == null ? "" : `${numInt(s)}/min`
}

/** Format oxygen saturation. Returns "{n}%". */
export function fmtSpO2(s: string): string {
  return numInt(s) == null ? "" : `${numInt(s)}%`
}

/** Format weight. Auto-converts lbs→kg if "lb" in string. Returns "{n.toFixed(1)} kg". */
export function fmtKg(s: string): string {
  const raw = String(s || "").toLowerCase()
  const n = numFloat(raw)
  if (n == null) return ""
  const kg = /lb/.test(raw) ? n * 0.453592 : n
  return `${kg.toFixed(1)} kg`
}

/** Format height. Handles cm, ft'in", and bare numbers. Returns "{n} cm". */
export function fmtCm(s: string): string {
  const raw = String(s || "")
  if (!raw) return ""
  if (/cm/i.test(raw)) {
    const n = numFloat(raw)
    return n == null ? "" : `${n.toFixed(0)} cm`
  }
  const m = raw.match(/(\d+)\s*'\s*(\d+)?/)
  if (m) {
    const ft = parseInt(m[1], 10) || 0
    const inches = parseInt(m[2] || "0", 10) || 0
    const cm = ft * 30.48 + inches * 2.54
    return `${Math.round(cm)} cm`
  }
  const n = numFloat(raw)
  return n == null ? "" : `${n.toFixed(0)} cm`
}
```

- [ ] **Step 1.2: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -30
```

Expected: same errors as before this task (zero new errors introduced). The new file is pure TypeScript with no dependencies — it will compile cleanly.

- [ ] **Step 1.3: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add lib/vital-formatting.ts
git commit -m "feat(nurse): extract shared vital formatting utilities to lib/vital-formatting.ts"
```

---

## Task 2: Create `components/nursing/nurse-notification-bell.tsx`

**Files:**
- Create: `components/nursing/nurse-notification-bell.tsx`

New self-contained notification bell for the nurse portal. Fetches from `/api/notifications`, filters for `"New Patient Registered"` events, shows unread count badge, dispatches `openNursePatientCare` CustomEvent when clicked — matching the existing listener in `nurse-dashboard.tsx` exactly.

The notifications API returns rows with: `id`, `title`, `message`, `payload` (JSONB), `read_at`, `created_at`. Patient ID lives in `payload.patientId` when available.

- [ ] **Step 2.1: Create the component**

Create `components/nursing/nurse-notification-bell.tsx`:

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface NurseNotif {
  id: string
  title: string
  message: string
  payload?: { patientId?: string } | null
  read_at: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  return diff < 60 ? `${diff}m ago` : `${Math.floor(diff / 60)}h ago`
}

export function NurseNotificationBell() {
  const [notifications, setNotifications] = useState<NurseNotif[]>([])
  const [open, setOpen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const list: NurseNotif[] = Array.isArray(data?.notifications) ? data.notifications : []
      setNotifications(
        list.filter((n) => String(n.title || "").includes("New Patient Registered"))
      )
    } catch {
      // silent — bell is non-critical
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    intervalRef.current = setInterval(() => void fetchNotifications(), 60000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchNotifications])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  const handleClick = async (notif: NurseNotif) => {
    const patientId = notif.payload?.patientId
    if (patientId) {
      window.dispatchEvent(
        new CustomEvent("openNursePatientCare", {
          detail: { patientId, initialTab: "triage", notificationId: notif.id },
        })
      )
    }
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notif.id] }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      )
    } catch {
      // silent
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      })
      const now = new Date().toISOString()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    } catch {
      // silent
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Notifications"
        >
          <Bell size={16} className="text-violet-600" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" aria-label="Notification list">
        <div className="flex items-center justify-between border-b border-violet-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 text-xs text-violet-600 hover:text-violet-800"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">No new notifications</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {notifications.slice(0, 10).map((notif) => (
              <button
                key={notif.id}
                type="button"
                aria-label={`Patient notification: ${notif.message}`}
                onClick={() => void handleClick(notif)}
                className={`w-full border-b border-violet-50 px-4 py-3 text-left transition hover:bg-violet-50 ${
                  !notif.read_at ? "bg-fuchsia-50/40" : ""
                }`}
              >
                <div className="text-sm font-medium text-slate-900">
                  {String(notif.message || "").replace(" has been registered.", "")}
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">New patient registered</span>
                  <span className="text-xs text-slate-400">{timeAgo(notif.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2.2: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 2.3: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add components/nursing/nurse-notification-bell.tsx
git commit -m "feat(nurse): add NurseNotificationBell component with fuchsia badge and popover"
```

---

## Task 3: Redesign `components/nursing/patient-care-list.tsx`

**Files:**
- Modify: `components/nursing/patient-care-list.tsx`

Changes in this task:
- Import formatting utilities from `lib/vital-formatting.ts` (removes 9 duplicate inline definitions)
- Import `NurseNotificationBell` for card header
- Replace raw `<table>` with shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`
- Add critical vitals highlighting using `hasCriticalVitals` + `parseBloodPressure`
- Full "Vital Force" visual redesign: violet card border, violet search ring, colored bulk panel, triage row borders, allergy badge, vitals chips, action button colors, empty state

- [ ] **Step 3.1: Write the full redesigned file**

Replace the entire content of `components/nursing/patient-care-list.tsx`:

```typescript
"use client"

import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { useAuth } from "@/lib/auth-context"
import { formatPatientNumber } from "@/lib/patients"
import { hasCriticalVitals, parseBloodPressure } from "@/lib/vital-signs-validation"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2 } from "@/lib/vital-formatting"
import { NurseNotificationBell } from "@/components/nursing/nurse-notification-bell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Stethoscope, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface PatientCareListProps {
  onSelectPatient: (patientId: string, tab?: "vitals" | "notes" | "history" | "triage") => void
}

const TRIAGE_BORDER: Record<string, string> = {
  Emergency: "border-l-[3px] border-red-500",
  "Very Urgent": "border-l-[3px] border-orange-500",
  Urgent: "border-l-[3px] border-amber-500",
  Routine: "border-l-[3px] border-emerald-500",
}

export function PatientCareList({ onSelectPatient }: PatientCareListProps) {
  const { patients, searchPatients, loadingPatients } = usePatients()
  const { getLatestVitals, refreshPatient } = useNursing()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkVitals, setBulkVitals] = useState({
    bloodPressure: "",
    temperature: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    notes: "",
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  const hasAnyBulkField = !!(
    bulkVitals.bloodPressure ||
    bulkVitals.temperature ||
    bulkVitals.heartRate ||
    bulkVitals.respiratoryRate ||
    bulkVitals.oxygenSaturation ||
    bulkVitals.notes
  )

  const displayedPatients = searchQuery ? searchPatients(searchQuery) : patients

  const getPatientAge = (patient: (typeof patients)[number]): number | null => {
    try {
      if (patient.ageYears) return patient.ageYears
      if (!patient.dateOfBirth) return null
      const dob = new Date(patient.dateOfBirth)
      const now = new Date()
      return (
        now.getFullYear() -
        dob.getFullYear() -
        (now.getMonth() < dob.getMonth() ||
        (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
          ? 1
          : 0)
      )
    } catch {
      return null
    }
  }

  if (loadingPatients) {
    return (
      <Card className="rounded-2xl border-l-4 border-violet-600 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Patient Care</CardTitle>
        </CardHeader>
        <CardContent className="py-10">
          <div className="flex items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-500" />
            Loading patients...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-l-4 border-violet-600 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">Patient Care</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">
            Select a patient to record vitals, add notes, or complete triage.
          </p>
        </div>
        <NurseNotificationBell />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
          <Input
            id="patient-care-search"
            name="patientCareSearch"
            aria-label="Search patients"
            placeholder="Search patients by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 focus-visible:ring-violet-400"
          />
        </div>

        {/* Bulk vitals panel */}
        {selectedIds.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-semibold text-violet-700">
              Recording for {selectedIds.length} selected patient{selectedIds.length !== 1 ? "s" : ""}
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <Input
                id="bulk-vitals-bp"
                name="bulkVitalsBloodPressure"
                aria-label="Bulk blood pressure"
                placeholder="BP (e.g., 120/80)"
                value={bulkVitals.bloodPressure}
                onChange={(e) => setBulkVitals({ ...bulkVitals, bloodPressure: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, bloodPressure: fmtBP(v.bloodPressure) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-temp"
                name="bulkVitalsTemperature"
                aria-label="Bulk temperature"
                placeholder="Temp (C)"
                value={bulkVitals.temperature}
                onChange={(e) => setBulkVitals({ ...bulkVitals, temperature: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, temperature: fmtTemp(v.temperature) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-hr"
                name="bulkVitalsHeartRate"
                aria-label="Bulk heart rate"
                placeholder="HR (bpm)"
                value={bulkVitals.heartRate}
                onChange={(e) => setBulkVitals({ ...bulkVitals, heartRate: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, heartRate: fmtBpm(v.heartRate) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-rr"
                name="bulkVitalsRespiratoryRate"
                aria-label="Bulk respiratory rate"
                placeholder="RR (/min)"
                value={bulkVitals.respiratoryRate}
                onChange={(e) => setBulkVitals({ ...bulkVitals, respiratoryRate: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, respiratoryRate: fmtRR(v.respiratoryRate) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-spo2"
                name="bulkVitalsOxygenSaturation"
                aria-label="Bulk oxygen saturation"
                placeholder="SpO2 (%)"
                value={bulkVitals.oxygenSaturation}
                onChange={(e) => setBulkVitals({ ...bulkVitals, oxygenSaturation: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, oxygenSaturation: fmtSpO2(v.oxygenSaturation) }))}
                className="focus-visible:ring-violet-400"
              />
            </div>
            <Input
              id="bulk-vitals-notes"
              name="bulkVitalsNotes"
              placeholder="Notes (optional)"
              value={bulkVitals.notes}
              onChange={(e) => setBulkVitals({ ...bulkVitals, notes: e.target.value })}
              className="focus-visible:ring-violet-400"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedIds([])} disabled={bulkSaving}>
                Clear Selection
              </Button>
              <Button
                className="bg-violet-700 hover:bg-violet-800 text-white"
                onClick={async () => {
                  if (!user) { toast.error("Not authenticated"); return }
                  if (!hasAnyBulkField) { toast.error("Enter at least one vital sign"); return }
                  setBulkSaving(true)
                  let ok = 0
                  let fail = 0
                  const refreshPromises: Promise<void>[] = []
                  try {
                    for (const id of selectedIds) {
                      const patient = patients.find((x) => x.id === id)
                      if (!patient) { fail++; continue }
                      try {
                        const res = await fetch("/api/vitals", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            patientId: id,
                            bloodPressure: bulkVitals.bloodPressure,
                            temperature: bulkVitals.temperature,
                            heartRate: bulkVitals.heartRate,
                            respiratoryRate: bulkVitals.respiratoryRate,
                            oxygenSaturation: bulkVitals.oxygenSaturation,
                            notes: bulkVitals.notes || undefined,
                          }),
                        })
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({}))
                          throw new Error(errorData.error || "Failed to record vitals")
                        }
                        ok++
                        refreshPromises.push(refreshPatient(id).catch(() => {}))
                      } catch (error: any) {
                        fail++
                        toast.error(`Failed for ${patient.firstName} ${patient.lastName}`, {
                          description: error?.message || "Error",
                        })
                      }
                    }
                    await Promise.all(refreshPromises)
                    if (ok) toast.success(`Recorded vitals for ${ok} patient(s)`)
                    if (fail && !ok) toast.error("Failed to record vitals for selected patients")
                    setSelectedIds([])
                    setBulkVitals({ bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", notes: "" })
                  } finally {
                    setBulkSaving(false)
                  }
                }}
                disabled={selectedIds.length === 0 || bulkSaving || !hasAnyBulkField}
              >
                {bulkSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : "Record Vitals"}
              </Button>
            </div>
          </div>
        )}

        {/* Patient table */}
        {displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Search className="mb-3 h-8 w-8 text-violet-300" />
            {searchQuery ? (
              <>
                <p className="text-violet-400">No results for &quot;{searchQuery}&quot;</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              </>
            ) : (
              <p className="text-violet-400">No patients found</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      id="select-all-care"
                      name="selectAllCare"
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === displayedPatients.length}
                      aria-label="Select all"
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? displayedPatients.map((p) => p.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">P.ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Age</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Sex</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Blood</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Latest Vitals</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-violet-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedPatients.map((patient) => {
                  const lv = getLatestVitals(patient.id)
                  const pid = formatPatientNumber(patient.patientNumber)
                  const age = getPatientAge(patient)
                  const triage = String(patient.triageCategory || "").trim()
                  const triseBorderCls = TRIAGE_BORDER[triage] ?? "border-l-[3px] border-slate-200"

                  // Critical vitals detection
                  const bp = lv ? parseBloodPressure(lv.bloodPressure ?? "") : { systolic: null, diastolic: null }
                  const isCritical = lv
                    ? hasCriticalVitals(
                        {
                          temperature: lv.temperature != null ? Number(lv.temperature) : null,
                          systolicBP: bp.systolic,
                          diastolicBP: bp.diastolic,
                          heartRate: lv.heartRate != null ? Number(lv.heartRate) : null,
                          respiratoryRate: lv.respiratoryRate != null ? Number(lv.respiratoryRate) : null,
                          oxygenSaturation: lv.oxygenSaturation != null ? Number(lv.oxygenSaturation) : null,
                        },
                        age
                      )
                    : false

                  const checked = selectedIds.includes(patient.id)

                  return (
                    <TableRow
                      key={patient.id}
                      className={`${triseBorderCls} ${isCritical ? "bg-fuchsia-50" : "hover:bg-violet-50"}`}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          id={`sel-${patient.id}`}
                          name={`select-${patient.id}`}
                          aria-label={`Select patient ${patient.firstName} ${patient.lastName}`}
                          checked={checked}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, patient.id] : prev.filter((x) => x !== patient.id)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pid}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isCritical && (
                            <span
                              className="inline-block h-2 w-2 animate-pulse rounded-full bg-fuchsia-500"
                              aria-label="Critical vitals"
                            />
                          )}
                          <span className="font-medium text-slate-900">
                            {patient.firstName} {patient.lastName}
                          </span>
                          {patient.allergies &&
                            patient.allergies.trim().toLowerCase() !== "none" && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                                Allergies
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{age ?? "-"}</TableCell>
                      <TableCell className="text-sm text-slate-700">{patient.gender}</TableCell>
                      <TableCell className="text-sm text-slate-700">{patient.bloodGroup || "-"}</TableCell>
                      <TableCell>
                        {lv ? (
                          <div className="flex flex-wrap gap-1">
                            {lv.bloodPressure && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                BP {fmtBP(lv.bloodPressure)}
                              </span>
                            )}
                            {lv.temperature && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                {fmtTemp(lv.temperature)}
                              </span>
                            )}
                            {lv.heartRate && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                {fmtBpm(lv.heartRate)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-violet-700 hover:bg-violet-800 text-white"
                            onClick={() => onSelectPatient(patient.id, "vitals")}
                          >
                            <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                            Vitals
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-cyan-400 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => onSelectPatient(patient.id, "notes")}
                          >
                            Note
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-400 text-orange-700 hover:bg-orange-50"
                            onClick={() => onSelectPatient(patient.id, "triage")}
                          >
                            Triage
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3.2: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors. If `lv.bloodPressure`, `lv.temperature`, `lv.heartRate` etc. give type errors (e.g., the VitalSigns type uses different field names), check `lib/nursing-context.tsx` for the `VitalSigns` interface and adjust field access to match.

- [ ] **Step 3.3: Visual spot-check**

Start dev server (`npm run dev`), log in as a Nurse, navigate to `/nurse`. Verify:
- Patient Care card has violet left border
- Notification bell visible top-right of card
- Search bar has violet focus ring
- Table uses shadcn styling (not raw HTML table)
- Triage-colored left borders on patient rows
- If a patient has critical vitals: fuchsia background + pulsing dot

- [ ] **Step 3.4: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add components/nursing/patient-care-list.tsx
git commit -m "feat(nurse): redesign PatientCareList — Vital Force theme, shadcn Table, critical vitals highlighting"
```

---

## Task 4: Redesign `components/nursing/patient-care-view.tsx`

**Files:**
- Modify: `components/nursing/patient-care-view.tsx`

Changes: Remove 9 duplicate inline formatting function definitions (lines 92–147), import from `lib/vital-formatting.ts`. Full visual redesign: sticky patient header, pill-style tab bar, colored input accents, segmented note category buttons (replacing `<Select>`), redesigned history cards.

`PatientCareView` remains a plain content component — it still returns a `<div>`, not a Sheet. The Sheet wrapper stays in `nurse-dashboard.tsx` (Task 5).

- [ ] **Step 4.1: Write the full redesigned file**

Replace the entire content of `components/nursing/patient-care-view.tsx`:

```typescript
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { formatPatientNumber } from "@/lib/patients"
import { Activity, FileText, Clock, AlertCircle, Loader2 } from "lucide-react"
import { TriageForm } from "@/components/patient/triage-form"
import { toast } from "sonner"
import { validateVitalSigns, parseBloodPressure, extractNumericValue } from "@/lib/vital-signs-validation"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2, fmtKg, fmtCm } from "@/lib/vital-formatting"

type CareTab = "vitals" | "notes" | "history" | "triage"

type NoteCategory = "assessment" | "medication" | "procedure" | "observation" | "other"

const NOTE_CATEGORIES: { value: NoteCategory; label: string; cls: string; activeCls: string }[] = [
  { value: "assessment", label: "Assessment", cls: "border border-violet-300 text-violet-700 hover:bg-violet-50", activeCls: "bg-violet-100 border border-violet-400 ring-2 ring-violet-300 ring-offset-1 text-violet-700" },
  { value: "medication", label: "Medication", cls: "border border-cyan-300 text-cyan-700 hover:bg-cyan-50", activeCls: "bg-cyan-100 border border-cyan-400 ring-2 ring-cyan-300 ring-offset-1 text-cyan-700" },
  { value: "procedure", label: "Procedure", cls: "border border-amber-300 text-amber-700 hover:bg-amber-50", activeCls: "bg-amber-100 border border-amber-400 ring-2 ring-amber-300 ring-offset-1 text-amber-700" },
  { value: "observation", label: "Observation", cls: "border border-emerald-300 text-emerald-700 hover:bg-emerald-50", activeCls: "bg-emerald-100 border border-emerald-400 ring-2 ring-emerald-300 ring-offset-1 text-emerald-700" },
  { value: "other", label: "Other", cls: "border border-slate-300 text-slate-600 hover:bg-slate-50", activeCls: "bg-slate-100 border border-slate-400 ring-2 ring-slate-300 ring-offset-1 text-slate-700" },
]

const NOTE_BORDER: Record<NoteCategory, string> = {
  assessment: "border-l-4 border-violet-400",
  medication: "border-l-4 border-cyan-400",
  procedure: "border-l-4 border-amber-400",
  observation: "border-l-4 border-emerald-400",
  other: "border-l-4 border-slate-300",
}

interface PatientCareViewProps {
  patientId: string
  onBack: () => void
  initialTab?: CareTab
  onUpdated?: (details: { patientId: string; activeTab: CareTab; category?: string }) => void
}

export function PatientCareView({ patientId, onBack, initialTab = "vitals", onUpdated }: PatientCareViewProps) {
  const { getPatient } = usePatients()
  const { addVitalSigns, addNursingNote, getPatientVitals, getPatientNotes, prefetchPatient, refreshPatient } = useNursing()
  const { user } = useAuth()
  const patient = getPatient(patientId)

  const [activeTab, setActiveTab] = useState<CareTab>(initialTab)
  const [savingVitals, setSavingVitals] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [vitalAlerts, setVitalAlerts] = useState<Array<{ type: "critical" | "warning" | "normal"; message: string; field: string }>>([])

  const storageKey = `nurse-care-tab:${patientId}`
  const vitalHistory = getPatientVitals(patientId)
  const noteHistory = getPatientNotes(patientId)

  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "",
    oxygenSaturation: "", weight: "", height: "", notes: "",
  })

  const [noteForm, setNoteForm] = useState<{ category: NoteCategory; note: string }>({
    category: "observation",
    note: "",
  })

  useEffect(() => {
    if (initialTab) { setActiveTab(initialTab); return }
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null
      if (saved && ["vitals", "notes", "history", "triage"].includes(saved)) setActiveTab(saved as CareTab)
    } catch {}
  }, [initialTab, storageKey])

  useEffect(() => {
    try { if (typeof window !== "undefined") localStorage.setItem(storageKey, activeTab) } catch {}
  }, [activeTab, storageKey])

  useEffect(() => {
    setLoadingHistory(true)
    prefetchPatient(patientId)
      .catch((error) => { console.error("Failed to prefetch patient:", error); toast.error("Failed to load patient history") })
      .finally(() => setLoadingHistory(false))
  }, [patientId, prefetchPatient])

  const patientAge = patient
    ? (() => {
        try {
          if (patient.ageYears) return patient.ageYears
          if (patient.dateOfBirth) {
            const dob = new Date(patient.dateOfBirth)
            const now = new Date()
            return now.getFullYear() - dob.getFullYear() -
              (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate()) ? 1 : 0)
          }
          return null
        } catch { return null }
      })()
    : null

  useEffect(() => {
    if (!patient) return
    const bp = parseBloodPressure(vitalsForm.bloodPressure)
    const temp = extractNumericValue(vitalsForm.temperature)
    const hr = extractNumericValue(vitalsForm.heartRate)
    const rr = extractNumericValue(vitalsForm.respiratoryRate)
    const spo2 = extractNumericValue(vitalsForm.oxygenSaturation)
    if (temp !== null || bp.systolic !== null || hr !== null || rr !== null || spo2 !== null) {
      setVitalAlerts(validateVitalSigns({ temperature: temp, systolicBP: bp.systolic, diastolicBP: bp.diastolic, heartRate: hr, respiratoryRate: rr, oxygenSaturation: spo2 }, patientAge))
      return
    }
    setVitalAlerts([])
  }, [patient, patientAge, vitalsForm])

  useEffect(() => {
    if (!patient) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (activeTab === "vitals") void commitVitals()
        if (activeTab === "notes") void commitNote()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeTab, patient, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!patient) return
    try {
      const last = vitalHistory[vitalHistory.length - 1]
      if (!last) return
      setVitalsForm((current) => ({
        bloodPressure: current.bloodPressure || last.bloodPressure || "",
        temperature: current.temperature || last.temperature || "",
        heartRate: current.heartRate || last.heartRate || "",
        respiratoryRate: current.respiratoryRate || last.respiratoryRate || "",
        oxygenSaturation: current.oxygenSaturation || last.oxygenSaturation || "",
        weight: current.weight || last.weight || "",
        height: current.height || last.height || "",
        notes: current.notes || "",
      }))
    } catch {}
  }, [patient, patientId, vitalHistory])

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-slate-500">Patient not found</p>
        <Button onClick={onBack} className="mt-4 bg-violet-700 hover:bg-violet-800">Go Back</Button>
      </div>
    )
  }

  const notifyUpdate = (tab: CareTab, category?: string) => {
    onUpdated?.({ patientId: patient.id, activeTab: tab, category })
  }

  const commitVitals = async () => {
    if (!user || !patient) return
    if (!vitalsForm.bloodPressure || !vitalsForm.temperature || !vitalsForm.heartRate || !vitalsForm.respiratoryRate || !vitalsForm.oxygenSaturation) {
      toast.error("Please fill in all required vital sign fields"); return
    }
    const criticalAlerts = vitalAlerts.filter((a) => a.type === "critical")
    if (criticalAlerts.length > 0) {
      const summary = criticalAlerts.map((a) => `- ${a.message}`).join("\n")
      if (!window.confirm(`Warning: critical vital signs detected.\n\n${summary}\n\nProceed?`)) return
    }
    setSavingVitals(true)
    const now = new Date()
    try {
      await addVitalSigns(
        { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, nurseName: user.name,
          date: now.toISOString().split("T")[0], time: now.toTimeString().slice(0, 5),
          bloodPressure: vitalsForm.bloodPressure, temperature: vitalsForm.temperature,
          heartRate: vitalsForm.heartRate, respiratoryRate: vitalsForm.respiratoryRate,
          oxygenSaturation: vitalsForm.oxygenSaturation, weight: vitalsForm.weight,
          height: vitalsForm.height, notes: vitalsForm.notes },
        () => {
          setVitalsForm({ bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", weight: "", height: "", notes: "" })
          setVitalAlerts([])
          toast.success("Vital signs recorded successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("vitals")
        },
        (error) => { toast.error(error.message || "Failed to record vital signs.") }
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to record vital signs.")
    } finally {
      setSavingVitals(false)
    }
  }

  const commitNote = async () => {
    if (!user || !patient || !noteForm.note.trim()) { toast.error("Please enter a nursing note"); return }
    setSavingNote(true)
    const now = new Date()
    try {
      await addNursingNote(
        { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, nurseName: user.name,
          date: now.toISOString().split("T")[0], time: now.toTimeString().slice(0, 5),
          category: noteForm.category, note: noteForm.note },
        () => {
          setNoteForm({ category: "observation", note: "" })
          toast.success("Nursing note added successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("notes")
        },
        (error) => { toast.error(error.message || "Failed to add nursing note.") }
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to add nursing note.")
    } finally {
      setSavingNote(false)
    }
  }

  const TABS: { value: CareTab; label: string; Icon: typeof Activity }[] = [
    { value: "vitals", label: "Vitals", Icon: Activity },
    { value: "notes", label: "Note", Icon: FileText },
    { value: "history", label: "History", Icon: Clock },
    { value: "triage", label: "Triage", Icon: AlertCircle },
  ]

  return (
    <div className="flex flex-col">
      {/* Sticky patient header */}
      <div className="sticky top-0 z-10 border-b border-violet-100 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-slate-900">
            {patient.firstName} {patient.lastName}
          </span>
          <span className="font-mono text-sm text-violet-600">
            {formatPatientNumber(patient.patientNumber)}
          </span>
          {patientAge != null && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patientAge} yrs
            </span>
          )}
          {patient.gender && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patient.gender}
            </span>
          )}
          {patient.bloodGroup && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patient.bloodGroup}
            </span>
          )}
          {patient.allergies && patient.allergies.trim().toLowerCase() !== "none" && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
              ⚠ Allergies: {patient.allergies}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-violet-100 px-6 pt-4">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === value
                ? "bg-violet-700 text-white"
                : "text-violet-600 hover:bg-violet-50"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* ── VITALS TAB ── */}
        {activeTab === "vitals" && (
          <form
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); void commitVitals() }}
            className="space-y-4"
          >
            {/* Validation alerts */}
            {vitalAlerts.filter((a) => a.type === "critical").map((a, idx) => (
              <p key={`crit-${idx}`} role="alert" className="text-sm font-medium text-fuchsia-600">
                ⚠ {a.message}
              </p>
            ))}
            {vitalAlerts.filter((a) => a.type === "warning").map((a, idx) => (
              <p key={`warn-${idx}`} role="alert" className="text-sm font-medium text-amber-600">
                ⚡ {a.message}
              </p>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* BP */}
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="bloodPressure">Blood Pressure *</Label>
                <Input id="bloodPressure" placeholder="120/80" value={vitalsForm.bloodPressure}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, bloodPressure: fmtBP(c.bloodPressure) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Blood pressure" />
              </div>
              {/* Temp */}
              <div className="space-y-1 border-l-4 border-amber-400 pl-3">
                <Label htmlFor="temperature">Temperature *</Label>
                <Input id="temperature" placeholder="37.0 C or 98.6 F" value={vitalsForm.temperature}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, temperature: fmtTemp(c.temperature) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Temperature" />
              </div>
              {/* HR */}
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="heartRate">Heart Rate *</Label>
                <Input id="heartRate" placeholder="72 bpm" value={vitalsForm.heartRate}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, heartRate: fmtBpm(c.heartRate) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Heart rate" />
              </div>
              {/* RR */}
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="respiratoryRate">Respiratory Rate *</Label>
                <Input id="respiratoryRate" placeholder="16/min" value={vitalsForm.respiratoryRate}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, respiratoryRate: fmtRR(c.respiratoryRate) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Respiratory rate" />
              </div>
              {/* SpO2 */}
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="oxygenSaturation">Oxygen Saturation *</Label>
                <Input id="oxygenSaturation" placeholder="98%" value={vitalsForm.oxygenSaturation}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, oxygenSaturation: fmtSpO2(c.oxygenSaturation) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Oxygen saturation" />
              </div>
              {/* Weight */}
              <div className="space-y-1 border-l-4 border-violet-400 pl-3">
                <Label htmlFor="weight">Weight</Label>
                <Input id="weight" placeholder="70 kg" value={vitalsForm.weight}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, weight: c.weight ? fmtKg(c.weight) : "" }))}
                  className="focus-visible:ring-violet-400" aria-label="Weight" />
              </div>
              {/* Height */}
              <div className="space-y-1 border-l-4 border-violet-400 pl-3">
                <Label htmlFor="height">Height</Label>
                <Input id="height" placeholder="170 cm" value={vitalsForm.height}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, height: c.height ? fmtCm(c.height) : "" }))}
                  className="focus-visible:ring-violet-400" aria-label="Height" />
              </div>
              {/* Notes — spans full width */}
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="vitalsNotes">Notes</Label>
                <Textarea id="vitalsNotes" placeholder="Any observations or notes..." rows={3}
                  value={vitalsForm.notes} onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  className="focus-visible:ring-violet-400" />
              </div>
            </div>

            <Button type="submit" className="w-full bg-violet-700 hover:bg-violet-800" disabled={savingVitals}>
              {savingVitals ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : <><Activity className="mr-2 h-4 w-4" />Record Vital Signs</>}
            </Button>
            <p className="text-center text-xs text-slate-400">Tip: Press Ctrl+Enter to submit</p>
          </form>
        )}

        {/* ── NOTES TAB ── */}
        {activeTab === "notes" && (
          <form
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); void commitNote() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Category *</Label>
              <div className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.map(({ value, label, cls, activeCls }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNoteForm((f) => ({ ...f, category: value }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      noteForm.category === value ? activeCls : cls
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note">Nursing Note *</Label>
              <Textarea
                id="note"
                placeholder="Enter detailed nursing note..."
                value={noteForm.note}
                onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                rows={6}
                required
                className="focus-visible:ring-violet-400 min-h-[120px]"
              />
              <p className="text-right text-xs text-slate-400">{noteForm.note.length} chars</p>
            </div>
            <Button
              type="submit"
              className="w-full bg-violet-700 hover:bg-violet-800"
              disabled={savingNote || !noteForm.note.trim()}
            >
              {savingNote ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : <><FileText className="mr-2 h-4 w-4" />Add Nursing Note</>}
            </Button>
            <p className="text-center text-xs text-slate-400">Tip: Press Ctrl+Enter to submit</p>
          </form>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <span className="ml-2 text-slate-500">Loading history...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500">Vitals History</p>
              {vitalHistory.length === 0 ? (
                <p className="text-center text-sm text-slate-400">No vital signs recorded</p>
              ) : (
                vitalHistory.slice().reverse().map((v) => (
                  <div key={v.id} className="rounded-xl border-l-4 border-cyan-400 bg-cyan-50/30 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>{v.date} {v.time}</span>
                      <span>By {v.nurseName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {v.bloodPressure && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">BP {fmtBP(v.bloodPressure)}</span>}
                      {v.temperature && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtTemp(v.temperature)}</span>}
                      {v.heartRate && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtBpm(v.heartRate)}</span>}
                      {v.respiratoryRate && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtRR(v.respiratoryRate)}</span>}
                      {v.oxygenSaturation && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtSpO2(v.oxygenSaturation)}</span>}
                      {v.weight && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtKg(v.weight)}</span>}
                      {v.height && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtCm(v.height)}</span>}
                    </div>
                    {v.notes && <p className="mt-2 text-xs text-slate-600">{v.notes}</p>}
                  </div>
                ))
              )}

              <Separator className="my-4" />

              <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Notes History</p>
              {noteHistory.length === 0 ? (
                <p className="text-center text-sm text-slate-400">No nursing notes</p>
              ) : (
                noteHistory.slice().reverse().map((n) => (
                  <div key={n.id} className={`rounded-xl p-4 ${NOTE_BORDER[n.category as NoteCategory] ?? "border-l-4 border-slate-300"}`}>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium capitalize text-slate-700">{n.category}</span>
                      <span>{n.date} {n.time}</span>
                    </div>
                    <p className="text-sm text-slate-700">{n.note}</p>
                  </div>
                ))
              )}
            </div>
          )
        )}

        {/* ── TRIAGE TAB ── */}
        {activeTab === "triage" && (
          <div className="rounded-2xl bg-violet-50 p-4">
            <div className="[&_button[type='submit']]:w-full [&_button[type='submit']]:bg-violet-700 [&_button[type='submit']]:text-white [&_button[type='submit']]:hover:bg-violet-800">
              <TriageForm
                patientId={patientId}
                onSaved={(category) => {
                  refreshPatient(patientId).catch(() => {})
                  notifyUpdate("triage", category)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4.2: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors. Common issues to watch for:
- If `VitalSigns` interface fields use camelCase (`bloodPressure`, `heartRate`) vs snake_case — check `lib/nursing-context.tsx` type definitions
- If `addVitalSigns` / `addNursingNote` callback signatures differ — check `lib/nursing-context.tsx`

- [ ] **Step 4.3: Visual spot-check**

Open any patient from the care list. Verify:
- Sheet slides in from right at ~80vw on desktop
- Sticky violet-bordered patient header with chips
- Pill-style tab bar (active = violet bg, inactive = violet text)
- Vitals: colored left-border accents per input group
- Notes: segmented category buttons (not dropdown)
- History: cyan vitals cards, amber-labeled notes section with category-colored borders
- Triage: violet bg wrapper, submit button violet

- [ ] **Step 4.4: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add components/nursing/patient-care-view.tsx
git commit -m "feat(nurse): redesign PatientCareView — pill tabs, colored inputs, segmented note categories, history cards"
```

---

## Task 5: Redesign `components/dashboards/nurse-dashboard.tsx`

**Files:**
- Modify: `components/dashboards/nurse-dashboard.tsx`

This is the largest task. Changes:
1. Dev text removal (5 strings)
2. Hero banner redesign (`violet-950→indigo-900` gradient, live clock)
3. Stat cards redesign (white + `border-t-4` + icon badge)
4. Dialog → Sheet (with `sm:max-w-none`)
5. Collapsible export panel inside vitals card (remove standalone export card)
6. Latest vitals table redesign (triage badges, fuchsia critical rows, cyan accent)
7. `showExport` state for collapsible panel

- [ ] **Step 5.1: Add `showExport` state and live clock state**

At the top of the state declarations in `NurseDashboard` (after existing `useState` declarations around line 86), add:

```typescript
const [showExport, setShowExport] = useState(false)
const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())
```

Below the existing `useEffect` blocks, add the clock tick effect:

```typescript
useEffect(() => {
  const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
  return () => clearInterval(tick)
}, [])
```

- [ ] **Step 5.2: Update Dialog import to Sheet**

Find the import block near the top of the file. Replace the Dialog import:

```typescript
// REMOVE this line:
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ADD this line:
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
```

- [ ] **Step 5.3: Replace the hero banner section**

Find the `<section className="relative overflow-hidden rounded-[28px]...">` block (lines ~425–477) and replace it entirely:

```tsx
<section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-900 p-6 text-white shadow-[0_30px_80px_-40px_rgba(46,16,101,0.85)]">
  <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" />
  <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl" />
  <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr]">
    <div className="space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-violet-200">
        Nurse Portal
      </div>
      <div className="space-y-3">
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
          Your shift. Your patients. Your command.
        </h2>
        <p className="max-w-2xl text-sm text-violet-200/90 md:text-base">
          Monitor vitals, document care, and triage patients — all from one place.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon
          if (action.href) {
            return (
              <Link key={action.label} href={action.href} className="group rounded-2xl border border-white/15 bg-white/10 p-4 transition hover:bg-white/15">
                <div className="mb-3 flex items-center justify-between">
                  <Icon className="h-5 w-5 text-violet-200" />
                  <ArrowUpRight className="h-4 w-4 text-violet-200/80 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <div className="text-sm font-medium">{action.label}</div>
                <p className="mt-1 text-xs text-violet-200/80">{action.description}</p>
              </Link>
            )
          }
          return (
            <button key={action.label} type="button" onClick={action.onClick} className="group rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15">
              <div className="mb-3 flex items-center justify-between">
                <Icon className="h-5 w-5 text-violet-200" />
                <ArrowUpRight className="h-4 w-4 text-violet-200/80 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <div className="text-sm font-medium">{action.label}</div>
              <p className="mt-1 text-xs text-violet-200/80">{action.description}</p>
            </button>
          )
        })}
      </div>
    </div>

    {/* Shift Snapshot */}
    <div className="rounded-2xl border border-white/20 bg-white/12 p-5 backdrop-blur">
      <p className="text-sm font-semibold text-white/90">Shift Snapshot</p>
      <div className="mt-3 rounded-full bg-black/20 px-3 py-1 text-xs text-white/80 w-fit">
        {currentRangeLabel}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-black/15 p-4">
          <p className="text-xs uppercase tracking-widest text-fuchsia-300/80">Critical Patients</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-3xl font-bold">{criticalPatientCount}</p>
            {criticalPatientCount > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" />}
          </div>
        </div>
        <div className="rounded-2xl bg-black/15 p-4">
          <p className="text-xs uppercase tracking-widest text-amber-300/80">Awaiting Triage</p>
          <p className="mt-2 text-3xl font-bold">{untriagedCount}</p>
        </div>
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="font-mono text-2xl text-white/90">{clockTime}</p>
        <p className="mt-1 text-xs text-violet-200/60">
          Refreshes every 30 seconds. Range selector drives all summaries and exports.
        </p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 5.4: Replace the 4 stat cards**

Find the `<div className="grid gap-4 md:grid-cols-4">` block (lines ~479–484) and replace it:

```tsx
<div className="grid gap-4 md:grid-cols-4">
  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
    <div className="border-t-4 border-violet-500" />
    <div className="flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total Patients</p>
        <p className="mt-2 text-4xl font-bold text-slate-900">{patients.length}</p>
        <p className="mt-1 text-xs text-slate-500">Under nursing coverage</p>
      </div>
      <div className="rounded-xl bg-violet-100 p-2"><Users className="h-5 w-5 text-violet-600" /></div>
    </div>
  </div>
  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
    <div className="border-t-4 border-cyan-500" />
    <div className="flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Vitals Logged</p>
        <p className="mt-2 text-4xl font-bold text-slate-900">{rangeVitalsCount ?? fallbackVitalsCount}</p>
        <p className="mt-1 text-xs text-slate-500">Across {currentRangeLabel}</p>
      </div>
      <div className="rounded-xl bg-cyan-100 p-2"><Activity className="h-5 w-5 text-cyan-600" /></div>
    </div>
  </div>
  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
    <div className="border-t-4 border-amber-500" />
    <div className="flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Notes Added</p>
        <p className="mt-2 text-4xl font-bold text-slate-900">{rangeNotesCount ?? fallbackNotesCount}</p>
        <p className="mt-1 text-xs text-slate-500">Across {currentRangeLabel}</p>
      </div>
      <div className="rounded-xl bg-amber-100 p-2"><FileText className="h-5 w-5 text-amber-600" /></div>
    </div>
  </div>
  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
    <div className="border-t-4 border-fuchsia-500" />
    <div className="flex items-start justify-between p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Critical Watch</p>
        <p className="mt-2 text-4xl font-bold text-slate-900">{criticalPatientCount}</p>
        <p className="mt-1 text-xs text-slate-500">Latest vitals outside safe range</p>
      </div>
      <div className={`rounded-xl bg-fuchsia-100 p-2 ${criticalPatientCount > 0 ? "animate-pulse" : ""}`}>
        <Clock className="h-5 w-5 text-fuchsia-600" />
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5.5: Fix patient care section — remove dev text and badge**

Find the patient care section heading block (~line 487–493):

```tsx
// REPLACE the entire inner div that has the dev text and badge:
<div>
  <h3 className="text-lg font-semibold text-foreground">Patient care</h3>
  <p className="text-sm text-muted-foreground">Buttons now open the exact tab requested for the selected patient.</p>
</div>
<Badge variant="outline" className="w-fit">Nurse actions stay in nurse flow</Badge>
```

With:

```tsx
<div>
  <h3 className="text-xl font-bold tracking-tight text-slate-900">Patient Care</h3>
</div>
```

- [ ] **Step 5.6: Redesign the Latest Vitals card with collapsible export**

Find the entire `<Card className="overflow-hidden border-teal-200/70...">` export card (lines ~497–508) and **delete it entirely**.

Then find the `<Card className="overflow-hidden border-border/60 shadow-sm">` Latest Vitals card and replace it with:

```tsx
<Card className="overflow-hidden rounded-2xl border-l-4 border-cyan-500 shadow-sm">
  <CardHeader className="border-b border-cyan-100 bg-cyan-50/50">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <CardTitle className="text-base font-semibold">Latest Vitals</CardTitle>
        {sortedVitals.length > 0 && (
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700">
            {sortedVitals.length} records
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-48">
          <Input
            id="nurse-search"
            name="nurseSearch"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or P.ID"
            className="focus-visible:ring-cyan-400"
          />
        </div>
        <Select value={filterTriage || "__all_triage__"} onValueChange={(value) => setFilterTriage(value === "__all_triage__" ? "" : value)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Triage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all_triage__">All Triage</SelectItem>
            <SelectItem value="Emergency"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />Emergency</SelectItem>
            <SelectItem value="Very Urgent"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-orange-500" />Very Urgent</SelectItem>
            <SelectItem value="Urgent"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />Urgent</SelectItem>
            <SelectItem value="Routine"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />Routine</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={filterCritical ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterCritical((v) => !v)}
          className={filterCritical ? "bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-fuchsia-600" : "border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-50"}
        >
          <AlertCircle className="mr-2 h-4 w-4" />Critical Only
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowExport((v) => !v)}
          title="Toggle export panel"
          aria-label="Toggle export panel"
        >
          <Download className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    {/* Collapsible export panel */}
    {showExport && (
      <div className="border-b border-cyan-100 bg-cyan-50/30 px-4 py-4">
        <div className="grid items-end gap-3 md:grid-cols-12">
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="nurse-export-quick-range" className="text-xs font-medium">Quick Range</label>
            <Select value={datePreset} onValueChange={(value: DatePreset) => setDatePreset(value)}>
              <SelectTrigger id="nurse-export-quick-range" aria-label="Quick range"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="nurse-export-from" className="text-xs font-medium">From</label>
            <Input id="nurse-export-from" name="nurseExportFrom" type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom") }}
              disabled={datePreset !== "custom"} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="nurse-export-to" className="text-xs font-medium">To</label>
            <Input id="nurse-export-to" name="nurseExportTo" type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom") }}
              disabled={datePreset !== "custom"} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="nurse-export-format" className="text-xs font-medium">Format</label>
            <Select value={exportFormat} onValueChange={(value: "csv" | "xlsx" | "pdf") => setExportFormat(value)}>
              <SelectTrigger id="nurse-export-format" aria-label="Export format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <Button size="sm" onClick={() => void runExport("vitals")} disabled={exporting !== null}
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              {exporting === "vitals" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export Vitals
            </Button>
            <Button size="sm" onClick={() => void runExport("notes")} disabled={exporting !== null}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              {exporting === "notes" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Export Notes
            </Button>
          </div>
        </div>
      </div>
    )}

    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {(["pid","patient","time","temp","hr","rr","spo2","bp"] as SortColumn[]).map((col) => (
              <TableHead key={col} className="cursor-pointer select-none text-xs font-semibold uppercase tracking-widest text-slate-400" onClick={() => setSort(col)}>
                <div className="flex items-center gap-1">
                  {col.toUpperCase()}
                  {sortBy === col ? (sortOrder === "asc" ? <SortAsc className="h-3 w-3 text-violet-500" /> : <SortDesc className="h-3 w-3 text-violet-500" />) : null}
                </div>
              </TableHead>
            ))}
            <TableHead className="text-xs font-semibold uppercase tracking-widest text-slate-400">Nurse</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-widest text-slate-400">Triage</TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-widest text-slate-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {latestLoading ? (
            <TableRow><TableCell colSpan={11} className="text-center text-sm text-slate-500">
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-cyan-500" />Loading latest vitals...</span>
            </TableCell></TableRow>
          ) : sortedVitals.length === 0 ? (
            <TableRow><TableCell colSpan={11} className="text-center text-sm text-slate-500">
              {q.trim() ? <span>No results for &quot;{q.trim()}&quot;. <button className="text-violet-600 underline" onClick={() => setQ("")}>Clear</button></span>
                : filterCritical || filterTriage ? <span>No vitals match the active filters.</span>
                : <span>No vitals recorded for this range.</span>}
            </TableCell></TableRow>
          ) : (
            sortedVitals.map((row) => {
              const recordedAt = new Date(row.recorded_at || row.created_at || Date.now())
              const minutesAgo = Math.max(0, Math.floor((Date.now() - recordedAt.getTime()) / 60000))
              const relativeTime = minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`
              const pid = formatPatientNumber(row.patient_number)
              const temp = row.temperature != null ? `${Number(row.temperature).toFixed(1)} C` : ""
              const hr = row.heart_rate != null ? `${row.heart_rate} bpm` : ""
              const rr = row.respiratory_rate != null ? `${row.respiratory_rate}/min` : ""
              const spo2 = row.oxygen_saturation != null ? `${row.oxygen_saturation}%` : ""
              const bp = row.blood_pressure_systolic != null && row.blood_pressure_diastolic != null
                ? `${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}` : ""
              const triage = String(row.triage_category || "").trim()
              const critical = isCriticalRow(row)

              const triageBadgeCls =
                triage === "Emergency" ? "bg-red-100 text-red-700 border border-red-200"
                : triage === "Very Urgent" ? "bg-orange-100 text-orange-700 border border-orange-200"
                : triage === "Urgent" ? "bg-amber-100 text-amber-700 border border-amber-200"
                : triage === "Routine" ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : ""

              const onOpenVitals = (e?: React.MouseEvent | React.KeyboardEvent) => { e?.stopPropagation(); openPatientCare(row.patient_id, "vitals") }
              const onOpenNotes = (e?: React.MouseEvent | React.KeyboardEvent) => { e?.stopPropagation(); openPatientCare(row.patient_id, "notes") }
              const onOpenTriage = (e?: React.MouseEvent | React.KeyboardEvent) => { e?.stopPropagation(); openPatientCare(row.patient_id, "triage") }
              const onKeyDown = (e: React.KeyboardEvent) => {
                if (e.key === "Enter") return onOpenVitals(e)
                if (e.key.toLowerCase() === "v") return onOpenVitals(e)
                if (e.key.toLowerCase() === "n") return onOpenNotes(e)
                if (e.key.toLowerCase() === "t") return onOpenTriage(e)
              }

              return (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer ${critical ? "bg-fuchsia-50 border-l-[3px] border-fuchsia-500" : "hover:bg-violet-50"}`}
                  onClick={() => openPatientCare(row.patient_id, "vitals")}
                  tabIndex={0}
                  onKeyDown={onKeyDown}
                  aria-label={`Open patient ${[row.first_name, row.last_name].filter(Boolean).join(" ")}`}
                >
                  <TableCell className="font-mono text-sm">{pid}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {critical && <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-500" aria-label="Critical vitals detected" />}
                      <span>{[row.first_name, row.last_name].filter(Boolean).join(" ")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{recordedAt.toTimeString().slice(0, 5)} <span className="text-xs text-slate-400">— {relativeTime}</span></TableCell>
                  <TableCell className="font-mono text-sm">{temp}</TableCell>
                  <TableCell className="font-mono text-sm">{hr}</TableCell>
                  <TableCell className="font-mono text-sm">{rr}</TableCell>
                  <TableCell className="font-mono text-sm">{spo2}</TableCell>
                  <TableCell className="font-mono text-sm">{bp}</TableCell>
                  <TableCell className="text-sm">{row.nurse_name || <span className="text-xs text-slate-400">—</span>}</TableCell>
                  <TableCell>
                    {triage
                      ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${triageBadgeCls}`}>{triage}</span>
                      : <span className="text-xs text-slate-400">Not triaged</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-3">
                      <button type="button" className="text-sm font-medium text-violet-700 hover:underline" onClick={onOpenVitals} title="Record Vitals (V)">Vitals</button>
                      <button type="button" className="text-sm font-medium text-cyan-700 hover:underline" onClick={onOpenNotes} title="Add Note (N)">Note</button>
                      <button type="button" className="text-sm font-medium text-orange-700 hover:underline" onClick={onOpenTriage} title="Triage (T)">Triage</button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 5.7: Replace Dialog with Sheet**

Find the Dialog block near the end of the `return` (~lines 591–598):

```tsx
// REMOVE:
<Dialog open={!!selected} onOpenChange={handleDialogChange}>
  <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    {selected && <PatientCareView ... />}
  </DialogContent>
</Dialog>

// ADD:
<Sheet open={!!selected} onOpenChange={handleDialogChange}>
  <SheetContent side="right" className="w-full sm:w-[80vw] sm:max-w-none overflow-y-auto p-0">
    <SheetHeader className="sr-only">
      <SheetTitle>Patient Care</SheetTitle>
      <SheetDescription>Record vitals, add nursing notes, complete triage, and review patient care history.</SheetDescription>
    </SheetHeader>
    {selected && (
      <PatientCareView
        key={`${selected.id}:${selected.tab || "vitals"}`}
        patientId={selected.id}
        initialTab={selected.tab || "vitals"}
        onBack={() => handleDialogChange(false)}
        onUpdated={({ patientId }) => { void refreshDashboard(patientId) }}
      />
    )}
  </SheetContent>
</Sheet>
```

- [ ] **Step 5.8: Add missing state and imports if needed**

Ensure `showExport` and `clockTime` states are added (Step 5.1). Ensure `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription` are imported (Step 5.2). The `Download` icon should already be imported; verify it's in the lucide-react import line.

- [ ] **Step 5.9: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors. Common issues:
- `DialogContent` had a `size="xl"` prop — `SheetContent` does not accept `size`. Remove it (width is handled by `className`).
- `clockTime` must be declared as state before `return`

- [ ] **Step 5.10: Visual spot-check**

Verify on `/nurse`:
- Violet-950→indigo-900 hero gradient (not old sky/teal)
- "Nurse Portal" pill (not "Nurse Command Center")
- "Your shift. Your patients. Your command." headline
- Live clock ticking in shift snapshot card
- 4 stat cards: white background, colored top border, icon badge
- Patient care section: no dev badge, correct subtitle
- Latest vitals card: cyan left border, download icon in header
- Clicking download icon toggles export panel inline
- Patient row click opens Sheet (not centered modal) — slides from right
- Standalone export card is gone

- [ ] **Step 5.11: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add components/dashboards/nurse-dashboard.tsx
git commit -m "feat(nurse): full nurse-dashboard redesign — Vital Force theme, Sheet, live clock, collapsible export, dev text removed"
```

---

## Task 6: Update `app/nurse/settings/page.tsx`

**Files:**
- Modify: `app/nurse/settings/page.tsx`

Swap icon from `Heart` to `Stethoscope` in violet.

- [ ] **Step 6.1: Update the icon**

In `app/nurse/settings/page.tsx`, change:

```typescript
// Line 7 — change import:
import { Heart } from "lucide-react"
// to:
import { Stethoscope } from "lucide-react"

// Line 14 — change icon prop:
icon={<Heart className="h-5 w-5" />}
// to:
icon={<Stethoscope className="h-5 w-5 text-violet-600" />}
```

- [ ] **Step 6.2: Verify TypeScript compilation**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 6.3: Commit**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add app/nurse/settings/page.tsx
git commit -m "feat(nurse): swap settings icon Heart → Stethoscope violet for Vital Force identity"
```

---

## Task 7: Final Build Verification

This is the blocking quality gate. All TypeScript errors are **blocking** — the implementation is not complete until `npm run build` passes clean.

- [ ] **Step 7.1: Run the production build**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && npm run build 2>&1
```

Expected: build completes with no TypeScript errors, no missing module errors. Warnings about image optimization or similar non-critical items are acceptable.

- [ ] **Step 7.2: Fix any build errors**

If errors are found:
- **Missing import:** Add the import for the referenced module
- **Type mismatch on `VitalSigns` fields:** Open `lib/nursing-context.tsx`, check the `VitalSigns` interface field names, and update references in `patient-care-list.tsx` / `patient-care-view.tsx`
- **`DialogContent size` prop:** Already handled in Step 5.7 — ensure it is removed
- **`clockTime` used before declaration:** Move `useState` calls to before the `return` statement

- [ ] **Step 7.3: Commit fixes if any**

```bash
cd "c:/Users/ssego/Documents/dayspring-his"
git add -A
git commit -m "fix(nurse): resolve build-time TypeScript errors from redesign"
```

- [ ] **Step 7.4: Push to remote**

```bash
cd "c:/Users/ssego/Documents/dayspring-his" && git push origin main
```

---

## Summary of Changes

| File | Type | Key Changes |
|---|---|---|
| `lib/vital-formatting.ts` | Created | 9 formatting utility functions |
| `components/nursing/nurse-notification-bell.tsx` | Created | Bell, fuchsia badge, popover, CustomEvent dispatch |
| `components/nursing/patient-care-list.tsx` | Modified | Shadcn Table, critical vitals, triage borders, violet theme |
| `components/nursing/patient-care-view.tsx` | Modified | Pill tabs, sticky header, colored inputs, segmented categories |
| `components/dashboards/nurse-dashboard.tsx` | Modified | Hero, stat cards, Sheet, live clock, collapsible export |
| `app/nurse/settings/page.tsx` | Modified | Icon swap only |
