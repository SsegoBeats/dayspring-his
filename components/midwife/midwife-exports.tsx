"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type ExportFormat = "csv" | "xlsx" | "pdf"
type Dataset = "obstetrics" | "labor" | "postnatal"

interface DatasetConfig {
  id: Dataset
  title: string
  description: string
}

const DATASETS: DatasetConfig[] = [
  {
    id: "obstetrics",
    title: "ANC Assessments",
    description:
      "Antenatal care visit records. Each row includes visit date, patient name, gestational age, EDD, fundal height, fetal heart rate, presentation, and recording midwife.",
  },
  {
    id: "labor",
    title: "Labor & Delivery Records",
    description:
      "Intrapartum records. Each row includes admission date, delivery date, delivery type, duration of labour, presentation, complications, and baby details (sex, weight, APGAR scores, condition).",
  },
  {
    id: "postnatal",
    title: "Postnatal Visits",
    description:
      "Postnatal follow-up records. Each row includes visit date, days postpartum, blood pressure, temperature, lochia, wound healing, breastfeeding status, baby weight, and condition.",
  },
]

function DatasetExportCard({ dataset }: { dataset: DatasetConfig }) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [mineOnly, setMineOnly] = useState(true)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  async function doExport(format: ExportFormat) {
    const fromTs = new Date(from + "T00:00:00Z").getTime()
    const toTs = new Date(to + "T23:59:59Z").getTime()
    if (fromTs > toTs) {
      toast.error("From date must be on or before To date")
      return
    }
    setExporting(format)
    try {
      const payload: { dataset: string; format: string; filters: Record<string, unknown> } = {
        dataset: dataset.id,
        format,
        filters: {
          from: new Date(from + "T00:00:00Z").toISOString(),
          to: new Date(to + "T23:59:59Z").toISOString(),
        },
      }
      if (mineOnly) payload.filters.recordedByUserId = true

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
      a.download = `${dataset.id}-${from}-${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${dataset.title} export (${format.toUpperCase()}) downloaded`)
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  return (
    <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
            <Download className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-slate-700">{dataset.title}</CardTitle>
            <CardDescription className="text-xs text-slate-400">{dataset.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="midwife-export-from" className="text-xs font-medium text-slate-600">From</label>
            <Input
              id="midwife-export-from"
              name="exportFrom"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="focus-visible:ring-rose-400"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="midwife-export-to" className="text-xs font-medium text-slate-600">To</label>
            <Input
              id="midwife-export-to"
              name="exportTo"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="focus-visible:ring-rose-400"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => setMineOnly(e.target.checked)}
            className="rounded border-rose-300 text-rose-600"
          />
          <span className="text-slate-600">Export my records only</span>
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
            <Button
              key={fmt}
              variant="outline"
              size="sm"
              onClick={() => doExport(fmt)}
              disabled={!!exporting}
              className="border-rose-200 text-rose-700 hover:bg-rose-50"
            >
              {exporting === fmt ? "Exporting…" : `Export ${fmt.toUpperCase()}`}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function MidwifeExports() {
  return (
    <div className="space-y-6 p-1">
      {DATASETS.map((ds) => (
        <DatasetExportCard key={ds.id} dataset={ds} />
      ))}
    </div>
  )
}
