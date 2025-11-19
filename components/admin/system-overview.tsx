"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useBilling } from "@/lib/billing-context"
import { useAdmin } from "@/lib/admin-context"
import { Users, Calendar, Activity, DollarSign, Pill, TestTube, UserCheck, AlertTriangle } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export function SystemOverview() {
  const formatCurrency = useFormatCurrency()
  const { patients, appointments } = usePatients()
  const { medicalRecords, prescriptions, labResults } = useMedical()
  const { bills } = useBilling()
  const { users } = useAdmin()
  const [bedOccupancy, setBedOccupancy] = useState(0)
  const [waitTimeData, setWaitTimeData] = useState(0)
  const [departmentStatuses, setDepartmentStatuses] = useState<Array<{
    name: string
    status: string
    statusColor: string
    details: string
    activeUsers: number
    recentActivity: number
  }>>([])

  useEffect(() => {
    // Fetch bed occupancy data with enhanced error handling
    ;(async () => {
      try {
        const res = await fetch("/api/beds", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setBedOccupancy(data.summary?.occupancyRate || 0)
        } else {
          console.warn("Failed to fetch bed data:", res.status)
          setBedOccupancy(0)
        }
      } catch (error) {
        console.error("Failed to fetch bed data:", error)
        setBedOccupancy(0)
      }
    })()

    // Fetch department status data
    ;(async () => {
      try {
        const res = await fetch("/api/departments/status", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setDepartmentStatuses(data.departments || [])
        } else {
          console.warn("Failed to fetch department status:", res.status)
          setDepartmentStatuses([])
        }
      } catch (error) {
        console.error("Failed to fetch department status:", error)
        setDepartmentStatuses([])
      }
    })()

    // Calculate average wait time if the data exists; otherwise show N/A
    const completedAppts = appointments.filter((a) => a.status === "completed")
    const withActualWait = completedAppts
      .map((apt: any) => Number(apt.wait_time_minutes))
      .filter((v) => Number.isFinite(v) && v > 0)
    if (withActualWait.length > 0) {
      const avgWait = Math.round(withActualWait.reduce((a, b) => a + b, 0) / withActualWait.length)
      setWaitTimeData(avgWait)
    } else {
      setWaitTimeData(0)
    }
  }, [appointments])

  const todayAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.date)
    const today = new Date()
    return aptDate.toDateString() === today.toDateString()
  })

  const pendingBills = bills.filter((bill) => bill.status === "pending")
  const totalRevenue = bills.filter((bill) => bill.status === "paid").reduce((sum, bill) => sum + bill.total, 0)

  const activePrescriptions = prescriptions.filter((p) => p.status === "active")
  const pendingLabTests = labResults.filter((r) => r.status === "pending")
  const activeUsers = users.filter((u) => u.status === "active")

  // Satisfaction not yet implemented - show N/A unless feedback module is present
  const patientSatisfaction = 0
  const staffUtilization = users.length > 0 ? Math.round((activeUsers.length / users.length) * 100) : 0

  const inactiveStaff = users.length > 0 ? users.length - activeUsers.length : 0

  const stats = [
    {
      title: "Total Patients",
      value: patients.length,
      icon: Users,
      description: "Registered patients",
      tone: "primary" as const,
    },
    {
      title: "Today's Appointments",
      value: todayAppointments.length,
      icon: Calendar,
      description: "Scheduled for today",
      tone: "info" as const,
    },
    {
      title: "Active Consultations",
      value: medicalRecords.length,
      icon: Activity,
      description: "In progress",
      tone: "info" as const,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      description: `${pendingBills.length} pending bills`,
      tone: "success" as const,
    },
    {
      title: "Active Prescriptions",
      value: activePrescriptions.length,
      icon: Pill,
      description: "Awaiting dispensing",
      tone: "warning" as const,
    },
    {
      title: "Pending Lab Tests",
      value: pendingLabTests.length,
      icon: TestTube,
      description: "Awaiting results",
      tone: "warning" as const,
    },
    {
      title: "Active Staff",
      value: activeUsers.length,
      icon: UserCheck,
      description: "System users",
      tone: "neutral" as const,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Alert strip for critical admin signals */}
      <Alert className="border-amber-200 bg-amber-50/60">
        <AlertTriangle className="text-amber-600" />
        <AlertTitle className="text-xs font-semibold text-amber-800 tracking-wide">
          Attention needed
        </AlertTitle>
        <AlertDescription className="text-[11px] text-amber-900/80 flex flex-wrap gap-2">
          {pendingBills.length > 0 ? (
            <Badge variant="outline" className="border-amber-300 bg-amber-100/70 text-amber-900 h-5 text-[11px]">
              {pendingBills.length} unpaid bill{pendingBills.length > 1 ? 's' : ''}
            </Badge>
          ) : null}
          {pendingLabTests.length > 0 ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800 h-5 text-[11px]">
              {pendingLabTests.length} lab test{pendingLabTests.length > 1 ? 's' : ''} awaiting results
            </Badge>
          ) : null}
          {inactiveStaff > 0 ? (
            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-800 h-5 text-[11px]">
              {inactiveStaff} staff inactive in system
            </Badge>
          ) : null}
          {pendingBills.length === 0 && pendingLabTests.length === 0 && inactiveStaff === 0 ? (
            <span>All key systems look healthy. No urgent issues detected.</span>
          ) : null}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const tone = stat.tone || "neutral"
          const cardClasses =
            tone === "primary"
              ? "border-sky-100 bg-sky-50/40"
              : tone === "success"
              ? "border-emerald-100 bg-emerald-50/40"
              : tone === "warning"
              ? "border-amber-100 bg-amber-50/40"
              : tone === "info"
              ? "border-blue-100 bg-blue-50/40"
              : "border-slate-100 bg-white"
          const iconColor =
            tone === "primary"
              ? "text-sky-600"
              : tone === "success"
              ? "text-emerald-600"
              : tone === "warning"
              ? "text-amber-600"
              : tone === "info"
              ? "text-blue-600"
              : "text-muted-foreground"
          return (
            <Card key={stat.title} className={`hover:shadow-sm transition-shadow ${cardClasses}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Department Status</CardTitle>
            <p className="text-xs text-muted-foreground">Live signal of activity across major hospital departments.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {departmentStatuses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="py-1.5 px-2">Department</th>
                      <th className="py-1.5 px-2">Status</th>
                      <th className="py-1.5 px-2">Active Staff</th>
                      <th className="py-1.5 px-2 text-right">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentStatuses.map((dept) => (
                      <tr key={dept.name} className="border-b last:border-0">
                        <td className="py-1.5 px-2">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{dept.name}</span>
                            <span className="text-[11px] text-muted-foreground">{dept.details}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium">
                            <span className={`h-2 w-2 rounded-full ${dept.statusColor?.includes('green') ? 'bg-emerald-500' : dept.statusColor?.includes('red') ? 'bg-red-500' : dept.statusColor?.includes('amber') || dept.statusColor?.includes('yellow') ? 'bg-amber-400' : 'bg-slate-400'}`} />
                            <span className={dept.statusColor}>{dept.status}</span>
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-xs">{dept.activeUsers ?? 0}</td>
                        <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                          {typeof dept.recentActivity === 'number' && dept.recentActivity >= 0
                            ? `${dept.recentActivity} min${dept.recentActivity === 1 ? '' : 's'} ago`
                            : 'No data'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Waiting for department activity... Once teams start working, live status will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Average Wait Time</span>
              <span className="text-sm font-medium">{waitTimeData > 0 ? `${waitTimeData} mins` : "Collecting data"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Bed Occupancy</span>
              <span className="text-sm font-medium">{bedOccupancy > 0 ? `${bedOccupancy}%` : "No beds configured"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Patient Satisfaction</span>
              <span className="text-sm font-medium">{patientSatisfaction > 0 ? `${patientSatisfaction}/5` : "Not configured"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Staff Utilization</span>
              <span className="text-sm font-medium">{staffUtilization > 0 ? `${staffUtilization}%` : "0%"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

