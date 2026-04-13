"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePatients } from "@/lib/patient-context"
import { useMedical } from "@/lib/medical-context"
import { useBilling } from "@/lib/billing-context"
import { useAdmin } from "@/lib/admin-context"
import { Users, Calendar, Activity, DollarSign, Pill, TestTube, UserCheck, AlertTriangle } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { buildSearchParamsString } from "@/lib/search-params"

type DepartmentStatusSignal = {
  name: string
  status: string
  statusColor: string
  details: string
  activeUsers: number
  recentActivityCount: number
  lastActivityAt: string | null
  lastActivityMinutes: number | null
}

type OverviewSignals = {
  quickStats: {
    averageWaitMinutes: number | null
    averageWaitSampleSize: number
    bedOccupancy: number
    totalBeds: number
    patientSatisfactionAvg: number | null
    patientSatisfactionTotal: number
    activeStaffAccounts: number
    activeStaffRecent: number
    staffActivityRate: number | null
  }
  departments: DepartmentStatusSignal[]
  lastUpdated: string
}

function formatRelativeActivity(minutes: number | null) {
  if (minutes == null) return "No recorded activity"
  if (minutes <= 0) return "Just now"
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes === 0
      ? `${hours} hr${hours === 1 ? "" : "s"} ago`
      : `${hours}h ${remainingMinutes}m ago`
  }

  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

