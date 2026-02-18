"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, ClipboardList, Stethoscope } from "lucide-react"
import Link from "next/link"

type Visit = {
  id: string
  patient_id: string
  visit_date: string
  gravida: number | null
  parity: number | null
  gestational_age_weeks: number | null
  edd: string | null
  fundal_height_cm: number | null
  fetal_heart_rate: number | null
  presentation: string | null
  notes: string | null
  patient_number: string | null
  patient_name: string
  recorded_by: string | null
}

export default function MidwifeAncPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Midwife") {
      router.replace("/dashboard")
      return
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (!user || user.role !== "Midwife") return
    let cancelled = false
    setLoading(true)
    const fromTs = new Date(from + "T00:00:00Z").toISOString()
    const toTs = new Date(to + "T23:59:59Z").toISOString()
    fetch(`/api/obstetrics/visits?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : { visits: [] }))
      .then((data) => {
        if (!cancelled) setVisits(Array.isArray(data.visits) ? data.visits : [])
      })
      .catch(() => { if (!cancelled) setVisits([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [from, to, user?.role])

  if (isLoading || !user || user.role !== "Midwife") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">ANC / Obstetric Visits</h1>
            <p className="text-sm text-muted-foreground">
              View obstetric assessments by date range. Open a patient from the dashboard to consult or add assessments.
            </p>
          </div>
        </div>

        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Date range</CardTitle>
            <CardDescription className="text-xs">Filter visits by visit date</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">From</label>
              <Input id="anc-dateFrom" name="dateFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">To</label>
              <Input id="anc-dateTo" name="dateTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <Stethoscope className="mr-2 h-4 w-4" />
                Back to dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-rose-100">
          <CardHeader>
            <CardTitle className="text-base">Visits ({visits.length})</CardTitle>
            <CardDescription>
              {from === to ? `Visit date: ${from}` : `${from} – ${to}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading visits…
              </div>
            ) : visits.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No visits in this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-rose-50/60 text-left text-xs font-medium uppercase tracking-wide text-rose-800">
                      <th className="p-3">Visit date</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">G</th>
                      <th className="p-3">P</th>
                      <th className="p-3">GA (wks)</th>
                      <th className="p-3">EDD</th>
                      <th className="p-3">FHR</th>
                      <th className="p-3">Recorded by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-rose-50/30">
                        <td className="p-3">{v.visit_date ? String(v.visit_date).slice(0, 10) : "—"}</td>
                        <td className="p-3 font-medium">{v.patient_name || "—"}</td>
                        <td className="p-3">{v.gravida ?? "—"}</td>
                        <td className="p-3">{v.parity ?? "—"}</td>
                        <td className="p-3">{v.gestational_age_weeks ?? "—"}</td>
                        <td className="p-3">{v.edd ? String(v.edd).slice(0, 10) : "—"}</td>
                        <td className="p-3">{v.fetal_heart_rate ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{v.recorded_by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
