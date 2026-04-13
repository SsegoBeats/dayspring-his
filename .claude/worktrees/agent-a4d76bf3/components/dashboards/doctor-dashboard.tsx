"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { PatientConsultation } from "@/components/doctor/patient-consultation"
import { PatientQueue } from "@/components/doctor/patient-queue"
import { Users, FileText, Pill, Activity, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatPatientNumber } from "@/lib/patients"

interface DoctorDashboardProps {
  title?: string
  /** When true, show "All patients" vs "Today's dental appointments" toggle in Patient Queue. */
  showDentalQueueFilter?: boolean
}

export function DoctorDashboard({ title, showDentalQueueFilter }: DoctorDashboardProps) {
  const { patients, getAppointmentsByDoctor } = usePatients()
  const { medicalRecords, prescriptions } = useMedical()
  const { user } = useAuth()
  const todayStr = new Date().toISOString().split("T")[0]
  const todayAppointments = user?.name ? getAppointmentsByDoctor(user.name, todayStr) : []
  const todayDentalAppointments = todayAppointments.filter((a) => (a.department || "").toLowerCase() === "dental")
  const dentalQueuePatientIds = todayDentalAppointments.map((a) => a.patientId)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [consultTab, setConsultTab] = useState<"consultation"|"prescription"|"history"|"labs">("consultation")
  const [queueView, setQueueView] = useState<"all" | "dental">("all")

  const todayRecords = medicalRecords.filter((mr) => {
    const today = new Date().toISOString().split("T")[0]
    return mr.date === today && mr.doctorName === user?.name
  })

  const activePrescriptions = prescriptions.filter((p) => p.status === "active" && p.doctorName === user?.name)

  // Handle external request to open consult (e.g., from notifications)
  const [pendingNotifId, setPendingNotifId] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const detail = e.detail || {}
        if (detail.patientId) {
          setSelectedPatientId(detail.patientId)
          setConsultTab((detail.initialTab as any) || "labs")
          if (detail.notificationId) setPendingNotifId(detail.notificationId)
        }
      } catch {}
    }
    window.addEventListener('openClinicianConsult', handler as any)
    return () => window.removeEventListener('openClinicianConsult', handler as any)
  }, [])

  // Auto mark notification as read after dialog opens
  useEffect(() => {
    if (selectedPatientId && pendingNotifId) {
      ;(async ()=>{
        try {
          await fetch('/api/notifications', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [pendingNotifId] }) })
        } catch {}
        setPendingNotifId(null)
      })()
    }
  }, [selectedPatientId, pendingNotifId])

  return (
    <div className="space-y-6 relative">
      <div className="pointer-events-none absolute inset-0 opacity-70 blur-3xl">
        <div className="absolute -left-20 top-0 h-48 w-48 rounded-full bg-gradient-to-br from-sky-300/40 via-indigo-300/30 to-purple-300/30" />
        <div className="absolute right-10 top-10 h-52 w-52 rounded-full bg-gradient-to-br from-emerald-200/40 via-teal-200/30 to-sky-200/30" />
      </div>

      <div className="relative z-10">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {title || "Clinician Dashboard"}
        </h2>
        <p className="text-muted-foreground">View patients and manage medical records</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="relative z-10 bg-white/70 backdrop-blur">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patient Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-sky-50 via-white to-indigo-50 border-sky-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-sky-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{patients.length}</div>
                <p className="text-xs text-sky-700">Registered patients</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Consultations</CardTitle>
                <FileText className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-900">{todayRecords.length}</div>
                <p className="text-xs text-amber-700">Completed today</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-emerald-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
                <Pill className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-900">{activePrescriptions.length}</div>
                <p className="text-xs text-emerald-700">Currently active</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <Activity className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-900">{medicalRecords.length}</div>
                <p className="text-xs text-indigo-700">Medical records</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-violet-50 bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today&apos;s Appointments</CardTitle>
              <Link href="/appointments/calendar">
                <span className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  View calendar
                </span>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-900">{todayAppointments.length}</div>
              <p className="text-xs text-violet-700">Scheduled for you today</p>
            </CardContent>
          </Card>

          <Card className="border-indigo-50 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Recent Medical Records</CardTitle>
              <CardDescription>Latest patient consultations</CardDescription>
            </CardHeader>
            <CardContent>
              {medicalRecords.length === 0 ? (
                <p className="text-center text-muted-foreground">No medical records yet</p>
              ) : (
                <div className="space-y-3">
                  {medicalRecords
                    .slice(-5)
                    .reverse()
                    .map((record) => (
                      <div key={record.id} className="rounded-lg border border-indigo-100/80 bg-indigo-50/40 p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground">{record.patientName}</p>
                            <p className="text-sm text-muted-foreground">{record.diagnosis}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{record.date}</p>
                            <p className="text-xs text-muted-foreground">{record.doctorName}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients" className="space-y-3">
          {showDentalQueueFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Queue:</span>
              <button
                type="button"
                onClick={() => setQueueView("all")}
                className={`rounded-md border px-3 py-1.5 text-sm ${queueView === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
              >
                All patients
              </button>
              <button
                type="button"
                onClick={() => setQueueView("dental")}
                className={`rounded-md border px-3 py-1.5 text-sm ${queueView === "dental" ? "bg-sky-600 text-white border-sky-600" : "bg-background hover:bg-muted border-sky-200"}`}
              >
                Today&apos;s dental appointments ({dentalQueuePatientIds.length})
              </button>
            </div>
          )}
          <PatientQueue
            onSelectPatient={setSelectedPatientId}
            filterPatientIds={showDentalQueueFilter && queueView === "dental" ? dentalQueuePatientIds : undefined}
            filterEmptyMessage="No patients with dental appointments today."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPatientId} onOpenChange={(o)=> { if (!o) setSelectedPatientId(null) }}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPatientId ? (function(){
                const p = patients.find(function(x){ return x.id === selectedPatientId })
                if (!p) return 'Consultation'
                const pid = formatPatientNumber(p.patientNumber)
                return 'Consultation – ' + p.firstName + ' ' + p.lastName + (pid ? ' (P.' + pid + ')' : '')
              })() : 'Consultation'}
            </DialogTitle>
            <DialogDescription>View and document patient consultation, history, and orders.</DialogDescription>
          </DialogHeader>
          {selectedPatientId && (
            <PatientConsultation key={selectedPatientId} patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} initialTab={consultTab} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Listen for notifications requesting clinician consult open
;(function(){
  try {
    // Attach only once per module load
    const w: any = (globalThis as any)
    if (!w.__clinicianConsultListenerAttached) {
      w.__clinicianConsultListenerAttached = true
    }
  } catch {}
})()

