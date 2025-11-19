"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLab } from "@/lib/lab-context"
import { LabTestQueue } from "@/components/lab/lab-test-queue"
import { LabTestDetails } from "@/components/lab/lab-test-details"
import { TestTube, Clock, CheckCircle, XCircle } from "lucide-react"

export function LabTechDashboard() {
  const { tests, refresh, loading } = useLab()
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null)

  useEffect(() => {
    // Initial stamp from provider load
    setLastUpdated(new Date())
    const id = setInterval(()=> {
      refresh().then(()=> setLastUpdated(new Date())).catch(()=>{})
    }, 30000)
    return () => clearInterval(id)
  }, [refresh])

  const pendingTests = tests.filter((t) => t.status.toLowerCase() === "pending")
  const completedTests = tests.filter((t) => t.status.toLowerCase() === "completed")
  const cancelledTests = tests.filter((t) => t.status.toLowerCase() === "cancelled")

  if (selectedTestId) {
    return <LabTestDetails testId={selectedTestId} onBack={() => setSelectedTestId(null)} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight text-sky-900">Lab Technician Dashboard</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Monitor pending work, turn around results quickly, and share structured lab reports with the care team.
        </p>
      </div>

      <Card className="border-sky-100 bg-sky-50/40">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-sky-900">Exports & Reports</CardTitle>
            <p className="text-xs text-muted-foreground">Download patient-level analytes or bulk lab reports for a given period.</p>
          </div>
          {lastUpdated && (
            <p className="text-[11px] text-muted-foreground mt-2 sm:mt-0">
              Auto-refreshing every 30s · Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <ExportLabsForm />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover:shadow-sm transition-shadow border-slate-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Tests</CardTitle>
            <TestTube className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{tests.length}</div>
            <p className="text-xs text-muted-foreground">All statuses · all time</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-amber-100 bg-amber-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending Tests</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{pendingTests.length}</div>
            <p className="text-xs text-amber-800/80">Awaiting results · prioritize STAT first</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-emerald-100 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{completedTests.length}</div>
            <p className="text-xs text-emerald-800/80">Results submitted to clinicians</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-rose-100 bg-rose-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-rose-700">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{cancelledTests.length}</div>
            <p className="text-xs text-rose-800/80">Cancelled / rejected specimens</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <LabTestQueue
            tests={pendingTests}
            onSelectTest={setSelectedTestId}
            emptyMessage="No pending tests. New lab orders will appear here."
          />
        </TabsContent>

        <TabsContent value="completed">
          <LabTestQueue
            tests={completedTests}
            onSelectTest={setSelectedTestId}
            emptyMessage="No completed tests yet. Completed results will appear here."
          />
        </TabsContent>

        <TabsContent value="all">
          <LabTestQueue
            tests={tests}
            onSelectTest={setSelectedTestId}
            emptyMessage="No laboratory tests recorded for this period."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExportLabsForm() {
  const [from, setFrom] = (require("react") as any).useState(new Date(new Date().setHours(0,0,0,0)).toISOString())
  const [to, setTo] = (require("react") as any).useState(new Date().toISOString())
  const [status, setStatus] = (require("react") as any).useState('Completed')
  const [format, setFormat] = (require("react") as any).useState<'csv'|'xlsx'|'pdf'>('csv')
  const [exporting, setExporting] = (require("react") as any).useState(false)
  const [rangePreset, setRangePreset] = (require("react") as any).useState<'custom'|'today'|'last7'|'month'>('today')

  const applyPreset = (preset: 'custom'|'today'|'last7'|'month') => {
    const now = new Date()
    if (preset === 'today') {
      const start = new Date(now)
      start.setHours(0,0,0,0)
      setFrom(start.toISOString())
      setTo(now.toISOString())
    } else if (preset === 'last7') {
      const start = new Date(now)
      start.setDate(start.getDate()-7)
      start.setHours(0,0,0,0)
      setFrom(start.toISOString())
      setTo(now.toISOString())
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      setFrom(start.toISOString())
      setTo(now.toISOString())
    }
    setRangePreset(preset)
  }
  const exportNow = async () => {
    setExporting(true)
    try {
      let blob: Blob
      if (format === 'pdf') {
        const url = new URL('/api/lab-tests/pdf', window.location.origin)
        url.searchParams.set('from', from)
        url.searchParams.set('to', to)
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) throw new Error('Export failed')
        blob = await resp.blob()
      } else if (format === 'xlsx') {
        const url = new URL('/api/lab-tests/xlsx', window.location.origin)
        url.searchParams.set('from', from)
        url.searchParams.set('to', to)
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) throw new Error('Export failed')
        blob = await resp.blob()
      } else {
        const url = new URL('/api/lab-tests/csv', window.location.origin)
        url.searchParams.set('from', from)
        url.searchParams.set('to', to)
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) throw new Error('Export failed')
        blob = await resp.blob()
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = (format === 'pdf') ? 'pdf' : (format === 'xlsx' ? 'xlsx' : 'csv')
      a.download = `labs-${new Date().toISOString().slice(0,10)}.${ext}`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch (e:any) {
      alert(e?.message || 'Export failed')
    } finally { setExporting(false) }
  }
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <input type="datetime-local" className="border rounded px-2 py-1 text-sm w-full" value={from.slice(0,16)} onChange={(e)=> { setFrom(new Date(e.target.value).toISOString()); setRangePreset('custom') }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <input type="datetime-local" className="border rounded px-2 py-1 text-sm w-full" value={to.slice(0,16)} onChange={(e)=> { setTo(new Date(e.target.value).toISOString()); setRangePreset('custom') }} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Quick range</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={rangePreset} onChange={(e)=> applyPreset(e.target.value)}>
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="month">This month</option>
            <option value="custom">Custom range</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={status} onChange={(e)=> setStatus(e.target.value)}>
            {['Pending','In Progress','Completed','Cancelled'].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Format</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={format} onChange={(e)=> setFormat((e.target.value as any))}>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border border-slate-200">
          <span className="font-medium text-slate-600">Status:</span>
          <span>{status}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border border-slate-200">
          <span className="font-medium text-slate-600">Range:</span>
          <span>{from.slice(0,16).replace('T',' ')} → {to.slice(0,16).replace('T',' ')}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border border-slate-200">
          <span className="font-medium text-slate-600">Format:</span>
          <span>{format.toUpperCase()}</span>
        </span>
      </div>
      <div>
        <button className="rounded-md border px-3 py-1.5 text-sm bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60" disabled={exporting} onClick={exportNow}>{exporting ? "Exporting..." : "Export"}</button>
        <div className="text-[11px] text-muted-foreground mt-2">Analytes-only export</div>
        <button className="mt-1 rounded-md border px-3 py-1.5 text-sm" onClick={async ()=>{
          try {
            const url = new URL('/api/lab-tests/csv', window.location.origin)
            url.searchParams.set('from', from)
            url.searchParams.set('to', to)
            if (status) url.searchParams.set('status', status)
            const r = await fetch(url.toString(), { credentials: 'include' })
            if (!r.ok) throw new Error('CSV export failed')
            const blob = await r.blob()
            const obj = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = obj
            a.download = `labs-analytes-${new Date().toISOString().slice(0,10)}.csv`
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(obj)
          } catch (e:any) {
            alert(e?.message || 'CSV export failed')
          }
        }}>Analytes CSV</button>
      </div>
    </div>
  )
}
