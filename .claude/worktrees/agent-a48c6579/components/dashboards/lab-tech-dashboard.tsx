"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useLab } from "@/lib/lab-context"
import { useAuth } from "@/lib/auth-context"
import { useSettings } from "@/lib/settings-context"
import { LabTestQueue } from "@/components/lab/lab-test-queue"
import { LabTestDetails } from "@/components/lab/lab-test-details"
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Download,
  Files,
  FlaskConical,
  Loader2,
  Printer,
  RefreshCw,
  TestTube,
  TrendingUp,
} from "lucide-react"
import { toast } from "sonner"

type QueueTab = "pending" | "inprogress" | "completed" | "all"
type ExportFormat = "csv" | "xlsx" | "pdf"
type ExportStatus = "All" | "Pending" | "In Progress" | "Completed" | "Cancelled"

export function LabTechDashboard() {
  const { tests, refresh, loading } = useLab()
  const { user } = useAuth()
  const { settings, loading: settingsLoading } = useSettings()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => new Date())
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<QueueTab>("pending")
  const queueRef = useRef<HTMLDivElement | null>(null)
  const analyticsRef = useRef<HTMLDivElement | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      refresh().then(() => setLastUpdated(new Date())).catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [refresh])

  const pendingTests = useMemo(() => tests.filter((t) => t.status.toLowerCase() === "pending"), [tests])
  const inProgressTests = useMemo(() => tests.filter((t) => t.status.toLowerCase() === "in progress"), [tests])
  const completedTests = useMemo(() => tests.filter((t) => t.status.toLowerCase() === "completed"), [tests])
  const overdueTests = useMemo(() => {
    const now = lastUpdated?.getTime()
    if (!now) return []
    return pendingTests.filter((t) => (now - new Date(t.orderedAt).getTime()) / 3600000 > 4)
  }, [lastUpdated, pendingTests])
  const unassignedTests = useMemo(() => tests.filter((t) => !t.labTechId && !t.labTechName), [tests])
  const assignedToMe = useMemo(
    () =>
      tests.filter(
        (t) =>
          !!user &&
          (t.labTechId === user.id || t.labTechName?.toLowerCase() === user.name.toLowerCase()),
      ),
    [tests, user],
  )
  const tat = useMemo(() => {
    const rows = completedTests
      .filter((t) => t.completedAt)
      .map((t) => Math.max(0, Math.round((new Date(t.completedAt || t.orderedAt).getTime() - new Date(t.orderedAt).getTime()) / 60000)))
    if (!rows.length) return { avg: 0, max: 0, min: 0 }
    return {
      avg: Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
      max: Math.max(...rows),
      min: Math.min(...rows),
    }
  }, [completedTests])

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

      if (detail.testId) {
        setSelectedTestId(String(detail.testId))
        return
      }

      const match = detail.patientId
        ? tests.find((t) => t.patientId === detail.patientId && t.status.toLowerCase() !== "completed") ||
          tests.find((t) => t.patientId === detail.patientId)
        : null
      if (match) {
        setSelectedTestId(match.id)
        return
      }

      setActiveTab("all")
      queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    window.addEventListener("openLabTest", handler as EventListener)
    return () => window.removeEventListener("openLabTest", handler as EventListener)
  }, [tests])

  useEffect(() => {
    if (settingsLoading || selectedTestId) return
    if (settings?.defaultDashboard === "lab-queue") {
      queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else if (settings?.defaultDashboard === "lab-analytics") {
      analyticsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else if (settings?.defaultDashboard === "lab-exports") {
      exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selectedTestId, settings?.defaultDashboard, settingsLoading])

  if (selectedTestId) {
    return <LabTestDetails testId={selectedTestId} onBack={() => setSelectedTestId(null)} />
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.28),_transparent_38%),linear-gradient(135deg,_rgba(240,249,255,1),_rgba(236,253,245,0.92)_45%,_rgba(255,251,235,0.92))] p-6 shadow-[0_30px_80px_-40px_rgba(8,145,178,0.45)]">
        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-cyan-800">
              <FlaskConical className="h-3.5 w-3.5" />
              Lab Operations Hub
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Process specimens, release results, and keep the rest of the hospital in sync.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Queue control, exports, printing, and cross-portal notifications now run from one Lab Portal surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-700">
              <Pill label="Auto refresh" value="30s" />
              <Pill label="Last sync" value={lastUpdated ? lastUpdated.toLocaleTimeString() : "Now"} />
              <Pill label="Assigned to me" value={String(assignedToMe.length)} />
              <Pill label="Overdue" value={String(overdueTests.length)} alert={overdueTests.length > 0} />
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-foreground">Quick Actions</div>
            <div className="grid gap-3">
              <QuickButton label="Open pending queue" onClick={() => { setActiveTab("pending"); queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }} />
              <QuickButton label="Review analytics" onClick={() => analyticsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
              <QuickButton label="Launch exports" onClick={() => exportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
              <Button variant="outline" onClick={() => refresh().then(() => { setLastUpdated(new Date()); toast.success("Lab queue refreshed") }).catch(() => toast.error("Failed to refresh lab queue"))} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh Queue
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending" value={pendingTests.length} hint={overdueTests.length ? `${overdueTests.length} overdue beyond 4h` : "Awaiting collection or processing"} icon={<AlertCircle className="h-4 w-4 text-amber-500" />} tone="amber" />
        <MetricCard label="In Progress" value={inProgressTests.length} hint={`${assignedToMe.length} assigned to you`} icon={<Activity className="h-4 w-4 text-cyan-500" />} tone="cyan" />
        <MetricCard label="Completed" value={completedTests.length} hint={completedTests.length ? `Average TAT ${tat.avg}m` : "Results will appear here"} icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} tone="emerald" />
        <MetricCard label="Unassigned" value={unassignedTests.length} hint="Ready for delegation" icon={<TestTube className="h-4 w-4 text-slate-500" />} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.95fr]">
        <Card ref={analyticsRef} className="border-slate-200 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-cyan-600" />Turnaround Analytics</CardTitle>
            <CardDescription>Watch bench pace and spot slowdowns before they turn into clinician delays.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <MiniStat label="Average" value={completedTests.length ? `${tat.avg}m` : "No data"} />
            <MiniStat label="Fastest" value={completedTests.length ? `${tat.min}m` : "-"} />
            <MiniStat label="Slowest" value={completedTests.length ? `${tat.max}m` : "-"} />
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-[linear-gradient(180deg,_rgba(254,242,242,0.95),_rgba(255,255,255,0.95))] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertCircle className="h-4 w-4 text-red-500" />Priority Bench</CardTitle>
            <CardDescription>Overdue work is surfaced here for immediate processing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueTests.length === 0 ? <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-6 text-sm text-emerald-900">No overdue cases are waiting.</div> : overdueTests.slice(0, 4).map((test) => (
              <button key={test.id} type="button" onClick={() => setSelectedTestId(test.id)} className="w-full rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-left transition hover:border-red-300 hover:shadow-sm">
                <div className="font-medium text-foreground">{test.testName}</div>
                <div className="text-sm text-muted-foreground">{test.patientName} • {test.accessionNumber || "No accession"} • ordered {new Date(test.orderedAt).toLocaleString()}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card ref={exportRef} className="border-cyan-100 bg-[linear-gradient(180deg,_rgba(236,254,255,0.92),_rgba(255,255,255,0.98))] shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Files className="h-4 w-4 text-cyan-600" />Export Studio</CardTitle>
          <CardDescription>Worklist exports, analyte reports, and batch printing are all wired for the Lab Portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportStudio />
        </CardContent>
      </Card>

      <div ref={queueRef} className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">Laboratory Queue</h3>
          <p className="text-sm text-muted-foreground">Select a work item, record collection, and finalize results without leaving the portal.</p>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as QueueTab)}>
          <TabsList className="grid w-full grid-cols-2 gap-2 bg-muted/60 p-1 md:grid-cols-4">
            <TabsTrigger value="pending">Pending {pendingTests.length ? `(${pendingTests.length})` : ""}{overdueTests.length ? <span className="ml-1 text-red-600">!</span> : null}</TabsTrigger>
            <TabsTrigger value="inprogress">In Progress {inProgressTests.length ? `(${inProgressTests.length})` : ""}</TabsTrigger>
            <TabsTrigger value="completed">Completed {completedTests.length ? `(${completedTests.length})` : ""}</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
          <TabsContent value="pending"><LabTestQueue tests={pendingTests} onSelectTest={setSelectedTestId} emptyMessage="No pending tests. New lab orders will appear here." /></TabsContent>
          <TabsContent value="inprogress"><LabTestQueue tests={inProgressTests} onSelectTest={setSelectedTestId} emptyMessage="No tests are currently in progress." /></TabsContent>
          <TabsContent value="completed"><LabTestQueue tests={completedTests} onSelectTest={setSelectedTestId} emptyMessage="No completed tests yet." /></TabsContent>
          <TabsContent value="all"><LabTestQueue tests={tests} onSelectTest={setSelectedTestId} emptyMessage="No laboratory tests recorded for this period." /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ExportStudio() {
  const [from, setFrom] = useState(new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split("T")[0])
  const [to, setTo] = useState(new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState<ExportStatus>("Completed")
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [busy, setBusy] = useState<"worklist" | "analytes" | "print" | null>(null)

  const getRange = () => {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      throw new Error("Enter a valid export range")
    }
    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(23, 59, 59, 999)
    return { fromDate, toDate }
  }

  const saveBlob = async (response: Response, filename: string) => {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || "Export failed")
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const exportWorklist = async () => {
    setBusy("worklist")
    try {
      const { fromDate, toDate } = getRange()
      const response = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset: "labs",
          format,
          redaction_profile: "clinical",
          filters: { from: fromDate.toISOString(), to: toDate.toISOString(), ...(status !== "All" ? { status } : {}) },
        }),
      })
      await saveBlob(response, `lab-worklist-${from}-to-${to}.${format}`)
      toast.success(`Lab worklist exported as ${format.toUpperCase()}`)
    } catch (error: any) {
      toast.error(error?.message || "Failed to export lab worklist")
    } finally {
      setBusy(null)
    }
  }

  const exportAnalytes = async () => {
    setBusy("analytes")
    try {
      const { fromDate, toDate } = getRange()
      const endpoint = format === "pdf" ? "/api/lab-tests/pdf" : format === "xlsx" ? "/api/lab-tests/xlsx" : "/api/lab-tests/csv"
      const url = new URL(endpoint, window.location.origin)
      url.searchParams.set("from", fromDate.toISOString())
      url.searchParams.set("to", toDate.toISOString())
      if (status !== "All") url.searchParams.set("status", status)
      await saveBlob(await fetch(url.toString(), { credentials: "include" }), `lab-analytes-${from}-to-${to}.${format}`)
      toast.success(`Analyte export generated as ${format.toUpperCase()}`)
    } catch (error: any) {
      toast.error(error?.message || "Failed to export analyte report")
    } finally {
      setBusy(null)
    }
  }

  const openPrint = async () => {
    setBusy("print")
    try {
      const { fromDate, toDate } = getRange()
      const url = new URL("/lab-tests/print", window.location.origin)
      url.searchParams.set("from", fromDate.toISOString())
      url.searchParams.set("to", toDate.toISOString())
      url.searchParams.set("status", status === "All" ? "Completed" : status)
      window.open(url.toString(), "_blank", "noopener,noreferrer")
    } catch (error: any) {
      toast.error(error?.message || "Failed to open print view")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-2"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-2"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</Label><Select value={status} onValueChange={(value: ExportStatus) => setStatus(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Format</Label><Select value={format} onValueChange={(value: ExportFormat) => setFormat(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="csv">CSV</SelectItem><SelectItem value="xlsx">Excel (XLSX)</SelectItem><SelectItem value="pdf">PDF</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ExportButton label={`Worklist ${format.toUpperCase()}`} description="Queue-focused export with patient and order details." busy={busy === "worklist"} icon={<Download className="h-4 w-4 text-cyan-600" />} onClick={exportWorklist} disabled={busy !== null} />
        <ExportButton label={`Analytes ${format.toUpperCase()}`} description="Parsed result-level export for analysis and sharing." busy={busy === "analytes"} icon={<Files className="h-4 w-4 text-emerald-600" />} onClick={exportAnalytes} disabled={busy !== null} />
        <ExportButton label="Batch Print Results" description="Open a printable result pack in a new tab." busy={busy === "print"} icon={<Printer className="h-4 w-4 text-amber-600" />} onClick={openPrint} disabled={busy !== null} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Pill label="Range" value={`${from} to ${to}`} />
        <Pill label="Status" value={status} />
        <Pill label="Format" value={format.toUpperCase()} />
      </div>
    </div>
  )
}

function MetricCard({ label, value, hint, icon, tone }: { label: string; value: number; hint: string; icon: ReactNode; tone: "amber" | "cyan" | "emerald" | "slate" }) {
  const tones = { amber: "border-amber-200 bg-amber-50/70", cyan: "border-cyan-200 bg-cyan-50/70", emerald: "border-emerald-200 bg-emerald-50/70", slate: "border-slate-200 bg-slate-50/70" }
  return <Card className={`${tones[tone]} shadow-sm`}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</CardTitle>{icon}</CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-semibold text-foreground">{value}</div></div>
}

function Pill({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${alert ? "border-red-200 bg-red-50 text-red-800" : "border-slate-200 bg-white/70 text-slate-700"}`}><span className="font-medium">{label}</span><span>{value}</span></span>
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-foreground transition hover:border-cyan-300 hover:shadow-sm">{label}</button>
}

function ExportButton({ label, description, busy, icon, onClick, disabled }: { label: string; description: string; busy: boolean; icon: ReactNode; onClick: () => void; disabled: boolean }) {
  return <div className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-sm"><div className="mb-3 flex items-center gap-2"><div className="rounded-full border border-slate-200 bg-slate-50 p-2">{icon}</div><div className="font-medium text-foreground">{label}</div></div><p className="mb-4 text-sm text-muted-foreground">{description}</p><Button onClick={onClick} disabled={disabled} className="w-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{busy ? "Working..." : label}</Button></div>
}
