"use client"
import { useEffect, useMemo, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { PatientConsultation } from "@/components/doctor/patient-consultation"
import type { ConsultTab } from "@/components/doctor/patient-consultation"
import { PatientQueue } from "@/components/doctor/patient-queue"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { useLab } from "@/lib/lab-context"
import { Users, Stethoscope, Pill, FlaskConical, Calendar } from "lucide-react"
import Link from "next/link"
import { ClinicianNotificationBell } from "@/components/doctor/clinician-notification-bell"

interface DoctorDashboardProps {
  title?: string
  showDentalQueueFilter?: boolean
}

interface SelectedPatient { id: string; tab: ConsultTab }

export function DoctorDashboard({ title, showDentalQueueFilter }: DoctorDashboardProps) {
  const { patients, getAppointmentsByDoctor } = usePatients()
  const { medicalRecords, prescriptions } = useMedical()
  const { user } = useAuth()

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], [])
  const todayAppointments = user?.name ? getAppointmentsByDoctor(user.name, todayStr) : []
  const todayDentalAppointments = todayAppointments.filter(
    (a) => (a.department || "").toLowerCase() === "dental",
  )
  const dentalQueuePatientIds = todayDentalAppointments.map((a) => a.patientId)
  const [queueView, setQueueView] = useState<"all" | "dental">("all")

  const todayRecords = useMemo(
    () => medicalRecords.filter((mr) => mr.date === todayStr && mr.doctorName === user?.name),
    [medicalRecords, todayStr, user?.name]
  )
  const activePrescriptions = useMemo(
    () => prescriptions.filter((p) => p.status === "active" && p.doctorName === user?.name),
    [prescriptions, user?.name]
  )

  // Pending lab reviews — labs with status "Completed" but not yet "Reviewed" for this doctor
  const { tests: allLabTests } = useLab()
  const pendingLabReviews = useMemo(
    () => allLabTests.filter((t) => t.status === "Completed" && t.doctorName === user?.name).length,
    [allLabTests, user?.name]
  )

  // Consultation Sheet state
  const [selected, setSelected] = useState<SelectedPatient | null>(null)
  const [pendingNotifId, setPendingNotifId] = useState<string | null>(null)

  const handleSelectPatient = (patientId: string) => {
    setSelected({ id: patientId, tab: "consultation" })
  }
  const handleClose = () => setSelected(null)

  // Live clock
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const tick = setInterval(() => setClockTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(tick)
  }, [])

  // Portal title pill
  const portalTitle =
    user?.role === "Dentist" ? "Dentist Portal" :
    user?.role === "Midwife" ? "Midwifery Portal" :
    "Clinician Portal"

  // openClinicianConsult CustomEvent — MUST be preserved exactly
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail || {}
        if (detail.patientId) {
          setSelected({ id: detail.patientId, tab: (detail.initialTab as ConsultTab) || "labs" })
          if (detail.notificationId) setPendingNotifId(detail.notificationId)
        }
      } catch {}
    }
    window.addEventListener("openClinicianConsult", handler)
    return () => window.removeEventListener("openClinicianConsult", handler)
  }, [])

  // Auto-mark notification read when consultation opens
  useEffect(() => {
    if (selected && pendingNotifId) {
      ;(async () => {
        try {
          await fetch("/api/notifications", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [pendingNotifId] }),
          })
        } catch {}
        setPendingNotifId(null)
      })()
    }
  }, [selected, pendingNotifId])

  const recentRecords = useMemo(
    () => [...medicalRecords].slice(-5).reverse(),
    [medicalRecords]
  )

  const statCards = useMemo(() => [
    {
      label: "Total Patients",
      value: patients.length,
      accent: "border-teal-500",
      iconBg: "bg-teal-100",
      icon: <Users className="h-5 w-5 text-teal-600" />,
      sub: "Registered patients",
    },
    {
      label: "Today's Consultations",
      value: todayRecords.length,
      accent: "border-sky-500",
      iconBg: "bg-sky-100",
      icon: <Stethoscope className="h-5 w-5 text-sky-600" />,
      sub: "Completed today",
    },
    {
      label: "Active Prescriptions",
      value: activePrescriptions.length,
      accent: "border-amber-500",
      iconBg: "bg-amber-100",
      icon: <Pill className="h-5 w-5 text-amber-600" />,
      sub: "Currently active",
    },
    {
      label: "Pending Lab Reviews",
      value: pendingLabReviews,
      accent: "border-violet-500",
      iconBg: "bg-violet-100",
      icon: <FlaskConical className="h-5 w-5 text-violet-600" />,
      sub: "Awaiting review",
      pulse: pendingLabReviews > 0,
    },
  ], [patients.length, todayRecords.length, activePrescriptions.length, pendingLabReviews])

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-cyan-900 p-8 text-white shadow-xl">
        <div className="absolute -left-8 -top-8 h-48 w-48 rounded-full bg-rose-400/20 blur-3xl" />
        <div className="absolute -bottom-8 -right-8 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium">
              <Stethoscope className="h-4 w-4" />
              {title || portalTitle}
            </span>
            <h1 className="text-3xl font-bold tracking-tight">
              Your patients. Your decisions. Your practice.
            </h1>
            <p className="mt-2 text-teal-200">
              Consultations, prescriptions, labs, and records — all in one place.
            </p>
          </div>
          {/* Actions + Shift Snapshot */}
          <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <ClinicianNotificationBell />
          </div>
          {/* Shift Snapshot */}
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-white md:min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Shift Snapshot</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-teal-200">Consultations today</span>
                <span className="font-bold">{todayRecords.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-teal-200">Pending lab reviews</span>
                <span className="font-bold">{pendingLabReviews}</span>
              </div>
              <div className="mt-2 text-center font-mono text-lg font-bold">{clockTime}</div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className={`overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm border-t-4 ${card.accent}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">{card.label}</CardTitle>
              <div className={`rounded-lg p-2 ${card.iconBg}`}>{card.icon}</div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold text-slate-900 ${card.pulse ? "animate-pulse" : ""}`}>
                {card.value}
              </div>
              <p className="text-xs text-slate-500">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today's Appointments */}
      <Card className="rounded-2xl border border-teal-100 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Today&apos;s Appointments</CardTitle>
          <Link href="/appointments/calendar" className="flex items-center gap-1 text-xs text-teal-600 hover:underline">
            <Calendar className="h-3.5 w-3.5" />
            View calendar
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-900">{todayAppointments.length}</div>
          <p className="text-xs text-slate-500">Scheduled for you today</p>
        </CardContent>
      </Card>

      {/* Recent Medical Records */}
      <Card className="rounded-2xl border border-teal-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Recent Medical Records</CardTitle>
        </CardHeader>
        <CardContent>
          {medicalRecords.length === 0 ? (
            <p className="text-center text-sm text-slate-500">No medical records yet.</p>
          ) : (
            <div className="space-y-3">
              {recentRecords.map((record) => (
                <div key={record.id} className="rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{record.patientName}</p>
                      <p className="text-sm text-slate-600">{record.diagnosis}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">{record.date}</p>
                      <p className="text-xs text-slate-500">{record.doctorName}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Queue */}
      <div>
        <h3 className="mb-4 text-xl font-bold tracking-tight text-slate-900">Patient Queue</h3>
        {showDentalQueueFilter && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">Queue:</span>
            <button
              type="button"
              onClick={() => setQueueView("all")}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${queueView === "all" ? "bg-teal-700 text-white border-teal-700" : "border-teal-200 text-teal-700 hover:bg-teal-50"}`}
            >
              All patients
            </button>
            <button
              type="button"
              onClick={() => setQueueView("dental")}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${queueView === "dental" ? "bg-teal-700 text-white border-teal-700" : "border-teal-200 text-teal-700 hover:bg-teal-50"}`}
            >
              Today&apos;s dental appointments ({dentalQueuePatientIds.length})
            </button>
          </div>
        )}
        <PatientQueue
          onSelectPatient={handleSelectPatient}
          filterPatientIds={showDentalQueueFilter && queueView === "dental" ? dentalQueuePatientIds : undefined}
          filterEmptyMessage="No patients with dental appointments today."
        />
      </div>

      {/* Consultation Sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) handleClose() }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:w-[85vw] sm:max-w-none">
          <SheetHeader className="sr-only">
            <SheetTitle>Patient Consultation</SheetTitle>
            <SheetDescription>Consultation, prescription, labs, and patient history.</SheetDescription>
          </SheetHeader>
          {selected && (
            <PatientConsultation
              key={selected.id}
              patientId={selected.id}
              initialTab={selected.tab}
              onClose={handleClose}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
