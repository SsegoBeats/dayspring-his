"use client"

import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function MidwifeDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const exportObstetrics = async (format: "xlsx" | "pdf") => {
    const payload = {
      dataset: "obstetrics",
      format,
      filters: {
        from: new Date(from + "T00:00:00Z").toISOString(),
        to: new Date(to + "T23:59:59Z").toISOString(),
      },
    }
    const res = await fetch("/api/exports/direct", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `obstetrics-${from}-${to}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
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
          <div className="flex gap-2 md:col-span-6 justify-end">
            <Button variant="outline" size="sm" onClick={() => exportObstetrics("xlsx")}>
              Export XLSX
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportObstetrics("pdf")}>
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-1 shadow-sm shadow-rose-100">
        <DoctorDashboard title="Midwifery Dashboard" />
      </div>
    </div>
  )
}
