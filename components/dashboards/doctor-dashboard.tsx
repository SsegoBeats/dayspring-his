"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { PatientConsultation } from "@/components/doctor/patient-consultation"
import { PatientQueue } from "@/components/doctor/patient-queue"
import { Users, FileText, Pill, Activity } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatPatientDigits } from "@/lib/patients"

interface DoctorDashboardProps {
  title?: string
}

export function DoctorDashboard({ title }: DoctorDashboardProps) {
  const { patients } = usePatients()
  const { medicalRecords, prescriptions } = useMedical()
  const { user } = useAuth()
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [consultTab, setConsultTab] = useState<"consultation"|"prescription"|"history"|"labs">("consultation")

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
    window.addEventListener('openDoctorConsult', handler as any)
    return () => window.removeEventListener('openDoctorConsult', handler as any)
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
                <div className="text-3xl font-bold text-sky-900">{patients.length}</div>
                <p className="text-xs text-sky-700">Registered patients</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Consultations</CardTitle>
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

        <TabsContent value="patients">
          <PatientQueue onSelectPatient={setSelectedPatientId} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPatientId} onOpenChange={(o)=> { if (!o) setSelectedPatientId(null) }}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedPatientId ? (function(){
                const p = patients.find(function(x){ return x.id === selectedPatientId })
                if (!p) return 'Consultation'
                const pid = formatPatientDigits(p.patientNumber)
                return 'Consultation – ' + p.firstName + ' ' + p.lastName + (pid ? ' (P.' + pid + ')' : '')
              })() : 'Consultation'}
            </DialogTitle>
          </DialogHeader>
          {selectedPatientId && (
            <PatientConsultation patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} initialTab={consultTab} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Listen for notifications requesting doctor consult open
;(function(){
  try {
    // Attach only once per module load
    const w: any = (globalThis as any)
    if (!w.__doctorConsultListenerAttached) {
      w.__doctorConsultListenerAttached = true
    }
  } catch {}
})()

