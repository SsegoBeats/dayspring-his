"use client"

import type React from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useNursing } from "@/lib/nursing-context"
import { PatientCareList } from "@/components/nursing/patient-care-list"
import { PatientCareView } from "@/components/nursing/patient-care-view"
import {
  Users,
  Activity,
  FileText,
  Clock,
  SortAsc,
  SortDesc,
  Loader2,
  Download,
  AlertCircle,
  ArrowUpRight,
  HeartPulse,
  ListChecks,
  Settings2,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePatients } from "@/lib/patient-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatPatientNumber } from "@/lib/patients"
import { hasCriticalVitals, parseBloodPressure } from "@/lib/vital-signs-validation"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"

type CareTab = "vitals" | "notes" | "history" | "triage"
type SortColumn = "patient" | "pid" | "time" | "temp" | "hr" | "rr" | "spo2" | "bp"
type DatePreset = "today" | "last7" | "month" | "custom"
type QuickAction =
  | { label: string; description: string; icon: LucideIcon; href: string; onClick?: never }
  | { label: string; description: string; icon: LucideIcon; onClick: () => void; href?: never }

function formatDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function getRangeForPreset(preset: Exclude<DatePreset, "custom">) {
  const today = new Date()
  const end = formatDateInput(today)

  if (preset === "today") return { from: end, to: end }
  if (preset === "last7") {
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    return { from: formatDateInput(start), to: end }
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: formatDateInput(start), to: end }
}