export function SystemOverview() {
  const formatCurrency = useFormatCurrency()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { patients, appointments } = usePatients()
  const { medicalRecords, prescriptions, labResults } = useMedical()
  const { bills } = useBilling()
  const { summary } = useAdmin()
  const activeUsersCount = summary?.active ?? 0
  const usersCount = summary?.total ?? 0
  const [overviewSignals, setOverviewSignals] = useState<OverviewSignals | null>(null)
  const [signalsLoading, setSignalsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadOperationalSignals = async (silent = false) => {
      if (!silent && active) setSignalsLoading(true)
      try {
        const res = await fetch("/api/admin/overview", { credentials: "include" })
        if (!res.ok) {
          throw new Error(`Failed to load admin overview (${res.status})`)
        }
        const data = await res.json()
        if (active) {
          setOverviewSignals(data)
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Failed to load admin operational overview:", error)
        }
      } finally {
        if (active) setSignalsLoading(false)
      }
    }

    void loadOperationalSignals()
    const intervalId = setInterval(() => {
      void loadOperationalSignals(true)
    }, 60000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [])

  const todayAppointments = appointments.filter((apt) => {
    const aptDate = new Date(apt.date)
    const today = new Date()
    return aptDate.toDateString() === today.toDateString()
  })

  const pendingBills = bills.filter((bill) => bill.status === "pending")
  const totalRevenue = bills.filter((bill) => bill.status === "paid").reduce((sum, bill) => sum + bill.total, 0)

  const activePrescriptions = prescriptions.filter((p) => p.status === "active")
  const pendingLabTests = labResults.filter((r) => r.status === "pending")
  const departmentStatuses = overviewSignals?.departments || []
  const averageWaitMinutes = overviewSignals?.quickStats.averageWaitMinutes ?? null
  const totalBeds = overviewSignals?.quickStats.totalBeds ?? 0
  const bedOccupancy = overviewSignals?.quickStats.bedOccupancy ?? 0
  const patientSatisfactionAvg = overviewSignals?.quickStats.patientSatisfactionAvg ?? null
  const patientSatisfactionTotal = overviewSignals?.quickStats.patientSatisfactionTotal ?? 0
  const activeStaffRecent = overviewSignals?.quickStats.activeStaffRecent ?? 0
  const activeStaffAccounts = overviewSignals?.quickStats.activeStaffAccounts ?? 0

  const satisfactionDisplay = signalsLoading
    ? "Loading..."
    : patientSatisfactionTotal > 0 && patientSatisfactionAvg != null
      ? `${patientSatisfactionAvg.toFixed(1)}/5 (${patientSatisfactionTotal} responses)`
      : "No feedback yet"
  const waitTimeDisplay = signalsLoading
    ? "Loading..."
    : averageWaitMinutes != null
      ? `${Math.round(averageWaitMinutes)} mins`
      : "No queue starts yet"
  const bedOccupancyDisplay = signalsLoading
    ? "Loading..."
    : totalBeds > 0
      ? `${bedOccupancy}%`
      : "No beds configured"
  const staffActivityDisplay = signalsLoading
    ? "Loading..."
    : activeStaffAccounts > 0
      ? `${activeStaffRecent}/${activeStaffAccounts}`
      : "No active staff"

  const inactiveStaff = usersCount > 0 ? usersCount - activeUsersCount : 0

  const jumpToSection = useCallback(
    (section: "users" | "beds" | "patients" | "financial" | "audit", filters: Record<string, string | null | undefined> = {}) => {
      const query = buildSearchParamsString(searchParams, {
        section,
        ...filters,
      })
      const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      const target = query ? `${pathname}?${query}` : pathname
      if (target !== current) {
        router.push(target, { scroll: false })
      }
    },
    [pathname, router, searchParams],
  )

  const stats = [
    {
      title: "Total Patients",
      value: patients.length,
      icon: Users,
      description: "Registered patients",
      tone: "primary" as const,
      section: "patients" as const,
    },
    {
      title: "Today's Appointments",
      value: todayAppointments.length,
      icon: Calendar,
      description: "Scheduled for today",
      tone: "info" as const,
    },
    {
      title: "Today's Consultations",
      value: medicalRecords.filter((r) => {
        const d = new Date(r.date)
        const today = new Date()
        return d.toDateString() === today.toDateString()
      }).length,
      icon: Activity,
      description: "Medical visits today",
      tone: "info" as const,
    },
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      description: `${pendingBills.length} pending bills`,
      tone: "success" as const,
      section: "financial" as const,
      filters: { financialPeriod: "30days", financialTab: "revenue" },
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
      value: activeUsersCount,
      icon: UserCheck,
      description: "System users",
      tone: "neutral" as const,
      section: "users" as const,
    },
  ]

  const quickStats = [
    {
      label: "Average Wait Time",
      value: waitTimeDisplay,
      section: "patients" as const,
    },
    {
      label: "Bed Occupancy",
      value: bedOccupancyDisplay,
      section: "beds" as const,
      filters: { bedStatus: "Occupied" },
    },
    {
      label: "Patient Satisfaction",
      value: satisfactionDisplay,
      section: "patients" as const,
    },
    {
      label: "Staff Active (24h)",
      value: staffActivityDisplay,
      section: "users" as const,
      filters: { userStatus: "active", userSortBy: "lastLogin", userSortOrder: "desc" },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Alert strip — only shown when there is something that needs attention */}
      {(pendingBills.length > 0 || pendingLabTests.length > 0 || inactiveStaff > 0) && (
        <Alert className="border-amber-200 bg-amber-50/60">
          <AlertTriangle className="text-amber-600" />
          <AlertTitle className="text-xs font-semibold text-amber-800 tracking-wide">
            Attention needed
          </AlertTitle>
          <AlertDescription className="text-[11px] text-amber-900/80 flex flex-wrap gap-2">
            {pendingBills.length > 0 ? (
              <button type="button" onClick={() => jumpToSection("financial", { financialPeriod: "30days", financialTab: "revenue" })}>
                <Badge variant="outline" className="border-amber-300 bg-amber-100/70 text-amber-900 h-5 text-[11px] hover:bg-amber-200/80">
                  {pendingBills.length} unpaid bill{pendingBills.length > 1 ? 's' : ''}
                </Badge>
              </button>
            ) : null}
            {pendingLabTests.length > 0 ? (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800 h-5 text-[11px]">
                {pendingLabTests.length} lab test{pendingLabTests.length > 1 ? 's' : ''} awaiting results
              </Badge>
            ) : null}
            {inactiveStaff > 0 ? (
              <button type="button" onClick={() => jumpToSection("users", { userStatus: "inactive" })}>
                <Badge variant="outline" className="border-border bg-muted text-foreground h-5 text-[11px] hover:bg-slate-200/80">
                  {inactiveStaff} staff inactive in system
                </Badge>
              </button>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

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
          const isClickable = Boolean(stat.section)
          return (
            <Card key={stat.title} className={`transition-shadow ${isClickable ? "hover:shadow-sm" : ""} ${cardClasses}`}>
              {isClickable ? (
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => jumpToSection(stat.section!, stat.filters)}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </CardContent>
                </button>
              ) : (
                <>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                  </CardContent>
                </>
              )}
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
                          {formatRelativeActivity(dept.lastActivityMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {signalsLoading
                    ? "Loading department activity..."
                    : "Waiting for department activity... Once teams start working, live status will appear here."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickStats.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => jumpToSection(item.section, item.filters)}
                className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="text-sm">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

