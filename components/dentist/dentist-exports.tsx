"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function DentistExports() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exportMineOnly, setExportMineOnly] = useState(true)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | "csv" | null>(null)

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
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6 p-1">
      <Card className="rounded-2xl border border-cyan-100 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-600">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">Dental Record Exports</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Download dental visit summaries. Each row includes visit date, patient name,
                diagnosis, procedure performed, tooth chart notes, and prescribing dentist.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="dentist-export-from" className="text-xs font-medium text-slate-600">From</label>
              <Input id="dentist-export-from" name="exportFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="focus-visible:ring-cyan-400" />
            </div>
            <div className="space-y-1">
              <label htmlFor="dentist-export-to" className="text-xs font-medium text-slate-600">To</label>
              <Input id="dentist-export-to" name="exportTo" type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="focus-visible:ring-cyan-400" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exportMineOnly}
              onChange={(e) => setExportMineOnly(e.target.checked)}
              className="rounded border-cyan-300 text-cyan-600"
            />
            <span className="text-slate-600">Export my records only</span>
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
              <Button
                key={fmt}
                variant="outline"
                size="sm"
                onClick={() => exportDental(fmt)}
                disabled={!!exporting}
                className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
              >
                {exporting === fmt ? "Exporting…" : `Export ${fmt.toUpperCase()}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
