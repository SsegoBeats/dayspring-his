"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { runExport, runBatchExport, type ExportPayload } from "@/lib/reception-export-utils"
import { RECEPTION_DEPARTMENTS } from "@/lib/constants/departments"

const FILTERS_BASE = (from: string, to: string, department: string) => ({
  from: new Date(from + "T00:00:00Z").toISOString(),
  to: new Date(to + "T23:59:59Z").toISOString(),
  department: department === "ALL" ? undefined : department,
})

export function ReceptionRegister() {
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0, 10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0, 10))
  const [department, setDepartment] = useState<string>("ALL")
  const [detailed, setDetailed] = useState<boolean>(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const baseFilters = FILTERS_BASE(from, to, department)

  const buildPayload = (dataset: string, format: "xlsx" | "pdf" | "csv"): ExportPayload => ({
    dataset,
    format,
    filters: baseFilters,
  })

  const exportFile = async (format: "xlsx" | "pdf") => {
    const key = `register-${format}` as const
    setExporting(key)
    const payload = buildPayload(detailed ? "reception_register_detailed" : "reception_register", format)
    const result = await runExport(payload, `reception-register-${from}-${to}.${format}`, {
      onError: (msg) => toast.error(`Reception register ${format.toUpperCase()} failed`, { description: msg }),
      onSuccess: () => toast.success(`Downloaded reception-register-${from}-${to}.${format}`),
    })
    setExporting(null)
    return result
  }

  const runSingleExport = async (
    dataset: string,
    format: "csv" | "xlsx" | "pdf",
    filename: string,
    label: string
  ) => {
    const payload = buildPayload(dataset, format)
    return runExport(payload, filename, {
      onError: (msg) => toast.error(`${label} failed`, { description: msg }),
      onSuccess: () => toast.success(`Downloaded ${filename}`),
    })
  }

  const runBatch = async (
    tasks: { dataset: string; format: "pdf" | "xlsx"; filename: string; label: string }[]
  ) => {
    setExporting("batch")
    const { success, failed, failedLabels } = await runBatchExport(
      tasks.map((t) => ({
        payload: buildPayload(t.dataset, t.format),
        filename: t.filename,
        label: t.label,
      })),
      {
        onError: (label, msg) => toast.error(`${label} failed`, { description: msg }),
        onComplete: (s, f, labels) => {
          if (f > 0) {
            toast.warning(`Batch export: ${s} succeeded, ${f} failed`, {
              description: labels.length ? labels.join(", ") : undefined,
            })
          } else if (s > 0) {
            toast.success(`Downloaded ${s} file(s)`)
          }
        },
      }
    )
    setExporting(null)
    return { success, failed, failedLabels }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reception Register</CardTitle>
        <CardDescription>Summary of check-ins, queue and payments for a period</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-12">
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">From</label>
          <Input id="reception-register-from" name="dateFrom" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">To</label>
          <Input id="reception-register-to" name="dateTo" type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-medium">Department</label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {RECEPTION_DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 flex-wrap md:col-span-3">
          <label className="text-sm flex items-center gap-2 whitespace-nowrap">
            <input type="checkbox" checked={detailed} onChange={(e)=>setDetailed(e.target.checked)} />
            Detailed
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-12">
          <Button
            variant="outline"
            disabled={!!exporting}
            onClick={() =>
              runBatch([
                { dataset: detailed ? "reception_register_detailed" : "reception_register", format: "pdf", filename: `reception-register-${from}-${to}.pdf`, label: "Register PDF" },
                { dataset: "reception_dashboard", format: "pdf", filename: `reception-dashboard-${from}-${to}.pdf`, label: "Dashboard PDF" },
                { dataset: "reception_daily", format: "pdf", filename: `reception-daily-${from}-${to}.pdf`, label: "Daily PDF" },
              ])
            }
          >
            {exporting === "batch" ? "Exporting…" : "Export All PDFs"}
          </Button>
          <Button
            variant="outline"
            disabled={!!exporting}
            onClick={() =>
              runBatch([
                { dataset: detailed ? "reception_register_detailed" : "reception_register", format: "xlsx", filename: `reception-register-${from}-${to}.xlsx`, label: "Register XLSX" },
                { dataset: "reception_dashboard", format: "xlsx", filename: `reception-dashboard-${from}-${to}.xlsx`, label: "Dashboard XLSX" },
                { dataset: "reception_daily", format: "xlsx", filename: `reception-daily-${from}-${to}.xlsx`, label: "Daily XLSX" },
              ])
            }
          >
            {exporting === "batch" ? "Exporting…" : "Export All XLSX"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!!exporting}>
                Reception Register <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => exportFile("pdf")} disabled={!!exporting}>
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportFile("xlsx")} disabled={!!exporting}>
                XLSX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport(
                    detailed ? "reception_register_detailed" : "reception_register",
                    "csv",
                    `reception-register-${from}-${to}.csv`,
                    "Reception Register CSV"
                  )
                }
                disabled={!!exporting}
              >
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!!exporting}>
                Reception Dashboard <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_dashboard", "pdf", `reception-dashboard-${from}-${to}.pdf`, "Reception Dashboard PDF")
                }
                disabled={!!exporting}
              >
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_dashboard", "xlsx", `reception-dashboard-${from}-${to}.xlsx`, "Reception Dashboard XLSX")
                }
                disabled={!!exporting}
              >
                XLSX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_dashboard", "csv", `reception-dashboard-${from}-${to}.csv`, "Reception Dashboard CSV")
                }
                disabled={!!exporting}
              >
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!!exporting}>
                Reception Daily <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_daily", "pdf", `reception-daily-${from}-${to}.pdf`, "Reception Daily PDF")
                }
                disabled={!!exporting}
              >
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_daily", "xlsx", `reception-daily-${from}-${to}.xlsx`, "Reception Daily XLSX")
                }
                disabled={!!exporting}
              >
                XLSX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  runSingleExport("reception_daily", "csv", `reception-daily-${from}-${to}.csv`, "Reception Daily CSV")
                }
                disabled={!!exporting}
              >
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}

