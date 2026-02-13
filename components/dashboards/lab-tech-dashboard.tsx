"use client"

import { useEffect, useState, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useLab } from "@/lib/lab-context"
import { LabTestQueue } from "@/components/lab/lab-test-queue"
import { LabTestDetails } from "@/components/lab/lab-test-details"
import { TestTube, Clock, CheckCircle, XCircle, Download, Loader2, TrendingUp, AlertCircle } from "lucide-react"
import { toast } from "sonner"

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
  const inProgressTests = tests.filter((t) => t.status.toLowerCase() === "in progress")
  const completedTests = tests.filter((t) => t.status.toLowerCase() === "completed")
  const cancelledTests = tests.filter((t) => t.status.toLowerCase() === "cancelled")

  // Calculate TAT metrics
  const tatMetrics = useMemo(() => {
    const completed = completedTests.filter(t => t.completedAt && t.orderedAt)
    if (completed.length === 0) return { avg: 0, min: 0, max: 0, count: 0 }
    
    const tats = completed.map(t => {
      const ordered = new Date(t.orderedAt).getTime()
      const completed = new Date(t.completedAt!).getTime()
      return Math.round((completed - ordered) / 60000) // minutes
    })
    
    return {
      avg: Math.round(tats.reduce((a, b) => a + b, 0) / tats.length),
      min: Math.min(...tats),
      max: Math.max(...tats),
      count: completed.length
    }
  }, [completedTests])

  // Calculate overdue tests (pending > 4 hours)
  const overdueTests = useMemo(() => {
    const now = Date.now()
    return pendingTests.filter(t => {
      const ordered = new Date(t.orderedAt).getTime()
      const hours = (now - ordered) / (1000 * 60 * 60)
      return hours > 4
    })
  }, [pendingTests])

  if (selectedTestId) {
    return <LabTestDetails testId={selectedTestId} onBack={() => setSelectedTestId(null)} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Lab Technician Dashboard</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Monitor pending work, turn around results quickly, and share structured lab reports with the care team.
        </p>
      </div>

      <Card className="border-sky-100 bg-sky-50/40">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground">Exports & Reports</CardTitle>
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
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Tests</CardTitle>
            <TestTube className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{tests.length}</div>
            <p className="text-xs text-muted-foreground">All statuses · all time</p>
          </CardContent>
        </Card>
        <Card className={`hover:shadow-sm transition-shadow border-amber-100 bg-amber-50/40 ${overdueTests.length > 0 ? 'border-red-300 bg-red-50/40' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending Tests</CardTitle>
            {overdueTests.length > 0 ? <AlertCircle className="h-4 w-4 text-red-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{pendingTests.length}</div>
            <p className="text-xs text-amber-800/80">
              {overdueTests.length > 0 ? `${overdueTests.length} overdue (>4h)` : 'Awaiting results · prioritize STAT first'}
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-blue-100 bg-blue-50/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-blue-700">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{inProgressTests.length}</div>
            <p className="text-xs text-blue-800/80">Currently being processed</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-sm transition-shadow border-emerald-100 bg-emerald-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{completedTests.length}</div>
            <p className="text-xs text-emerald-800/80">Results submitted to clinicians</p>
          </CardContent>
        </Card>
      </div>

      {/* TAT Analytics */}
      {tatMetrics.count > 0 && (
        <Card className="border-purple-100 bg-purple-50/40">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Turnaround Time Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-2xl font-semibold text-foreground">{tatMetrics.avg}m</div>
                <p className="text-xs text-muted-foreground">Average TAT</p>
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{tatMetrics.min}m</div>
                <p className="text-xs text-muted-foreground">Fastest</p>
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{tatMetrics.max}m</div>
                <p className="text-xs text-muted-foreground">Slowest</p>
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{tatMetrics.count}</div>
                <p className="text-xs text-muted-foreground">Samples analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="pending">
            Pending {pendingTests.length > 0 && `(${pendingTests.length})`}
            {overdueTests.length > 0 && <span className="ml-1 text-red-600">⚠</span>}
          </TabsTrigger>
          <TabsTrigger value="inprogress">
            In Progress {inProgressTests.length > 0 && `(${inProgressTests.length})`}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed {completedTests.length > 0 && `(${completedTests.length})`}</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <LabTestQueue
            tests={pendingTests}
            onSelectTest={setSelectedTestId}
            emptyMessage="No pending tests. New lab orders will appear here."
          />
        </TabsContent>

        <TabsContent value="inprogress">
          <LabTestQueue
            tests={inProgressTests}
            onSelectTest={setSelectedTestId}
            emptyMessage="No tests in progress. Tests will appear here when collection is started."
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
  const [from, setFrom] = useState(new Date(new Date().setHours(0,0,0,0)).toISOString().split('T')[0])
  const [to, setTo] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('Completed')
  const [format, setFormat] = useState<'csv'|'xlsx'|'pdf'>('csv')
  const [exporting, setExporting] = useState(false)
  const [rangePreset, setRangePreset] = useState<'custom'|'today'|'last7'|'month'>('today')

  useEffect(() => {
    const now = new Date()
    if (rangePreset === 'today') {
      const today = now.toISOString().split('T')[0]
      setFrom(today)
      setTo(today)
    } else if (rangePreset === 'last7') {
      const last7 = new Date(now)
      last7.setDate(last7.getDate() - 7)
      setFrom(last7.toISOString().split('T')[0])
      setTo(now.toISOString().split('T')[0])
    } else if (rangePreset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      setFrom(firstDay.toISOString().split('T')[0])
      setTo(now.toISOString().split('T')[0])
    }
  }, [rangePreset])

  const exportNow = async () => {
    setExporting(true)
    try {
      const fromDate = new Date(from)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      
      let blob: Blob
      if (format === 'pdf') {
        const url = new URL('/api/lab-tests/pdf', window.location.origin)
        url.searchParams.set('from', fromDate.toISOString())
        url.searchParams.set('to', toDate.toISOString())
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}))
          throw new Error(errorData.error || 'Export failed')
        }
        blob = await resp.blob()
      } else if (format === 'xlsx') {
        const url = new URL('/api/lab-tests/xlsx', window.location.origin)
        url.searchParams.set('from', fromDate.toISOString())
        url.searchParams.set('to', toDate.toISOString())
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}))
          throw new Error(errorData.error || 'Export failed')
        }
        blob = await resp.blob()
      } else {
        const url = new URL('/api/lab-tests/csv', window.location.origin)
        url.searchParams.set('from', fromDate.toISOString())
        url.searchParams.set('to', toDate.toISOString())
        if (status) url.searchParams.set('status', status)
        const resp = await fetch(url.toString(), { credentials: 'include' })
        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}))
          throw new Error(errorData.error || 'Export failed')
        }
        blob = await resp.blob()
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = (format === 'pdf') ? 'pdf' : (format === 'xlsx' ? 'xlsx' : 'csv')
      a.download = `labs-${from}-to-${to}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Lab tests exported successfully as ${format.toUpperCase()}`)
    } catch (e: any) {
      toast.error(e?.message || 'Export failed')
    } finally { 
      setExporting(false) 
    }
  }

  const exportAnalytes = async () => {
    setExporting(true)
    try {
      const fromDate = new Date(from)
      fromDate.setHours(0, 0, 0, 0)
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      
      const url = new URL('/api/lab-tests/csv', window.location.origin)
      url.searchParams.set('from', fromDate.toISOString())
      url.searchParams.set('to', toDate.toISOString())
      if (status) url.searchParams.set('status', status)
      const r = await fetch(url.toString(), { credentials: 'include' })
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'CSV export failed')
      }
      const blob = await r.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj
      a.download = `labs-analytes-${from}-to-${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(obj)
      toast.success('Analytes CSV exported successfully')
    } catch (e: any) {
      toast.error(e?.message || 'CSV export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Quick Range</Label>
          <Select value={rangePreset} onValueChange={(v: any) => setRangePreset(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="last7">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input 
            type="date" 
            value={from} 
            onChange={(e) => { setFrom(e.target.value); setRangePreset('custom') }}
            disabled={rangePreset !== 'custom'}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input 
            type="date" 
            value={to} 
            onChange={(e) => { setTo(e.target.value); setRangePreset('custom') }}
            disabled={rangePreset !== 'custom'}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={(v: any) => setFormat(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 border border-border">
          <span className="font-medium text-muted-foreground">Status:</span>
          <span>{status}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 border border-border">
          <span className="font-medium text-muted-foreground">Range:</span>
          <span>{from} → {to}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 border border-border">
          <span className="font-medium text-muted-foreground">Format:</span>
          <span>{format.toUpperCase()}</span>
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={exportNow}
          disabled={exporting}
          className="bg-sky-600 hover:bg-sky-700"
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Export
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={exportAnalytes}
          disabled={exporting}
        >
          {exporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            'Analytes CSV'
          )}
        </Button>
      </div>
    </div>
  )
}
