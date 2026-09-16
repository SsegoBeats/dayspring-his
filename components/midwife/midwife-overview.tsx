"use client"
import { useEffect, useState } from "react"
import {
  ClipboardList, Users, Baby, CalendarClock,
  HeartPulse, Plus, Stethoscope, FlaskConical
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ObsSummary {
  assessmentsCount: number
  patientsCount: number
  activePregnancies: number
  upcomingDeliveries: number
}

interface RecentVisit {
  id: string
  patient_name: string
  patient_number: string | null
  visit_date: string
  gestational_age_weeks: number | null
  edd: string | null
}

interface StatCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  loading: boolean
}

function StatCard({ title, value, icon, loading }: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-pink-50/30 shadow-sm shadow-rose-100/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
        <div className="rounded-xl bg-rose-50 p-2 text-rose-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums text-slate-800">
          {loading ? "—" : (value ?? 0)}
        </div>
      </CardContent>
    </Card>
  )
}

interface MidwifeOverviewProps {
  onNavigate: (tab: string, section?: string) => void
}

export function MidwifeOverview({ onNavigate }: MidwifeOverviewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [summary, setSummary] = useState<ObsSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([])
  const [loadingVisits, setLoadingVisits] = useState(true)
  const [todayCount, setTodayCount] = useState<number | null>(null)

  useEffect(() => {
    const from = encodeURIComponent(new Date(today + "T00:00:00Z").toISOString())
    const to = encodeURIComponent(new Date(today + "T23:59:59Z").toISOString())
    setLoadingSummary(true)
    Promise.all([
      fetch("/api/obstetrics/summary", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/obstetrics/summary?from=${from}&to=${to}`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([all, todaySummary]) => {
        if (all) setSummary(all)
        if (todaySummary) setTodayCount(todaySummary.assessmentsCount ?? 0)
      })
      .catch(() => {})
      .finally(() => setLoadingSummary(false))
  }, [today])

  useEffect(() => {
    setLoadingVisits(true)
    const from = encodeURIComponent(new Date(today + "T00:00:00Z").toISOString())
    const to = encodeURIComponent(new Date(today + "T23:59:59Z").toISOString())
    fetch(`/api/obstetrics/visits?from=${from}&to=${to}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { visits: [] })
      .then((data) => setRecentVisits(Array.isArray(data.visits) ? data.visits.slice(0, 5) : []))
      .catch(() => setRecentVisits([]))
      .finally(() => setLoadingVisits(false))
  }, [today])

  return (
    <div className="space-y-6 p-1">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Today's ANC Visits" value={todayCount} icon={<ClipboardList className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Active Pregnancies" value={summary?.activePregnancies ?? null} icon={<HeartPulse className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Upcoming Deliveries (4 wks)" value={summary?.upcomingDeliveries ?? null} icon={<Baby className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Total ANC Patients" value={summary?.patientsCount ?? null} icon={<Users className="h-4 w-4" />} loading={loadingSummary} />
        <StatCard title="Total Assessments" value={summary?.assessmentsCount ?? null} icon={<ClipboardList className="h-4 w-4" />} loading={loadingSummary} />

        {/* Quick Actions card */}
        <Card className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-pink-50/30 shadow-sm shadow-rose-100/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              size="sm"
              className="w-full justify-start gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              onClick={() => onNavigate("anc", "new")}
            >
              <Plus className="h-4 w-4" /> New ANC Visit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
              onClick={() => onNavigate("labor", "new")}
            >
              <Baby className="h-4 w-4" /> Record Delivery
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl"
              onClick={() => onNavigate("clinical", "lab")}
            >
              <FlaskConical className="h-4 w-4" /> Order Lab Test
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Today's ANC activity */}
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="border-b border-rose-50 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-rose-600" />
            Today&apos;s ANC Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingVisits ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</p>
          ) : recentVisits.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No ANC visits recorded today.</p>
          ) : (
            <div className="divide-y divide-rose-50">
              {recentVisits.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-rose-50/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{v.patient_name}</p>
                    <p className="text-xs text-slate-400">
                      {v.patient_number ? `#${v.patient_number} · ` : ""}
                      {v.gestational_age_weeks != null ? `${v.gestational_age_weeks} wks GA` : "GA not recorded"}
                      {v.edd ? ` · EDD ${String(v.edd).slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-rose-400">
                    <CalendarClock className="h-3 w-3" />
                    {String(v.visit_date).slice(11, 16)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
