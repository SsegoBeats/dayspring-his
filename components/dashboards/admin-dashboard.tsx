"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  LayoutDashboard,
  Users as UsersIcon,
  BedDouble,
  IdCard,
  BarChart3,
  ScrollText,
  Settings,
  Boxes,
  ArrowUpRight,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  Database,
} from "lucide-react"
import { toast } from "sonner"
import { SystemOverview } from "@/components/admin/system-overview"
import { UserManagement } from "@/components/admin/user-management"
import { FinancialReports } from "@/components/analytics/financial-reports"
import { AuditLogViewer } from "@/components/admin/audit-log-viewer"
import { BedManagement } from "@/components/admin/bed-management"
import { AdminPatientManagement } from "@/components/admin/admin-patient-management"
import { NonMedicationInventory } from "@/components/pharmacy/non-medication-inventory"
import { useSettings } from "@/lib/settings-context"
import { useAdmin } from "@/lib/admin-context"

const ADMIN_SECTIONS = ["overview", "users", "beds", "patients", "financial", "audit", "inventory"] as const
type AdminSection = (typeof ADMIN_SECTIONS)[number]

const SECTION_META: Record<AdminSection, { title: string; description: string }> = {
  overview: {
    title: "System Overview",
    description: "Watch hospital throughput, staffing pressure, revenue, and cross-portal health from one place.",
  },
  users: {
    title: "User Management",
    description: "Create, deactivate, export, and rebalance staff accounts without losing auditability.",
  },
  beds: {
    title: "Bed Management",
    description: "Control occupancy, transfers, discharge flow, and ward utilization in real time.",
  },
  patients: {
    title: "Patient Management",
    description: "Search, review, export, and delete patient records with current triage context attached.",
  },
  financial: {
    title: "Financial Reports",
    description: "Track revenue, outstanding balances, payment methods, and service performance by period.",
  },
  audit: {
    title: "Audit Trail",
    description: "Review sensitive activity, export evidence, and manage long-term audit retention safely.",
  },
  inventory: {
    title: "Non-Medication Inventory",
    description: "Keep hospital operational supplies synchronized with admin oversight and export-ready records.",
  },
}

function isAdminSection(value: string | null | undefined): value is AdminSection {
  return Boolean(value && ADMIN_SECTIONS.includes(value as AdminSection))
}