export function NurseDashboard() {
  const { user } = useAuth()
  const { settings, loading: settingsLoading } = useSettings()
  const isEmailVerified = user?.emailVerified !== false
  const { patients, refreshPatients } = usePatients()
  const { vitalSigns, nursingNotes, refreshPatient } = useNursing()

  const [selected, setSelected] = useState<{ id: string; tab?: CareTab } | null>(null)
  const [rangeVitalsCount, setRangeVitalsCount] = useState<number | null>(null)
  const [rangeNotesCount, setRangeNotesCount] = useState<number | null>(null)
  const [latestVitals, setLatestVitals] = useState<any[]>([])
  const [latestLoading, setLatestLoading] = useState(false)
  const [q, setQ] = useState("")
  const [filterTriage, setFilterTriage] = useState("")
  const [filterCritical, setFilterCritical] = useState(false)
  const [sortBy, setSortBy] = useState<SortColumn>("time")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [datePreset, setDatePreset] = useState<DatePreset>("today")
  const initialRange = getRangeForPreset("today")
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv")
  const [exporting, setExporting] = useState<null | "vitals" | "notes">(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const seenNotif = useRef<Set<string>>(new Set())
  const streamPrimed = useRef(false)
  const lastToastRef = useRef<{ vitals?: number; notes?: number; list?: number }>({})
  const careListRef = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (datePreset === "custom") return
    const range = getRangeForPreset(datePreset)
    setDateFrom(range.from)
    setDateTo(range.to)
  }, [datePreset])

  const currentRangeLabel = useMemo(() => (dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`), [dateFrom, dateTo])

  const fallbackVitalsCount = useMemo(
    () => vitalSigns.filter((vs) => vs.date >= dateFrom && vs.date <= dateTo).length,
    [dateFrom, dateTo, vitalSigns],
  )
  const fallbackNotesCount = useMemo(
    () => nursingNotes.filter((note) => note.date >= dateFrom && note.date <= dateTo).length,
    [dateFrom, dateTo, nursingNotes],
  )

  const getPatientAge = useCallback((patientId: string) => {
    const patient = patients.find((item) => item.id === patientId)
    if (!patient) return null
    if (typeof patient.ageYears === "number") return patient.ageYears
    if (!patient.dateOfBirth) return null
    try {
      const dob = new Date(patient.dateOfBirth)
      const now = new Date()
      return now.getFullYear() - dob.getFullYear() - (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate()) ? 1 : 0)
    } catch {
      return null
    }
  }, [patients])

  const isCriticalRow = useCallback((row: any) => {
    const bp = parseBloodPressure(`${row.blood_pressure_systolic || ""}/${row.blood_pressure_diastolic || ""}`)
    return hasCriticalVitals(
      {
        temperature: row.temperature != null ? Number(row.temperature) : null,
        systolicBP: bp.systolic,
        diastolicBP: bp.diastolic,
        heartRate: row.heart_rate != null ? Number(row.heart_rate) : null,
        respiratoryRate: row.respiratory_rate != null ? Number(row.respiratory_rate) : null,
        oxygenSaturation: row.oxygen_saturation != null ? Number(row.oxygen_saturation) : null,
      },
      getPatientAge(row.patient_id),
    )
  }, [getPatientAge])

  useEffect(() => {
    if (!isEmailVerified || !dateFrom || !dateTo) return
    let stop = false

    const loadCounts = async () => {
      try {
        const [vitalsRes, notesRes] = await Promise.all([
          fetch(`/api/vitals/latest?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&summaryOnly=1`, { credentials: "include" }),
          fetch(`/api/nursing-notes/latest?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&summaryOnly=1`, { credentials: "include" }),
        ])

        if (!stop && vitalsRes.ok) {
          const data = await vitalsRes.json().catch(() => ({}))
          if (data?.summary?.count != null) setRangeVitalsCount(Number(data.summary.count))
        }

        if (!stop && notesRes.ok) {
          const data = await notesRes.json().catch(() => ({}))
          if (data?.summary?.count != null) setRangeNotesCount(Number(data.summary.count))
        }
      } catch {
        const now = Date.now()
        if (!lastToastRef.current.vitals || now - lastToastRef.current.vitals > 60000) {
          lastToastRef.current.vitals = now
          toast.error("Failed to load nursing summaries")
        }
      }
    }

    void loadCounts()
    const timer = setInterval(() => void loadCounts(), 30000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [dateFrom, dateTo, isEmailVerified])

  useEffect(() => {
    if (!isEmailVerified || !dateFrom || !dateTo) return
    let stop = false
    const controller = new AbortController()

    const loadLatest = async () => {
      try {
        setLatestLoading(true)
        const url = new URL("/api/vitals/latest", window.location.origin)
        url.searchParams.set("from", dateFrom)
        url.searchParams.set("to", dateTo)
        if (q.trim()) url.searchParams.set("q", q.trim())

        const res = await fetch(url.toString(), { credentials: "include", signal: controller.signal })
        if (!res.ok) return

        const data = await res.json().catch(() => ({}))
        if (!stop && Array.isArray(data?.vitals)) setLatestVitals(data.vitals)
      } catch (error: any) {
        if (error?.name === "AbortError") return
        const now = Date.now()
        if (!lastToastRef.current.list || now - lastToastRef.current.list > 60000) {
          lastToastRef.current.list = now
          toast.error("Failed to load latest vitals list")
        }
      } finally {
        if (!stop) setLatestLoading(false)
      }
    }

    const timer = setTimeout(() => void loadLatest(), 250)
    return () => {
      stop = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [dateFrom, dateTo, isEmailVerified, q, refreshKey])

  useEffect(() => {
    if (!isEmailVerified) return
    try {
      let es: EventSource | null = null
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null
      let mounted = true
      const hasCookie = typeof document !== "undefined" && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      const tokenMatch = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/) : null
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : typeof localStorage !== "undefined" ? localStorage.getItem("session_dev_bearer") : null
      const connect = () => {
        if (!mounted) return
        const url = new URL("/api/notifications/stream", window.location.origin)
        url.searchParams.set("light", "1")
        url.searchParams.set("title", "New Patient Registered")
        url.searchParams.set("limit", "15")
        if (!hasCookie && token) url.searchParams.set("t", token)

        const source = new (window as any).EventSource(url.toString(), { withCredentials: true }) as EventSource
        es = source
        source.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data as string)
            const list = Array.isArray(data?.notifications) ? data.notifications : []
            if (list.length === 0) return
            if (!streamPrimed.current) {
              list.forEach((item: any) => { if (item?.id) seenNotif.current.add(item.id) })
              streamPrimed.current = true
              return
            }

            const newNames: string[] = []
            list.forEach((item: any) => {
              if (!item?.id || seenNotif.current.has(item.id)) return
              if (String(item.title || "").includes("New Patient Registered")) {
                seenNotif.current.add(item.id)
                const name = String(item.message || "").replace(" has been registered.", "")
                if (name) newNames.push(name)
              }
            })

            if (newNames.length === 1) toast.success(`New patient: ${newNames[0]}`)
            else if (newNames.length > 1) toast.success(`${newNames.length} new patients registered`)
          } catch {}
        }
        source.onerror = () => {
          try { source.close() } catch {}
          es = null
          if (mounted && reconnectTimer == null) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null
              connect()
            }, 4000)
          }
        }
      }
      connect()
      return () => {
        mounted = false
        if (reconnectTimer) clearTimeout(reconnectTimer)
        try { es?.close() } catch {}
      }
    } catch {}
  }, [isEmailVerified])

  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      if (!detail?.patientId) return
      setSelected({ id: detail.patientId, tab: (detail.initialTab as CareTab) || "triage" })
      if (detail.notificationId) {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [detail.notificationId] }),
          })
        } catch {}
      }
    }

    window.addEventListener("openNursePatientCare", handler as EventListener)
    return () => window.removeEventListener("openNursePatientCare", handler as EventListener)
  }, [])

  const filteredVitals = useMemo(() => latestVitals.filter((row) => {
    if (filterTriage && row.triage_category !== filterTriage) return false
    if (filterCritical && !isCriticalRow(row)) return false
    return true
  }), [filterCritical, filterTriage, isCriticalRow, latestVitals])

  const sortedVitals = useMemo(() => {
    const getPid = (row: any) => formatPatientNumber(row.patient_number)
    return filteredVitals.slice().sort((a, b) => {
      const timeA = new Date(a.recorded_at || a.created_at || Date.now()).getTime()
      const timeB = new Date(b.recorded_at || b.created_at || Date.now()).getTime()
      const tempA = a.temperature != null ? Number(a.temperature) : Number.NEGATIVE_INFINITY
      const tempB = b.temperature != null ? Number(b.temperature) : Number.NEGATIVE_INFINITY
      const hrA = a.heart_rate != null ? Number(a.heart_rate) : Number.NEGATIVE_INFINITY
      const hrB = b.heart_rate != null ? Number(b.heart_rate) : Number.NEGATIVE_INFINITY
      const rrA = a.respiratory_rate != null ? Number(a.respiratory_rate) : Number.NEGATIVE_INFINITY
      const rrB = b.respiratory_rate != null ? Number(b.respiratory_rate) : Number.NEGATIVE_INFINITY
      const spo2A = a.oxygen_saturation != null ? Number(a.oxygen_saturation) : Number.NEGATIVE_INFINITY
      const spo2B = b.oxygen_saturation != null ? Number(b.oxygen_saturation) : Number.NEGATIVE_INFINITY
      const bpA = a.blood_pressure_systolic != null ? Number(a.blood_pressure_systolic) : Number.NEGATIVE_INFINITY
      const bpB = b.blood_pressure_systolic != null ? Number(b.blood_pressure_systolic) : Number.NEGATIVE_INFINITY
      const patientA = `${a.first_name || ""} ${a.last_name || ""}`.trim().toLowerCase()
      const patientB = `${b.first_name || ""} ${b.last_name || ""}`.trim().toLowerCase()
      const pidA = getPid(a)
      const pidB = getPid(b)

      let cmp = 0
      switch (sortBy) {
        case "patient": cmp = patientA.localeCompare(patientB); break
        case "pid": cmp = pidA.localeCompare(pidB); break
        case "time": cmp = timeA - timeB; break
        case "temp": cmp = tempA - tempB; break
        case "hr": cmp = hrA - hrB; break
        case "rr": cmp = rrA - rrB; break
        case "spo2": cmp = spo2A - spo2B; break
        case "bp": cmp = bpA - bpB; break
      }

      return sortOrder === "asc" ? cmp : -cmp
    })
  }, [filteredVitals, sortBy, sortOrder])

  const criticalPatientCount = useMemo(() => latestVitals.filter((row) => isCriticalRow(row)).length, [isCriticalRow, latestVitals])
  const untriagedCount = useMemo(() => patients.filter((patient) => !patient.triageCategory || !String(patient.triageCategory).trim()).length, [patients])

  const setSort = (column: SortColumn) => {
    setSortBy((current) => {
      if (current === column) {
        setSortOrder((value) => (value === "asc" ? "desc" : "asc"))
        return current
      }
      setSortOrder("desc")
      return column
    })
  }

  const openPatientCare = (patientId: string, tab: CareTab) => setSelected({ id: patientId, tab })
  const refreshDashboard = async (patientId?: string) => {
    if (patientId) await refreshPatient(patientId).catch(() => {})
    await refreshPatients().catch(() => {})
    setRefreshKey((value) => value + 1)
  }

  const handleDialogChange = (open: boolean) => {
    if (open) return
    const patientId = selected?.id
    setSelected(null)
    if (patientId) void refreshDashboard(patientId)
  }

  const runExport = async (dataset: "vitals" | "notes") => {
    if (!dateFrom || !dateTo) return toast.error("Select a valid date range first")
    if (dateFrom > dateTo) return toast.error("The start date cannot be after the end date")

    setExporting(dataset)
    try {
      const endpoint = dataset === "vitals" ? "/api/vitals/export" : "/api/nursing-notes/export"
      const filename = dataset === "vitals" ? "vitals" : "nursing-notes"
      const url = new URL(endpoint, window.location.origin)
      url.searchParams.set("format", exportFormat)
      url.searchParams.set("from", dateFrom)
      url.searchParams.set("to", dateTo)
      const res = await fetch(url.toString(), { credentials: "include" })
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `${filename}-${dateFrom}-to-${dateTo}.${exportFormat}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      toast.success(`${dataset === "vitals" ? "Vitals" : "Nursing notes"} exported successfully`)
    } catch (error: any) {
      toast.error(error?.message || "Export failed")
    } finally {
      setExporting(null)
    }
  }

  const quickActions: QuickAction[] = [
    { label: "Go to patient care", description: "Open the active care list and start charting.", onClick: () => careListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), icon: ListChecks },
    { label: "Review latest vitals", description: "Jump to the real-time vitals table and exceptions.", onClick: () => latestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), icon: HeartPulse },
    { label: "Open settings", description: "Adjust your nurse-specific preferences and alerts.", href: "/nurse/settings", icon: Settings2 },
  ]

  useEffect(() => {
    if (settingsLoading) return
    if (selected) return
    if (settings?.defaultDashboard === "patient-care") {
      careListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (settings?.defaultDashboard === "latest-vitals") {
      latestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selected, settings?.defaultDashboard, settingsLoading])

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-sky-200/50 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.28),_transparent_36%),linear-gradient(135deg,_rgba(8,47,73,1)_0%,_rgba(10,82,119,0.98)_48%,_rgba(16,185,129,0.92)_100%)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(8,47,73,0.85)]">
        <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-sky-100">Nurse Command Center</div>
            <div className="space-y-3">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">Coordinate triage, chart vitals, and keep patient care moving without losing context.</h2>
              <p className="max-w-2xl text-sm text-sky-100/90 md:text-base">The nurse portal is now wired so actions land on the right patient, date filters drive both analytics and exports, and incoming notifications hand off directly into the care workflow.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                if (action.href) {
                  return (
                    <Link key={action.label} href={action.href} className="group rounded-2xl border border-white/15 bg-white/10 p-4 transition hover:bg-white/15">
                      <div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-sky-100" /><ArrowUpRight className="h-4 w-4 text-sky-50/80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
                      <div className="text-sm font-medium">{action.label}</div>
                      <p className="mt-1 text-xs text-sky-100/80">{action.description}</p>
                    </Link>
                  )
                }

                return (
                  <button key={action.label} type="button" onClick={action.onClick} className="group rounded-2xl border border-white/15 bg-white/10 p-4 text-left transition hover:bg-white/15">
                    <div className="mb-3 flex items-center justify-between"><Icon className="h-5 w-5 text-sky-100" /><ArrowUpRight className="h-4 w-4 text-sky-50/80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div>
                    <div className="text-sm font-medium">{action.label}</div>
                    <p className="mt-1 text-xs text-sky-100/80">{action.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <Card className="border-white/15 bg-white/10 text-white shadow-none backdrop-blur">
            <CardHeader className="pb-3"><CardTitle className="text-base">Shift snapshot</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-sky-100/75">Range</p>
                  <p className="mt-1 text-sm font-medium">{currentRangeLabel}</p>
                </div>
                <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">{datePreset}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-[0.22em] text-sky-100/75">Critical patients</p><p className="mt-2 text-3xl font-semibold">{criticalPatientCount}</p></div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-xs uppercase tracking-[0.22em] text-sky-100/75">Awaiting triage</p><p className="mt-2 text-3xl font-semibold">{untriagedCount}</p></div>
              </div>
              <p className="text-xs text-sky-100/75">Notification clicks now open the correct nurse workflow instead of falling into clinician-only paths.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-sky-200/60 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Patients</CardTitle><Users className="h-4 w-4 text-sky-600" /></CardHeader><CardContent><div className="text-3xl font-semibold text-slate-950 dark:text-white">{patients.length}</div><p className="text-xs text-muted-foreground">Under nursing coverage</p></CardContent></Card>
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Vitals Logged</CardTitle><Activity className="h-4 w-4 text-emerald-600" /></CardHeader><CardContent><div className="text-3xl font-semibold text-slate-950 dark:text-white">{rangeVitalsCount ?? fallbackVitalsCount}</div><p className="text-xs text-muted-foreground">Across {currentRangeLabel}</p></CardContent></Card>
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50 via-white to-amber-100/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Notes Added</CardTitle><FileText className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-3xl font-semibold text-slate-950 dark:text-white">{rangeNotesCount ?? fallbackNotesCount}</div><p className="text-xs text-muted-foreground">Across {currentRangeLabel}</p></CardContent></Card>
        <Card className="border-rose-200/60 bg-gradient-to-br from-rose-50 via-white to-rose-100/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Critical Watch</CardTitle><Clock className="h-4 w-4 text-rose-600" /></CardHeader><CardContent><div className="text-3xl font-semibold text-slate-950 dark:text-white">{criticalPatientCount}</div><p className="text-xs text-muted-foreground">Latest vitals outside safe range</p></CardContent></Card>
      </div>

      <div ref={careListRef} className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Patient care</h3>
            <p className="text-sm text-muted-foreground">Buttons now open the exact tab requested for the selected patient.</p>
          </div>
          <Badge variant="outline" className="w-fit">Nurse actions stay in nurse flow</Badge>
        </div>
        <PatientCareList onSelectPatient={(id, tab) => openPatientCare(id, (tab as CareTab) || "vitals")} />
      </div>

      <Card className="overflow-hidden border-teal-200/70 bg-[linear-gradient(180deg,_rgba(240,253,250,0.95),_rgba(255,255,255,1))] shadow-sm dark:bg-[linear-gradient(180deg,_rgba(6,78,59,0.22),_rgba(15,23,42,0.85))]">
        <CardHeader className="border-b border-teal-100/80"><CardTitle className="text-base">Export vitals and notes</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid items-end gap-3 md:grid-cols-12">
            <div className="space-y-1 md:col-span-2"><label htmlFor="nurse-export-quick-range" className="text-xs font-medium">Quick Range</label><Select value={datePreset} onValueChange={(value: DatePreset) => setDatePreset(value)}><SelectTrigger id="nurse-export-quick-range" aria-label="Quick range"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="last7">Last 7 Days</SelectItem><SelectItem value="month">This Month</SelectItem><SelectItem value="custom">Custom</SelectItem></SelectContent></Select></div>
            <div className="space-y-1 md:col-span-2"><label htmlFor="nurse-export-from" className="text-xs font-medium">From</label><Input id="nurse-export-from" name="nurseExportFrom" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom") }} disabled={datePreset !== "custom"} /></div>
            <div className="space-y-1 md:col-span-2"><label htmlFor="nurse-export-to" className="text-xs font-medium">To</label><Input id="nurse-export-to" name="nurseExportTo" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom") }} disabled={datePreset !== "custom"} /></div>
            <div className="space-y-1 md:col-span-2"><label htmlFor="nurse-export-format" className="text-xs font-medium">Format</label><Select value={exportFormat} onValueChange={(value: "csv" | "xlsx" | "pdf") => setExportFormat(value)}><SelectTrigger id="nurse-export-format" aria-label="Export format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="csv">CSV</SelectItem><SelectItem value="xlsx">XLSX</SelectItem><SelectItem value="pdf">PDF</SelectItem></SelectContent></Select></div>
            <div className="space-y-1 md:col-span-4"><p className="text-xs text-muted-foreground">The same range now drives the summary cards, latest vitals table, and exported files.</p><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => void runExport("vitals")} disabled={exporting !== null}>{exporting === "vitals" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export Vitals</Button><Button variant="outline" size="sm" onClick={() => void runExport("notes")} disabled={exporting !== null}>{exporting === "notes" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Export Notes</Button></div></div>
          </div>
        </CardContent>
      </Card>

      <div ref={latestRef}>
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle>Latest Vitals</CardTitle><p className="text-sm text-muted-foreground">Filtered by {currentRangeLabel}</p></div>
            <div className="flex flex-wrap gap-2">
              <div className="w-full sm:w-48"><Input id="nurse-search" name="nurseSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or P.ID" /></div>
              <Select value={filterTriage || "__all_triage__"} onValueChange={(value) => setFilterTriage(value === "__all_triage__" ? "" : value)}><SelectTrigger className="w-40"><SelectValue placeholder="Triage" /></SelectTrigger><SelectContent><SelectItem value="__all_triage__">All Triage</SelectItem><SelectItem value="Emergency">Emergency</SelectItem><SelectItem value="Very Urgent">Very Urgent</SelectItem><SelectItem value="Urgent">Urgent</SelectItem><SelectItem value="Routine">Routine</SelectItem></SelectContent></Select>
              <Button variant={filterCritical ? "default" : "outline"} size="sm" onClick={() => setFilterCritical((value) => !value)}><AlertCircle className={`mr-2 h-4 w-4 ${filterCritical ? "text-white" : ""}`} />Critical Only</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("pid")}><div className="flex items-center gap-1">P.ID{sortBy === "pid" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("patient")}><div className="flex items-center gap-1">Patient{sortBy === "patient" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("time")}><div className="flex items-center gap-1">Time{sortBy === "time" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("temp")}><div className="flex items-center gap-1">Temp{sortBy === "temp" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("hr")}><div className="flex items-center gap-1">HR{sortBy === "hr" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("rr")}><div className="flex items-center gap-1">RR{sortBy === "rr" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("spo2")}><div className="flex items-center gap-1">SpO2{sortBy === "spo2" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => setSort("bp")}><div className="flex items-center gap-1">BP{sortBy === "bp" ? sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" /> : null}</div></TableHead>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Triage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestLoading ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading latest vitals...</span></TableCell></TableRow>
                ) : sortedVitals.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground">{q.trim() ? <span>No results for &quot;{q.trim()}&quot;. <button className="underline" onClick={() => setQ("")}>Clear search</button></span> : filterCritical || filterTriage ? <span>No vitals match the active filters.</span> : <span>No vitals recorded for this range.</span>}</TableCell></TableRow>
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
                    const bp = row.blood_pressure_systolic != null && row.blood_pressure_diastolic != null ? `${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}` : ""
                    const triage = String(row.triage_category || "").trim()
                    const triageVariant = triage === "Emergency" || triage === "Very Urgent" ? "destructive" : triage === "Urgent" ? "default" : "secondary"
                    const onOpenVitals = (event?: React.MouseEvent | React.KeyboardEvent) => { event?.stopPropagation(); openPatientCare(row.patient_id, "vitals") }
                    const onOpenNotes = (event?: React.MouseEvent | React.KeyboardEvent) => { event?.stopPropagation(); openPatientCare(row.patient_id, "notes") }
                    const onOpenTriage = (event?: React.MouseEvent | React.KeyboardEvent) => { event?.stopPropagation(); openPatientCare(row.patient_id, "triage") }
                    const onKeyDown = (event: React.KeyboardEvent) => {
                      if (event.key === "Enter") return onOpenVitals(event)
                      if (event.key.toLowerCase() === "v") return onOpenVitals(event)
                      if (event.key.toLowerCase() === "n") return onOpenNotes(event)
                      if (event.key.toLowerCase() === "t") return onOpenTriage(event)
                    }
                    return (
                      <TableRow key={row.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openPatientCare(row.patient_id, "vitals")} tabIndex={0} onKeyDown={onKeyDown} aria-label={`Open patient ${[row.first_name, row.last_name].filter(Boolean).join(" ")}`}>
                        <TableCell className="font-mono">{pid}</TableCell>
                        <TableCell>{[row.first_name, row.last_name].filter(Boolean).join(" ")}</TableCell>
                        <TableCell>{recordedAt.toTimeString().slice(0, 5)} <span className="text-xs text-muted-foreground">- {relativeTime}</span></TableCell>
                        <TableCell>{temp}</TableCell>
                        <TableCell>{hr}</TableCell>
                        <TableCell>{rr}</TableCell>
                        <TableCell>{spo2}</TableCell>
                        <TableCell>{bp}</TableCell>
                        <TableCell>{row.nurse_name || <span className="text-xs text-muted-foreground">-</span>}</TableCell>
                        <TableCell>{triage ? <Badge variant={triageVariant as any}>{triage}</Badge> : <span className="text-xs text-muted-foreground">Not triaged</span>}</TableCell>
                        <TableCell><div className="flex flex-wrap gap-3"><button type="button" className="text-sky-700 hover:underline" onClick={onOpenVitals} title="Record Vitals (V or Enter)">Record Vitals</button><button type="button" className="text-emerald-700 hover:underline" onClick={onOpenNotes} title="Add Nursing Note (N)">Add Note</button><button type="button" className="text-violet-700 hover:underline" onClick={onOpenTriage} title="Open Triage (T)">Triage</button></div></TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={handleDialogChange}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? (() => { const patient = patients.find((item) => item.id === selected.id); if (!patient) return "Patient Care"; const pid = formatPatientNumber(patient.patientNumber); return `Patient Care - ${patient.firstName} ${patient.lastName} (${pid})` })() : "Patient Care"}</DialogTitle>
            <DialogDescription>Record vitals, add nursing notes, complete triage, and review patient care history.</DialogDescription>
          </DialogHeader>
          {selected && <PatientCareView key={`${selected.id}:${selected.tab || "vitals"}`} patientId={selected.id} initialTab={selected.tab || "vitals"} onBack={() => handleDialogChange(false)} onUpdated={({ patientId }) => { void refreshDashboard(patientId) }} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
