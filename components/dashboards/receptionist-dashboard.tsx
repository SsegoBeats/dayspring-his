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
import { ArrowUpRight, BellRing, Calendar, ClipboardList, CreditCard, RefreshCw, Users } from "lucide-react"
import { CheckInPanel } from "@/components/reception/check-in-panel"
import { QueueBoardPro } from "@/components/reception/queue-board-pro"
import { ReceptionRegister } from "@/components/reception/reception-register"
import { PaymentsPanel } from "@/components/reception/payments-panel"
import { ErrorBoundary } from "@/components/error-boundary"
import { useSettings } from "@/lib/settings-context"
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
          hint={opsError ? "Payment feed unavailable" : paymentsTotal ? `${paymentsTotal.toLocaleString()} collected` : "No payments captured today yet."}
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
                <CardHeader>
                  <CardTitle>Reception Workflow Coverage</CardTitle>
                  <CardDescription>The portal now routes directly into patient, queue, payment, and export work without dead-end tabs.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <ActionCard title="Patients" description="Open the live patient register and jump straight into demographics." onClick={() => syncSection("patients")} />
                  <ActionCard title="Check-In" description="Record arrivals and launch appointment scheduling from the same desk." onClick={() => syncSection("checkin")} />
                  <ActionCard title="Queue" description="Move patients through waiting, service, and completion states." onClick={() => syncSection("queue")} />
                  <ActionCard title="Reports" description="Export the daily reception register, dashboard, and queue history." onClick={() => syncSection("reports")} />
                </CardContent>
              </Card>
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
