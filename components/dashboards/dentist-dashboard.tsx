"use client"

import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Stethoscope, FileText } from "lucide-react"

type DentalSummary = {
  visitsCount: number
  patientsCount: number
  recentRecords: Array<{
    id: string
    patientId: string
    visitDate: string
    diagnosis: string | null
    procedurePerformed: string | null
    patientNumber: string | null
    patientName: string
  }>
}

export function DentistDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exportMineOnly, setExportMineOnly] = useState(false)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | "csv" | null>(null)
  const [summary, setSummary] = useState<DentalSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fromTs = new Date(today + "T00:00:00Z").toISOString()
    const toTs = new Date(today + "T23:59:59Z").toISOString()
    setSummaryLoading(true)
    fetch(`/api/dental/summary?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data)
          setSummary({
            visitsCount: data.visitsCount ?? 0,
            patientsCount: data.patientsCount ?? 0,
            recentRecords: Array.isArray(data.recentRecords) ? data.recentRecords : [],
          })
        else if (!cancelled) setSummary(null)
      })
      .catch(() => { if (!cancelled) setSummary(null) })
      .finally(() => { if (!cancelled) setSummaryLoading(false) })
    return () => { cancelled = true }
  }, [today])

  const exportDental = async (format: "xlsx" | "pdf" | "csv") => {
    const fromDate = new Date(from + "T00:00:00Z").getTime()
    const toDate = new Date(to + "T23:59:59Z").getTime()
    if (fromDate > toDate) {
      toast.error("From date must be on or before To date")
      return
    }
    setExporting(format)
    try {
      const payload: { dataset: string; format: string; filters: Record<string, unknown> } = {
        dataset: "dental",
        format,
        filters: {
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T23:59:59Z").toISOString(),
        },
      }
      if (exportMineOnly) payload.filters.recordedByUserId = true
      const res = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dental-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Dental export (${format.toUpperCase()}) downloaded`)
    } catch (e) {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Dental-specific overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-sky-200 bg-gradient-to-br from-sky-50 via-white to-sky-50/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Dental Visits</CardTitle>
            <Stethoscope className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="text-2xl font-bold text-sky-900">—</div>
            ) : (
              <div className="text-3xl font-bold text-sky-900">{summary?.visitsCount ?? 0}</div>
            )}
            <p className="text-xs text-sky-700">Recorded by you today</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-white/90 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Dental Records</CardTitle>
            <FileText className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (summary?.recentRecords?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No recent dental records</p>
            ) : (
              <ul className="space-y-2">
                {(summary?.recentRecords ?? []).slice(0, 5).map((r) => (
                  <li key={r.id} className="rounded border border-sky-100 bg-sky-50/40 px-2 py-1.5 text-sm">
                    <span className="font-medium text-foreground">{r.patientName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.diagnosis || "Visit"} · {r.visitDate ? String(r.visitDate).slice(0, 10) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-sky-200 bg-sky-50/60">
        <CardHeader>
          <CardTitle className="text-sm">Dental Exports</CardTitle>
          <CardDescription className="text-xs">
            Download dental visit summaries for a date range
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-12 items-end">
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs font-medium">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-xs font-medium">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 md:col-span-6 justify-end">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportMineOnly}
                  onChange={(e) => setExportMineOnly(e.target.checked)}
                  className="rounded border-input"
                />
                Export my records only
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDental("csv")}
              disabled={!!exporting}
            >
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDental("xlsx")}
              disabled={!!exporting}
            >
              {exporting === "xlsx" ? "Exporting…" : "Export XLSX"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDental("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-1 shadow-sm shadow-sky-100">
        <DoctorDashboard title="Dentist Dashboard" showDentalQueueFilter />
      </div>
    </div>
  )
}