function getRange(days: number) {
  return {
    from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString(),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function AdminDashboard() {
  const { settings, loading: settingsLoading } = useSettings()
  const { summary } = useAdmin()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get("section")
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<AdminSection>("overview")
  const [exportingKey, setExportingKey] = useState<string | null>(null)

  const activeUsers = summary?.active ?? 0
  const totalUsers = summary?.total ?? 0
  const inactiveUsers = summary?.inactive ?? 0
  const coveredRoles = useMemo(
    () => Object.values(summary?.byRole || {}).filter((count) => Number(count) > 0).length,
    [summary?.byRole],
  )

  const scrollWorkspaceIntoView = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ behavior, block: "start" })
    })
  }, [])

  const syncSection = useCallback(
    (next: AdminSection) => {
      setActiveTab(next)
      const params = new URLSearchParams(searchParams.toString())
      if (next === "overview") params.delete("section")
      else params.set("section", next)
      const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      const target = params.toString() ? `${pathname}?${params.toString()}` : pathname
      if (target !== current) {
        router.push(target, { scroll: false })
      } else {
        scrollWorkspaceIntoView()
      }
    },
    [pathname, router, scrollWorkspaceIntoView, searchParams],
  )

  useEffect(() => {
    if (isAdminSection(sectionParam)) {
      setActiveTab(sectionParam)
      return
    }
    if (settingsLoading) return

    const mappedPreference: AdminSection =
      settings?.defaultDashboard === "admin-users"
        ? "users"
        : settings?.defaultDashboard === "admin-beds"
          ? "beds"
          : settings?.defaultDashboard === "admin-patients"
            ? "patients"
            : settings?.defaultDashboard === "admin-financial"
              ? "financial"
              : settings?.defaultDashboard === "admin-audit"
                ? "audit"
                : settings?.defaultDashboard === "admin-inventory"
                  ? "inventory"
                  : "overview"

    setActiveTab(mappedPreference)
  }, [sectionParam, settings?.defaultDashboard, settingsLoading])

  useEffect(() => {
    if (activeTab === "overview") return
    scrollWorkspaceIntoView(sectionParam ? "smooth" : "auto")
  }, [activeTab, scrollWorkspaceIntoView, sectionParam])

  const runDirectExport = useCallback(
    async (
      key: string,
      dataset: "users" | "patients" | "billing" | "bed_assignments",
      format: "csv" | "xlsx" | "pdf",
      filenamePrefix: string,
      filters: Record<string, any>,
    ) => {
      try {
        setExportingKey(key)
        const response = await fetch("/api/exports/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dataset, format, filters }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Export failed")
        }

        const blob = await response.blob()
        downloadBlob(blob, `${filenamePrefix}-${new Date().toISOString().split("T")[0]}.${format}`)
        toast.success(`${filenamePrefix.replace(/-/g, " ")} exported`)
      } catch (error: any) {
        toast.error(error?.message || "Export failed")
      } finally {
        setExportingKey(null)
      }
    },
    [],
  )

  const runAuditExport = useCallback(async () => {
    try {
      setExportingKey("audit")
      const { from, to } = getRange(30)
      const response = await fetch("/api/audit-logs/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ startDate: from, endDate: to, format: "csv" }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to export audit logs")
      }

      const blob = await response.blob()
      downloadBlob(blob, `audit-trail-${new Date().toISOString().split("T")[0]}.csv`)
      toast.success("Audit trail exported")
    } catch (error: any) {
      toast.error(error?.message || "Failed to export audit trail")
    } finally {
      setExportingKey(null)
    }
  }, [])

  const quickActions = [
    {
      label: "Open user directory",
      description: "Jump into staff provisioning, role balancing, and account controls.",
      onClick: () => syncSection("users"),
      icon: UsersIcon,
    },
    {
      label: "Review patient register",
      description: "Inspect patient data quality, triage coverage, and medical-history access.",
      onClick: () => syncSection("patients"),
      icon: IdCard,
    },
    {
      label: "Check audit trail",
      description: "Review high-risk actions, failed logins, and exportable system evidence.",
      onClick: () => syncSection("audit"),
      icon: ScrollText,
    },
    {
      label: "Open admin settings",
      description: "Manage organization-wide controls and your admin-specific portal preferences.",
      href: "/admin/settings",
      icon: Settings,
    },
  ]

  const exportActions = [
    {
      key: "users",
      title: "User Directory",
      description: "Full staff roster with role and status coverage.",
      onClick: () => runDirectExport("users", "users", "xlsx", "user-directory", {}),
    },
    {
      key: "patients",
      title: "Patient Register",
      description: "Demographic register filtered to the last 12 months.",
      onClick: () => runDirectExport("patients", "patients", "xlsx", "patient-register", getRange(365)),
    },
    {
      key: "billing",
      title: "Billing Dataset",
      description: "Current-period billing records for finance review.",
      onClick: () => runDirectExport("billing", "billing", "pdf", "billing-report", getRange(30)),
    },
    {
      key: "beds",
      title: "Bed Assignments",
      description: "Latest 30-day occupancy and transfer history.",
      onClick: () =>
        runDirectExport("beds", "bed_assignments", "xlsx", "bed-assignments", { ...getRange(30), status: "All" }),
    },
    {
      key: "audit",
      title: "Audit Trail",
      description: "30-day CSV export for compliance and investigations.",
      onClick: runAuditExport,
    },
  ]

  const statusCards = [
    {
      label: "Total Accounts",
      value: totalUsers,
      tone: "from-sky-500/15 to-cyan-500/10 border-sky-200/70",
    },
    {
      label: "Active Staff",
      value: activeUsers,
      tone: "from-emerald-500/15 to-teal-500/10 border-emerald-200/70",
    },
    {
      label: "Inactive Accounts",
      value: inactiveUsers,
      tone: "from-rose-500/15 to-orange-500/10 border-rose-200/70",
    },
    {
      label: "Roles Covered",
      value: coveredRoles,
      tone: "from-violet-500/15 to-fuchsia-500/10 border-violet-200/70",
    },
  ]

  const sectionMeta = SECTION_META[activeTab]

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-sky-200/60 bg-[radial-gradient(circle_at_top_left,_rgba(186,230,253,0.8),_transparent_34%),linear-gradient(135deg,_rgba(248,250,252,1)_0%,_rgba(239,246,255,0.98)_35%,_rgba(240,253,250,0.95)_100%)] p-6 shadow-[0_32px_90px_-48px_rgba(15,23,42,0.45)]">
        <div className="absolute -right-14 top-0 h-44 w-44 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/75 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-900">
              <Sparkles className="h-3.5 w-3.5" />
              Hospital Command Center
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Run staffing, beds, patient governance, finance, and compliance from one Admin portal.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                The Admin workspace now supports deep-linkable sections, user-specific portal-home defaults, cross-portal data
                oversight, and export actions that land exactly where operational reviews need them.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon
                if ("href" in action) {
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group rounded-2xl border border-white/70 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <Icon className="h-5 w-5 text-sky-700" />
                        <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-700" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">{action.label}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{action.description}</p>
                    </Link>
                  )
                }

                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="group rounded-2xl border border-white/70 bg-white/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <Icon className="h-5 w-5 text-sky-700" />
                      <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sky-700" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{action.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{action.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statusCards.map((card) => (
                <Card key={card.label} className={`border bg-gradient-to-br ${card.tone} shadow-none`}>
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="border-sky-200/70 bg-white/90 shadow-none">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Operations Pulse
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                    Admin home preference:
                    <span className="ml-2 font-medium text-slate-900">
                      {settings?.defaultDashboard || "overview"}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                    User settings stay per-account, while organization currency remains admin-only and system-wide.
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-3">
                    Notifications and deletion approvals continue to flow back into Admin without spilling into other portals.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-slate-950 text-white shadow-[0_28px_70px_-45px_rgba(15,23,42,0.95)]">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <FileSpreadsheet className="h-4 w-4 text-cyan-300" />
                  Export Studio
                </div>
                <div className="space-y-3">
                  {exportActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={action.onClick}
                      disabled={Boolean(exportingKey)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-cyan-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{action.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-300">{action.description}</div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-cyan-300" />
                      </div>
                      {exportingKey === action.key ? (
                        <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-cyan-200">Exporting...</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div ref={workspaceRef} className="space-y-4 scroll-mt-24">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-slate-500">Admin Workspace</p>
            <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{sectionMeta.title}</h3>
            <p className="text-sm text-muted-foreground">{sectionMeta.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1">
              <Database className="h-3.5 w-3.5 text-sky-600" />
              Cross-portal data reflects live operational state
            </span>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => syncSection(value as AdminSection)} className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <UsersIcon className="h-3.5 w-3.5" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="beds" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <BedDouble className="h-3.5 w-3.5" />
              <span>Beds</span>
            </TabsTrigger>
            <TabsTrigger value="patients" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <IdCard className="h-3.5 w-3.5" />
              <span>Patients</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Finance</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <ScrollText className="h-3.5 w-3.5" />
              <span>Audit</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-1.5 rounded-xl px-3 py-2 data-[state=active]:bg-slate-950 data-[state=active]:text-white">
              <Boxes className="h-3.5 w-3.5" />
              <span>Inventory</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <SystemOverview />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>

          <TabsContent value="beds" className="space-y-4">
            <BedManagement />
          </TabsContent>

          <TabsContent value="patients" className="space-y-4">
            <AdminPatientManagement />
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <FinancialReports />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogViewer />
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <NonMedicationInventory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
