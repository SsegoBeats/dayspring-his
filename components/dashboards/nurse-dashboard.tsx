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
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
  const [showExport, setShowExport] = useState(false)
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())

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

  useEffect(() => {
    const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <div className="space-y-6">
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

      <div ref={careListRef} className="space-y-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Patient Care</h3>
        </div>
        <PatientCareList onSelectPatient={(id, tab) => openPatientCare(id, (tab as CareTab) || "vitals")} />
      </div>

      <div ref={latestRef}>
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
      </div>

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
    </div>
  )
}
