"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PatientList } from "@/components/patient/patient-list"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Users, Calendar, UserPlus, RefreshCw, AlertCircle } from "lucide-react"
import { CheckInPanel } from "@/components/reception/check-in-panel"
import { QueueBoardPro } from "@/components/reception/queue-board-pro"
import { ReceptionRegister } from "@/components/reception/reception-register"
import { PaymentsPanel } from "@/components/reception/payments-panel"
import { ErrorBoundary } from "@/components/error-boundary"

export function ReceptionistDashboard() {
  const {
    patients,
    appointments,
    loadingPatients,
    loadingAppointments,
    patientsLoadError,
    appointmentsLoadError,
    refreshPatients,
    refreshAppointments,
  } = usePatients()
  const [activeTab, setActiveTab] = useState("overview")
  const [focusPatientId, setFocusPatientId] = useState<string | undefined>(undefined)
  const [refreshingOverview, setRefreshingOverview] = useState(false)

  const todayAppointments = appointments.filter((a) => {
    const today = new Date().toISOString().split("T")[0]
    return a.date === today && a.status === "scheduled"
  })

  const hasOverviewError = patientsLoadError || appointmentsLoadError
  const handleRefreshOverview = async () => {
    setRefreshingOverview(true)
    try {
      await Promise.all([refreshPatients(), refreshAppointments?.() ?? Promise.resolve()])
    } finally {
      setRefreshingOverview(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Receptionist Dashboard</h2>
          <p className="text-muted-foreground">Manage patient registrations and appointments</p>
        </div>
      </div>

      {hasOverviewError && (
        <Alert variant="destructive" className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data load issue</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {patientsLoadError && <span>Patients failed to load.</span>}
            {appointmentsLoadError && <span>Appointments failed to load.</span>}
            <Button variant="outline" size="sm" onClick={handleRefreshOverview} disabled={refreshingOverview}>
              {refreshingOverview ? (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Retry"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ErrorBoundary
        fallbackTitle="Dashboard error"
        fallbackDescription="Something went wrong in the reception dashboard. Try again or refresh the page."
      >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="checkin">Check-In</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="registers">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshOverview}
              disabled={refreshingOverview || (loadingPatients && loadingAppointments)}
              aria-label="Refresh overview data"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshingOverview ? "animate-spin" : ""}`} />
              Refresh data
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingPatients ? (
                  <Skeleton className="h-7 w-24" />
                ) : patientsLoadError ? (
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                ) : (
                  <div className="text-2xl font-bold">{patients.length}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {patientsLoadError ? "Load failed" : "Active registrations (max 500)"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today&apos;s Appointments</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <Skeleton className="h-7 w-24" />
                ) : appointmentsLoadError ? (
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                ) : (
                  <div className="text-2xl font-bold">{todayAppointments.length}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {appointmentsLoadError ? "Load failed" : "Scheduled for today"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <Skeleton className="h-7 w-24" />
                ) : appointmentsLoadError ? (
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                ) : (
                  <div className="text-2xl font-bold">{appointments.length}</div>
                )}
                <p className="text-xs text-muted-foreground">
                  {appointmentsLoadError ? "Load failed" : "In list (last 500)"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Appointments</CardTitle>
              <CardDescription>Scheduled appointments for today</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAppointments ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : todayAppointments.length === 0 ? (
                <p className="text-center text-muted-foreground">No appointments scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium text-foreground">{apt.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {apt.time} - {apt.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{apt.doctorName}</p>
                        <p className="text-xs text-muted-foreground">{apt.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients">
          <PatientList initialSelectedPatientId={focusPatientId} />
        </TabsContent>

        

        {/** Appointments content removed; open from Check-In dialog */}

        <TabsContent value="checkin">
          <CheckInPanel />
        </TabsContent>

        <TabsContent value="queue">
          <QueueBoardPro />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsPanel />
        </TabsContent>

        <TabsContent value="registers">
          <ReceptionRegister />
        </TabsContent>
      </Tabs>
      </ErrorBoundary>
    </div>
  )
}
