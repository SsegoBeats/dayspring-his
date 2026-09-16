"use client"
import { useEffect, useState } from "react"
import { Calendar, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"

interface TodayStats {
  count: number
  nextPatient: string | null
}

export function DentistSchedule() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const todayStr = new Date().toISOString().slice(0, 10)
    fetch(
      `/api/appointments?date=${todayStr}&department=Dental&limit=50`,
      { credentials: "include" }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const appts = Array.isArray(data?.appointments) ? data.appointments : []
        const sorted = appts
          .filter((a: { status?: string }) => a.status !== "cancelled" && a.status !== "completed")
          .sort((a: { appointment_date?: string; appointmentDate?: string }, b: { appointment_date?: string; appointmentDate?: string }) =>
            new Date(a.appointment_date ?? a.appointmentDate ?? 0).getTime() -
            new Date(b.appointment_date ?? b.appointmentDate ?? 0).getTime()
          )
        const next = sorted[0] as { patient_first_name?: string; patientName?: string; patient_last_name?: string } | undefined
        setStats({
          count: sorted.length,
          nextPatient: next
            ? [next.patient_first_name ?? next.patientName ?? "", next.patient_last_name ?? ""]
                .filter(Boolean).join(" ").trim() || null
            : null,
        })
      })
      .catch(() => { if (!cancelled) setStats({ count: 0, nextPatient: null }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/30 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Today&apos;s Dental Appointments</CardTitle>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
              <Calendar className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums text-slate-800">
              {loading ? "—" : stats?.count ?? 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Remaining today</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-cyan-100 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Next Patient</CardTitle>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-slate-400">Loading…</div>
            ) : stats?.nextPatient ? (
              <div className="text-base font-semibold text-slate-800">{stats.nextPatient}</div>
            ) : (
              <div className="text-sm text-slate-400">No upcoming patients</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-cyan-100 bg-cyan-50/30 p-1 shadow-sm">
        <DoctorDashboard title="Dental Queue" showDentalQueueFilter />
      </div>
    </div>
  )
}
