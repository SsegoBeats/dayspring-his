"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PatientList } from "@/components/patient/patient-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, ArrowUpRight, BellRing, Calendar, ClipboardList, Clock3, CreditCard, RefreshCw, Users } from "lucide-react"
import { CheckInPanel } from "@/components/reception/check-in-panel"
import { QueueBoardPro } from "@/components/reception/queue-board-pro"
import { ReceptionRegister } from "@/components/reception/reception-register"
import { PaymentsPanel } from "@/components/reception/payments-panel"
import { ErrorBoundary } from "@/components/error-boundary"
import { useFormatCurrency, useSettings } from "@/lib/settings-context"
import { buildSearchParamsString } from "@/lib/search-params"
import { formatPatientNumber } from "@/lib/patients"
import { ScrollArea } from "@/components/ui/scroll-area"

const RECEPTION_SECTIONS = ["overview", "patients", "checkin", "queue", "payments", "reports"] as const
type ReceptionSection = (typeof RECEPTION_SECTIONS)[number]
const OVERVIEW_LIST_HEIGHT_CLASS = "h-[26rem]"

type CheckinRow = {
  id: string
  status: string
  created_at: string
  patient_id: string
  first_name: string
  last_name: string
  patient_number: string
}

type QueueRow = {
  id: string
  patient_id: string
  first_name: string
  last_name: string
  patient_number: string
  waiting_minutes?: number
  in_service_minutes?: number
  department: string
}

type PaymentRow = {
  id: string
  receipt_no: string
  amount: number
  method: string
  created_at: string
  first_name: string
  last_name: string
  patient_number: string
}

type DepartmentPressureRow = {
  department: string
  waitingCount: number
  inServiceCount: number
  longestWaitMinutes: number
  totalPatients: number
}

type OverviewTone = "critical" | "watch" | "calm"

type OverviewStatus = {
  label: string
  tone: OverviewTone
  detail: string
}

type AttentionItem = {
  title: string
  detail: string
  actionLabel: string
  tone: OverviewTone
  onClick: () => void
}

type ActivityFeedItem = {
  id: string
  title: string
  detail: string
  timestamp: number
  onClick: () => void
  accent: "sky" | "emerald"
}

function isReceptionSection(value: string | null | undefined): value is ReceptionSection {
  return Boolean(value && RECEPTION_SECTIONS.includes(value as ReceptionSection))
}

function buildTodayRange() {
  const today = new Date().toISOString().split("T")[0]
  return {
    today,
    from: new Date(`${today}T00:00:00Z`).toISOString(),
    to: new Date(`${today}T23:59:59Z`).toISOString(),
  }
}

function getSafeTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function parseAppointmentDateTime(date: string, time?: string | null) {
  if (!date) return null
  const normalizedTime = time?.trim() || "00:00"
  const isoCandidate = new Date(`${date}T${normalizedTime}`)
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate
  const fallback = new Date(`${date} ${normalizedTime}`)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

export function ReceptionistDashboard() {
  const {
    patients,
    appointments,
    loadingPatients,
    loadingAppointments,
    patientsLoadError,
    appointmentsLoadError,
    refreshPatients,
    refreshAppointments,
  } = usePatients()
  const { settings, loading: settingsLoading } = useSettings()
  const formatCurrency = useFormatCurrency()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get("section")
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<ReceptionSection>("overview")
  const [focusPatientId, setFocusPatientId] = useState<string | undefined>(undefined)
  const [refreshingOverview, setRefreshingOverview] = useState(false)
  const [opsLoading, setOpsLoading] = useState(true)
  const [opsError, setOpsError] = useState<string | null>(null)
  const [arrivals, setArrivals] = useState<CheckinRow[]>([])
  const [waitingQueue, setWaitingQueue] = useState<QueueRow[]>([])
  const [inServiceQueue, setInServiceQueue] = useState<QueueRow[]>([])
  const [todayPayments, setTodayPayments] = useState<PaymentRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const scrollWorkspaceIntoView = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior, block: "start" })
    })
  }, [])

  const syncSection = useCallback((next: ReceptionSection) => {
    setActiveTab(next)
    const params = buildSearchParamsString(searchParams, { section: next === "overview" ? null : next })
    const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
    const target = params ? `${pathname}?${params}` : pathname

    if (target !== current) {
      router.replace(target, { scroll: false })
      return
    }

    if (next !== "overview") {
      scrollWorkspaceIntoView()
    }
  }, [pathname, router, scrollWorkspaceIntoView, searchParams])

  const todayAppointments = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    return appointments.filter((appointment) => appointment.date === today && appointment.status === "scheduled")
  }, [appointments])

  const queueAverageWait = useMemo(() => {
    const values = waitingQueue.map((entry) => Number(entry.waiting_minutes || 0)).filter((value) => value > 0)
    if (!values.length) return 0
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  }, [waitingQueue])

  const paymentsTotal = useMemo(
    () => todayPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [todayPayments],
  )

  const arrivalsLastHour = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    return arrivals.filter((arrival) => getSafeTimestamp(arrival.created_at) >= oneHourAgo).length
  }, [arrivals])

  const longestWaitingEntry = useMemo(() => {
    if (!waitingQueue.length) return null
    return waitingQueue.reduce((longest, entry) => {
      const longestMinutes = Number(longest.waiting_minutes || 0)
      const currentMinutes = Number(entry.waiting_minutes || 0)
      return currentMinutes > longestMinutes ? entry : longest
    })
  }, [waitingQueue])

  const longestWaitMinutes = longestWaitingEntry ? Math.max(0, Math.round(Number(longestWaitingEntry.waiting_minutes || 0))) : 0

  const appointmentsWithoutClinician = useMemo(
    () =>
      todayAppointments.filter(
        (appointment) => !appointment.doctorName || appointment.doctorName.toLowerCase() === "unassigned",
      ).length,
    [todayAppointments],
  )

  const appointmentsDueNow = useMemo(() => {
    const now = Date.now()
    return todayAppointments.filter((appointment) => {
      const scheduled = parseAppointmentDateTime(appointment.date, appointment.time)
      if (!scheduled) return false
      return scheduled.getTime() <= now
    }).length
  }, [todayAppointments])

  const departmentPressure = useMemo<DepartmentPressureRow[]>(() => {
    const rows = new Map<string, DepartmentPressureRow>()

    const register = (department: string, mode: "waiting" | "inService", minutes: number) => {
      const key = department || "Unassigned"
      const current = rows.get(key) || {
        department: key,
        waitingCount: 0,
        inServiceCount: 0,
        longestWaitMinutes: 0,
        totalPatients: 0,
      }

      if (mode === "waiting") current.waitingCount += 1
      else current.inServiceCount += 1

      current.totalPatients += 1
      current.longestWaitMinutes = Math.max(current.longestWaitMinutes, Math.max(0, Math.round(minutes)))
      rows.set(key, current)
    }

    waitingQueue.forEach((entry) => register(entry.department, "waiting", Number(entry.waiting_minutes || 0)))
    inServiceQueue.forEach((entry) => register(entry.department, "inService", Number(entry.in_service_minutes || 0)))

    return Array.from(rows.values()).sort((left, right) => {
      if (right.waitingCount !== left.waitingCount) return right.waitingCount - left.waitingCount
      if (right.longestWaitMinutes !== left.longestWaitMinutes) return right.longestWaitMinutes - left.longestWaitMinutes
      return left.department.localeCompare(right.department)
    })
  }, [inServiceQueue, waitingQueue])

  const overviewStatus = useMemo<OverviewStatus>(() => {
    if (longestWaitMinutes >= 45 || waitingQueue.length >= 8) {
      return {
        label: "Escalation needed",
        tone: "critical",
        detail: "Queue pressure is above the safe desk threshold. Move the next patients forward and alert the affected departments.",
      }
    }

    if (longestWaitMinutes >= 20 || appointmentsWithoutClinician > 0 || appointmentsDueNow > arrivals.length) {
      return {
        label: "Watch closely",
        tone: "watch",
        detail: "The desk is moving, but there are early signs of delay in queue flow or clinician allocation.",
      }
    }

    return {
      label: "Flow stable",
      tone: "calm",
      detail: "Realtime front-desk activity is within a manageable range. Keep arrivals, payments, and queue handoffs synchronized.",
    }
  }, [appointmentsDueNow, appointmentsWithoutClinician, arrivals.length, longestWaitMinutes, waitingQueue.length])

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []

    if (longestWaitingEntry && longestWaitMinutes >= 30) {
      items.push({
        title: `${longestWaitingEntry.first_name} ${longestWaitingEntry.last_name} has the oldest queue wait`,
        detail: `${longestWaitingEntry.department} has been waiting ${longestWaitMinutes} minutes. Clear or escalate this lane first.`,
        actionLabel: "Open queue",
        tone: longestWaitMinutes >= 45 ? "critical" : "watch",
        onClick: () => syncSection("queue"),
      })
    }

    if (appointmentsWithoutClinician > 0) {
      items.push({
        title: `${appointmentsWithoutClinician} appointments do not have a clinician assigned`,
        detail: "Reception should confirm clinician ownership before the arrivals stack up at the desk.",
        actionLabel: "Open check-in",
        tone: "watch",
        onClick: () => syncSection("checkin"),
      })
    }

    if (arrivals.length > 0 && todayPayments.length === 0) {
      items.push({
        title: "Arrivals are landing but no payments have posted yet",
        detail: "Confirm whether these visits are cash, insured, or deferred to avoid end-of-day reconciliation drift.",
        actionLabel: "Open payments",
        tone: "watch",
        onClick: () => syncSection("payments"),
      })
    }

    if (!items.length) {
      items.push({
        title: "No urgent desk blockers are visible",
        detail: "Use this window to verify patient demographics, insurance details, and export readiness before the next rush.",
        actionLabel: "Open patients",
        tone: "calm",
        onClick: () => syncSection("patients"),
      })
    }

    return items.slice(0, 3)
  }, [
    appointmentsWithoutClinician,
    arrivals.length,
    longestWaitMinutes,
    longestWaitingEntry,
    syncSection,
    todayPayments.length,
  ])

  const recentActivity = useMemo<ActivityFeedItem[]>(() => {
    const checkinItems = arrivals.map((arrival) => ({
      id: `checkin-${arrival.id}`,
      title: `Arrival registered for ${arrival.first_name} ${arrival.last_name}`,
      detail: `${formatPatientNumber(arrival.patient_number)} moved into ${arrival.status} at ${new Date(arrival.created_at).toLocaleTimeString()}.`,
      timestamp: getSafeTimestamp(arrival.created_at),
      onClick: () => {
        setFocusPatientId(arrival.patient_id)
        syncSection("patients")
      },
      accent: "sky" as const,
    }))

    const paymentItems = todayPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      title: `Payment posted for ${payment.first_name} ${payment.last_name}`,
      detail: `${formatCurrency(Number(payment.amount || 0))} via ${payment.method} on receipt ${payment.receipt_no}.`,
      timestamp: getSafeTimestamp(payment.created_at),
      onClick: () => syncSection("payments"),
      accent: "emerald" as const,
    }))

    return [...checkinItems, ...paymentItems]
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 8)
  }, [arrivals, formatCurrency, syncSection, todayPayments])

  const loadOpsSnapshot = useCallback(async () => {
    try {
      setOpsLoading(true)
      setOpsError(null)
      const range = buildTodayRange()
      const [checkinsRes, waitingRes, inServiceRes, paymentsRes] = await Promise.all([
        fetch(`/api/checkins?date=${range.today}`, { credentials: "include" }),
        fetch("/api/queues?status=waiting", { credentials: "include" }),
        fetch("/api/queues?status=in_service", { credentials: "include" }),
        fetch(`/api/payments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=25`, { credentials: "include" }),
      ])

      if (!checkinsRes.ok && !waitingRes.ok && !inServiceRes.ok && !paymentsRes.ok) {
        throw new Error("Reception operations data failed to load.")
      }

      const [checkinsData, waitingData, inServiceData, paymentsData] = await Promise.all([
        checkinsRes.ok ? checkinsRes.json() : Promise.resolve({ checkins: [] }),
        waitingRes.ok ? waitingRes.json() : Promise.resolve({ queue: [] }),
        inServiceRes.ok ? inServiceRes.json() : Promise.resolve({ queue: [] }),
        paymentsRes.ok ? paymentsRes.json() : Promise.resolve({ payments: [] }),
      ])

      setArrivals(Array.isArray(checkinsData.checkins) ? checkinsData.checkins : [])
      setWaitingQueue(Array.isArray(waitingData.queue) ? waitingData.queue : [])
      setInServiceQueue(Array.isArray(inServiceData.queue) ? inServiceData.queue : [])
      setTodayPayments(Array.isArray(paymentsData.payments) ? paymentsData.payments : [])
      setLastUpdated(new Date())
    } catch (error: any) {
      setOpsError(error?.message || "Reception operations data failed to load.")
    } finally {
      setOpsLoading(false)
    }
  }, [])

  const handleRefreshOverview = useCallback(async () => {
    setRefreshingOverview(true)
    try {
      await Promise.all([refreshPatients(), refreshAppointments?.() ?? Promise.resolve(), loadOpsSnapshot()])
    } finally {
      setRefreshingOverview(false)
    }
  }, [loadOpsSnapshot, refreshAppointments, refreshPatients])

  useEffect(() => {
    void loadOpsSnapshot()
  }, [loadOpsSnapshot])

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadOpsSnapshot().catch(() => {})
    }, 30000)
    return () => clearInterval(intervalId)
  }, [loadOpsSnapshot])

  useEffect(() => {
    if (isReceptionSection(sectionParam)) {
      setActiveTab(sectionParam)
      return
    }
    if (settingsLoading) return

    const mappedPreference: ReceptionSection =
      settings?.defaultDashboard === "reception-patients"
        ? "patients"
        : settings?.defaultDashboard === "reception-checkin"
          ? "checkin"
          : settings?.defaultDashboard === "reception-queue"
            ? "queue"
            : settings?.defaultDashboard === "reception-payments"
              ? "payments"
              : settings?.defaultDashboard === "reception-reports"
                ? "reports"
                : "overview"

    setActiveTab(mappedPreference)
  }, [sectionParam, settings?.defaultDashboard, settingsLoading])

  useEffect(() => {
    if (activeTab === "overview") return
    scrollWorkspaceIntoView(sectionParam ? "smooth" : "auto")
  }, [activeTab, scrollWorkspaceIntoView, sectionParam])

  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
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

      if (detail.patientId) {
        setFocusPatientId(String(detail.patientId))
      }

      const nextSection: ReceptionSection = isReceptionSection(detail.initialSection)
        ? detail.initialSection
        : detail.paymentId
          ? "payments"
          : detail.checkinId || detail.appointmentId
            ? "checkin"
            : detail.patientId
              ? "patients"
              : "overview"

      syncSection(nextSection)
    }

    window.addEventListener("openReceptionDesk", handler as EventListener)
    return () => window.removeEventListener("openReceptionDesk", handler as EventListener)
  }, [syncSection])

  const hasOverviewError = Boolean(patientsLoadError || appointmentsLoadError || opsError)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-sky-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_36%),linear-gradient(135deg,_rgba(239,246,255,1),_rgba(255,255,255,0.96)_45%,_rgba(240,253,250,0.94))] p-6 shadow-[0_30px_80px_-44px_rgba(14,116,144,0.45)]">
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-sky-800">
              <BellRing className="h-3.5 w-3.5" />
              Reception Command Desk
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Register arrivals, steer traffic, and keep the front desk in sync with the rest of the hospital.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Check-in, queue control, receipts, exports, and patient handoff now run from one receptionist workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <Pill label="Last sync" value={lastUpdated ? lastUpdated.toLocaleTimeString() : "Loading"} />
              <Pill label="Arrivals today" value={String(arrivals.length)} />
              <Pill label="Waiting queue" value={String(waitingQueue.length)} alert={waitingQueue.length > 8} />
              <Pill label="Payments today" value={String(todayPayments.length)} />
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-foreground">Quick Actions</div>
            <div className="grid gap-3">
              <QuickButton label="Open patient register" description="Search patients, correct records, and jump into demographics." onClick={() => syncSection("patients")} />
              <QuickButton label="Launch check-in desk" description="Create arrivals and schedule appointments without leaving reception." onClick={() => syncSection("checkin")} />
              <QuickButton label="Review queue flow" description="See waiting pressure and move patients through service lanes." onClick={() => syncSection("queue")} />
              <QuickButton label="Open reports" description="Export the reception register, dashboard, and daily pack." onClick={() => syncSection("reports")} />
            </div>
          </div>
        </div>
      </section>

      {hasOverviewError && (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTitle>Data load issue</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {patientsLoadError && <span>Patients failed to load.</span>}
            {appointmentsLoadError && <span>Appointments failed to load.</span>}
            {opsError && <span>{opsError}</span>}
            <Button variant="outline" size="sm" onClick={handleRefreshOverview} disabled={refreshingOverview}>
              {refreshingOverview ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registered Patients"
          value={loadingPatients ? null : patients.length}
          loading={loadingPatients}
          hint={patientsLoadError ? "Load failed" : "Directory coverage available to reception."}
          icon={<Users className="h-4 w-4 text-sky-600" />}
          onClick={() => syncSection("patients")}
        />
        <MetricCard
          label="Today's Appointments"
          value={loadingAppointments ? null : todayAppointments.length}
          loading={loadingAppointments}
          hint={appointmentsLoadError ? "Load failed" : "Scheduled appointments expected at the desk today."}
          icon={<Calendar className="h-4 w-4 text-emerald-600" />}
          onClick={() => syncSection("checkin")}
        />
        <MetricCard
          label="Queue Waiting"
          value={opsLoading ? null : waitingQueue.length}
          loading={opsLoading}
          hint={opsError ? "Realtime queue unavailable" : queueAverageWait ? `Average wait ${queueAverageWait} min` : "No waits are building right now."}
          icon={<ClipboardList className="h-4 w-4 text-amber-600" />}
          onClick={() => syncSection("queue")}
        />
        <MetricCard
          label="Payments Today"
          value={opsLoading ? null : todayPayments.length}
          loading={opsLoading}
          hint={
            opsError
              ? "Payment feed unavailable"
              : paymentsTotal
                ? `${formatCurrency(paymentsTotal)} collected across ${todayPayments.length} receipt${todayPayments.length === 1 ? "" : "s"}`
                : "No payments captured today yet."
          }
          icon={<CreditCard className="h-4 w-4 text-rose-600" />}
          onClick={() => syncSection("payments")}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="border-slate-200 bg-white/95 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Today at Reception</CardTitle>
              <CardDescription>Appointments and arrivals land here before they fan out to the clinical portals.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshOverview}
              disabled={refreshingOverview || (loadingPatients && loadingAppointments && opsLoading)}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshingOverview ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Appointments due today</div>
                <Button variant="ghost" size="sm" onClick={() => syncSection("checkin")}>
                  Open desk
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              {loadingAppointments ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-muted-foreground">
                  No appointments are scheduled for today.
                </div>
              ) : (
                <ScrollArea className={OVERVIEW_LIST_HEIGHT_CLASS}>
                  <div className="space-y-2 pr-4">
                    {todayAppointments.map((appointment) => (
                      <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="font-medium text-foreground">{appointment.patientName}</div>
                        <div className="text-sm text-muted-foreground">{appointment.time} | {appointment.department || appointment.type}</div>
                        <div className="text-xs text-muted-foreground">Clinician: {appointment.doctorName || "Unassigned"}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">Recent arrivals</div>
                <Button variant="ghost" size="sm" onClick={() => syncSection("patients")}>
                  Open patients
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              {opsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : arrivals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-muted-foreground">
                  No check-ins have been recorded yet today.
                </div>
              ) : (
                <ScrollArea className={OVERVIEW_LIST_HEIGHT_CLASS}>
                  <div className="space-y-2 pr-4">
                    {arrivals.map((arrival) => (
                      <button
                        key={arrival.id}
                        type="button"
                        onClick={() => {
                          setFocusPatientId(arrival.patient_id)
                          syncSection("patients")
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:shadow-sm"
                      >
                        <div className="font-medium text-foreground">
                          {formatPatientNumber(arrival.patient_number)} - {arrival.first_name} {arrival.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {arrival.status} | {new Date(arrival.created_at).toLocaleTimeString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.98))] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Queue Pressure</CardTitle>
            <CardDescription>Front-desk bottlenecks are surfaced here so the right department can react before the lobby backs up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {opsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : waitingQueue.length === 0 && inServiceQueue.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-6 text-sm text-emerald-900">
                No queue build-up is visible right now.
              </div>
            ) : (
              <ScrollArea className={OVERVIEW_LIST_HEIGHT_CLASS}>
                <div className="space-y-2 pr-4">
                  {waitingQueue.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/75 px-4 py-3">
                      <div className="font-medium text-foreground">{entry.first_name} {entry.last_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.department} | waiting {Math.max(0, Math.round(Number(entry.waiting_minutes || 0)))} min
                      </div>
                    </div>
                  ))}
                  {inServiceQueue.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                      <div className="font-medium text-foreground">{entry.first_name} {entry.last_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.department} | in service {Math.max(0, Math.round(Number(entry.in_service_minutes || 0)))} min
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button variant="outline" className="w-full" onClick={() => syncSection("queue")}>
              Open Queue Board
            </Button>
          </CardContent>
        </Card>
      </div>

      <ErrorBoundary
        fallbackTitle="Dashboard error"
        fallbackDescription="Something went wrong in the reception dashboard. Try again or refresh the page."
      >
        <div ref={workspaceRef}>
          <Tabs value={activeTab} onValueChange={(next) => syncSection(next as ReceptionSection)}>
            <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2 md:grid-cols-3 xl:grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="patients">Patients</TabsTrigger>
              <TabsTrigger value="checkin">Check-In</TabsTrigger>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card className="border-slate-200 bg-white/95 shadow-sm">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Reception Operations Overview</CardTitle>
                    <CardDescription>
                      A live front-desk command view for arrivals, waits, handoffs, and collections. Prioritize pressure early and route work without leaving reception.
                    </CardDescription>
                  </div>
                  <div className={statusPillClassName(overviewStatus.tone)}>
                    <AlertTriangle className="h-4 w-4" />
                    <div>
                      <div className="text-sm font-semibold">{overviewStatus.label}</div>
                      <div className="text-xs opacity-90">{overviewStatus.detail}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <OverviewSignalCard
                    title="Arrivals in the last hour"
                    value={opsLoading ? "Loading" : String(arrivalsLastHour)}
                    detail={opsError ? "Realtime arrival feed unavailable." : `${arrivals.length} total check-ins recorded on the reception day.`}
                    icon={<BellRing className="h-4 w-4 text-sky-600" />}
                    onClick={() => syncSection("checkin")}
                  />
                  <OverviewSignalCard
                    title="Longest active wait"
                    value={opsLoading ? "Loading" : longestWaitMinutes ? `${longestWaitMinutes} min` : "Clear"}
                    detail={
                      longestWaitingEntry
                        ? `${longestWaitingEntry.department} is holding the oldest waiting patient.`
                        : "No patients are currently waiting for service."
                    }
                    icon={<Clock3 className="h-4 w-4 text-amber-600" />}
                    onClick={() => syncSection("queue")}
                  />
                  <OverviewSignalCard
                    title="Appointments due now"
                    value={loadingAppointments ? "Loading" : String(appointmentsDueNow)}
                    detail={
                      appointmentsWithoutClinician
                        ? `${appointmentsWithoutClinician} scheduled patient${appointmentsWithoutClinician === 1 ? "" : "s"} still need clinician ownership.`
                        : "Clinician assignments are aligned with the current reception schedule."
                    }
                    icon={<Calendar className="h-4 w-4 text-emerald-600" />}
                    onClick={() => syncSection("checkin")}
                  />
                  <OverviewSignalCard
                    title="Collections recorded"
                    value={opsLoading ? "Loading" : formatCurrency(paymentsTotal)}
                    detail={
                      opsError
                        ? "Payment feed unavailable."
                        : `${todayPayments.length} receipt${todayPayments.length === 1 ? "" : "s"} posted by reception today.`
                    }
                    icon={<CreditCard className="h-4 w-4 text-rose-600" />}
                    onClick={() => syncSection("payments")}
                  />
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-slate-200 bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Attention Board</CardTitle>
                    <CardDescription>What needs a receptionist decision or follow-up next.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {attentionItems.map((item) => (
                      <AttentionCard key={item.title} item={item} />
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Department Pressure</CardTitle>
                    <CardDescription>Realtime load by lane so the desk can see which unit is pulling back patient flow.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {opsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : departmentPressure.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-muted-foreground">
                        No departments are holding active queue load right now.
                      </div>
                    ) : (
                      departmentPressure.slice(0, 5).map((row) => (
                        <button
                          key={row.department}
                          type="button"
                          onClick={() => syncSection("queue")}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition hover:border-sky-300 hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-foreground">{row.department}</div>
                              <div className="text-sm text-muted-foreground">
                                {row.waitingCount} waiting, {row.inServiceCount} in service
                              </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              <div className="font-medium text-foreground">{row.totalPatients} active</div>
                              <div>Longest wait {row.longestWaitMinutes} min</div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-slate-200 bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Recent Front-Desk Activity</CardTitle>
                    <CardDescription>Latest patient arrivals and payment events captured by the reception workflow.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {opsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                      </div>
                    ) : recentActivity.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-muted-foreground">
                        No arrival or payment activity has been captured yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentActivity.map((item) => (
                          <ActivityFeedRow key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/95 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Workflow Handoffs</CardTitle>
                    <CardDescription>Open the right desk surface with the current live count already in view.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                    <ActionCard
                      title="Patients"
                      description={`${patients.length} registered records available for demographic fixes and insurance review.`}
                      onClick={() => syncSection("patients")}
                    />
                    <ActionCard
                      title="Check-In"
                      description={`${todayAppointments.length} scheduled appointments and ${arrivals.length} arrivals are feeding through reception today.`}
                      onClick={() => syncSection("checkin")}
                    />
                    <ActionCard
                      title="Queue"
                      description={`${waitingQueue.length} waiting and ${inServiceQueue.length} in service across live departments.`}
                      onClick={() => syncSection("queue")}
                    />
                    <ActionCard
                      title="Reports"
                      description="Download the reception register, queue history, and daily reconciliation pack from one place."
                      onClick={() => syncSection("reports")}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="patients">
              <PatientList initialSelectedPatientId={focusPatientId} />
            </TabsContent>

            <TabsContent value="checkin">
              <CheckInPanel />
            </TabsContent>

            <TabsContent value="queue">
              <QueueBoardPro />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentsPanel />
            </TabsContent>

            <TabsContent value="reports">
              <ReceptionRegister />
            </TabsContent>
          </Tabs>
        </div>
      </ErrorBoundary>
    </div>
  )
}

function Pill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-full border px-3 py-1 ${alert ? "border-amber-200 bg-amber-50 text-amber-900" : "border-white/70 bg-white/80"}`}>
      <span className="font-medium">{label}:</span> {value}
    </div>
  )
}

function QuickButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-sky-300 hover:shadow-sm"
    >
      <div className="font-medium text-foreground">{label}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </button>
  )
}

function MetricCard({
  label,
  value,
  loading,
  hint,
  icon,
  onClick,
}: {
  label: string
  value: number | null
  loading: boolean
  hint: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full border-slate-200 bg-white/95 transition hover:border-sky-300 hover:shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{label}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-7 w-24" /> : <div className="text-2xl font-bold">{value ?? 0}</div>}
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  )
}

function ActionCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-left transition hover:border-sky-300 hover:bg-white hover:shadow-sm"
    >
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{description}</div>
    </button>
  )
}

function statusPillClassName(tone: OverviewTone) {
  if (tone === "critical") {
    return "inline-flex max-w-xl items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900"
  }

  if (tone === "watch") {
    return "inline-flex max-w-xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
  }

  return "inline-flex max-w-xl items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
}

function OverviewSignalCard({
  title,
  value,
  detail,
  icon,
  onClick,
}: {
  title: string
  value: string
  detail: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-left transition hover:border-sky-300 hover:bg-white hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</div>
    </button>
  )
}

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <div className={`rounded-2xl border px-4 py-4 ${item.tone === "critical" ? "border-rose-200 bg-rose-50/80" : item.tone === "watch" ? "border-amber-200 bg-amber-50/80" : "border-emerald-200 bg-emerald-50/80"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-medium text-foreground">{item.title}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</div>
        </div>
        <Button variant="outline" size="sm" onClick={item.onClick}>
          {item.actionLabel}
        </Button>
      </div>
    </div>
  )
}

function ActivityFeedRow({ item }: { item: ActivityFeedItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:shadow-sm ${item.accent === "sky" ? "border-sky-200 bg-sky-50/70 hover:border-sky-300" : "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{item.title}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "Now"}
        </div>
      </div>
    </button>
  )
}
