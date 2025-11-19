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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {title || "Clinician Dashboard"}
        </h2>
        <p className="text-muted-foreground">View patients and manage medical records</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patient Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patients.length}</div>
                <p className="text-xs text-muted-foreground">Registered patients</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Consultations</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayRecords.length}</div>
                <p className="text-xs text-muted-foreground">Completed today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
                <Pill className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activePrescriptions.length}</div>
                <p className="text-xs text-muted-foreground">Currently active</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{medicalRecords.length}</div>
                <p className="text-xs text-muted-foreground">Medical records</p>
              </CardContent>
            </Card>
          </div>

          <Card>
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
                      <div key={record.id} className="rounded-lg border border-border p-3">
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

