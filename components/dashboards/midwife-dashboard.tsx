"use client"

import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2, ClipboardList, Users } from "lucide-react"

type Summary = { assessmentsCount: number; patientsCount: number } | null

export function MidwifeDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | "csv" | null>(null)
  const [exportMineOnly, setExportMineOnly] = useState(false)
  const [summary, setSummary] = useState<Summary>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setSummaryLoading(true)
    const fromTs = new Date(from + "T00:00:00Z").toISOString()
    const toTs = new Date(to + "T23:59:59Z").toISOString()
    fetch(`/api/obstetrics/summary?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSummary({ assessmentsCount: data.assessmentsCount ?? 0, patientsCount: data.patientsCount ?? 0 })
        else if (!cancelled) setSummary(null)
      })
      .catch(() => { if (!cancelled) setSummary(null) })
      .finally(() => { if (!cancelled) setSummaryLoading(false) })
    return () => { cancelled = true }
  }, [from, to])

  const exportObstetrics = async (format: "xlsx" | "pdf" | "csv") => {
    if (new Date(from) > new Date(to)) {
      toast.error("From date must be on or before To date")
      return
    }
    setExporting(format)
    try {
      const payload: { dataset: string; format: string; filters: Record<string, unknown> } = {
        dataset: "obstetrics",
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
        const message = data?.error || (data?.details ? String(data.details) : null) || `Export failed (${res.status})`
        toast.error(message)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `obstetrics-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Obstetrics export (${format.toUpperCase()}) downloaded`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-rose-600" />
              Obstetric assessments (selected period)
            </CardTitle>
            <CardDescription className="text-xs">
              {from === to ? `On ${from}` : `${from} – ${to}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : summary ? (
              <div className="flex gap-6">
                <div>
                  <span className="text-2xl font-bold text-rose-900">{summary.assessmentsCount}</span>
                  <span className="text-xs text-rose-700 ml-1">assessments</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-rose-900">{summary.patientsCount}</span>
                  <span className="text-xs text-rose-700 ml-1">patients</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-rose-600" />
              ANC overview
            </CardTitle>
            <CardDescription className="text-xs">
              Use the date range below to export or change period for metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Adjust &quot;From&quot; and &quot;To&quot; to see counts for any period, then export to XLSX or PDF.
          </CardContent>
        </Card>
      </div>

      <Card className="border-rose-200 bg-rose-50/60">
        <CardHeader>
          <CardTitle className="text-sm">Obstetric Exports</CardTitle>
          <CardDescription className="text-xs">
            Download ANC and obstetric assessments for a date range
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-12 items-end">
          <div className="space-y-1 md:col-span-3">
            <label className="text-xs font-medium">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-3">
            <label className="text-xs font-medium">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-6 space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={exportMineOnly}
                onChange={(e) => setExportMineOnly(e.target.checked)}
                className="rounded border"
              />
              My assessments only
            </label>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportObstetrics("csv")}
                disabled={!!exporting}
              >
                {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportObstetrics("xlsx")}
                disabled={!!exporting}
              >
                {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Export XLSX
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportObstetrics("pdf")}
                disabled={!!exporting}
              >
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-1 shadow-sm shadow-rose-100">
        <DoctorDashboard title="Midwifery Dashboard" />
      </div>
    </div>
  )
}
