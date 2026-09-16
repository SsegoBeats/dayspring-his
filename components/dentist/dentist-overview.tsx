"use client"
import { useEffect, useState } from "react"
import { Stethoscope, Users, Activity, Clock, FlaskConical, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DentalSummary {
  visitsCount: number
  patientsCount: number
  proceduresThisWeek: number
  pendingFollowUps: number
  pendingLabResults: number
  pendingPreAuths: number
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

interface StatCardProps {
  title: string
  value: number | null
  icon: React.ReactNode
  loading: boolean
}

function StatCard({ title, value, icon, loading }: StatCardProps) {
  return (
    <Card className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/30 shadow-sm shadow-cyan-100/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-slate-500">{title}</CardTitle>
        <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tabular-nums text-slate-800">
          {loading ? "—" : value ?? 0}
        </div>
      </CardContent>
    </Card>
  )
}

interface DentistOverviewProps {
  onNavigate: (tab: string, section?: string) => void
}

export function DentistOverview({ onNavigate }: DentistOverviewProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [summary, setSummary] = useState<DentalSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fromTs = new Date(today + "T00:00:00Z").toISOString()
    const toTs = new Date(today + "T23:59:59Z").toISOString()
    setLoading(true)
    fetch(`/api/dental/summary?from=${encodeURIComponent(fromTs)}&to=${encodeURIComponent(toTs)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSummary({
          visitsCount: data.visitsCount ?? 0,
          patientsCount: data.patientsCount ?? 0,
          proceduresThisWeek: data.proceduresThisWeek ?? 0,
          pendingFollowUps: data.pendingFollowUps ?? 0,
          pendingLabResults: data.pendingLabResults ?? 0,
          pendingPreAuths: data.pendingPreAuths ?? 0,
          recentRecords: Array.isArray(data.recentRecords) ? data.recentRecords : [],
        })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [today])

  const stats = [
    { title: "Today's Visits", value: summary?.visitsCount ?? null, icon: <Stethoscope className="h-4 w-4" /> },
    { title: "Patients This Month", value: summary?.patientsCount ?? null, icon: <Users className="h-4 w-4" /> },
    { title: "Procedures This Week", value: summary?.proceduresThisWeek ?? null, icon: <Activity className="h-4 w-4" /> },
    { title: "Pending Follow-ups", value: summary?.pendingFollowUps ?? null, icon: <Clock className="h-4 w-4" /> },
    { title: "Pending Lab Results", value: summary?.pendingLabResults ?? null, icon: <FlaskConical className="h-4 w-4" /> },
    { title: "Insurance Pre-Auths", value: summary?.pendingPreAuths ?? null, icon: <ShieldCheck className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      {/* 6-stat grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} loading={loading} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-3">Quick Actions</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Order Lab Test", sub: "Request blood work or specimen", tab: "clinical", section: "lab" },
            { label: "Write Prescription", sub: "Prescribe post-procedure medications", tab: "clinical", section: "rx" },
            { label: "Request Radiology", sub: "OPG, periapical, CBCT and more", tab: "clinical", section: "radiology" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.tab, a.section)}
              className="rounded-xl border-2 border-cyan-100 bg-white hover:bg-cyan-50 hover:border-cyan-300 transition-all p-4 text-left group"
            >
              <p className="text-sm font-semibold text-slate-700 group-hover:text-cyan-700">{a.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{a.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent records */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-3">Recent Dental Records</p>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (summary?.recentRecords?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-cyan-200 py-8 text-center">
            <p className="text-sm text-slate-400">No dental records yet.</p>
            <p className="text-xs text-slate-300 mt-1">Records you create will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {summary!.recentRecords.slice(0, 8).map((r) => (
              <div
                key={r.id}
                className="rounded-xl border-l-4 border-cyan-400 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{r.patientName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.diagnosis || "Visit"} · {r.visitDate ? String(r.visitDate).slice(0, 10) : ""}
                    </p>
                  </div>
                  {r.procedurePerformed && (
                    <span className="text-[10px] font-medium text-teal-600 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 hidden sm:block">
                      {r.procedurePerformed.slice(0, 20)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
