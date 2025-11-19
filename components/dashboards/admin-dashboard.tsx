"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, RefreshCw, Download, LayoutDashboard, Users as UsersIcon, BedDouble, IdCard, BarChart3, ScrollText } from "lucide-react"
import { SystemOverview } from "@/components/admin/system-overview"
import { UserManagement } from "@/components/admin/user-management"
import { FinancialReports } from "@/components/analytics/financial-reports"
import { AuditLogViewer } from "@/components/admin/audit-log-viewer"
import { BedManagement } from "@/components/admin/bed-management"
import { AdminPatientManagement } from "@/components/admin/admin-patient-management"

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-sky-900">Hospital Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">Monitor operations, staff, beds, and finances from one control center.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search patients, staff, invoices..." />
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/60 rounded-xl p-1 flex flex-wrap justify-start">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>System Overview</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <UsersIcon className="h-3.5 w-3.5" />
            <span>User Management</span>
          </TabsTrigger>
          <TabsTrigger value="beds" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BedDouble className="h-3.5 w-3.5" />
            <span>Bed Management</span>
          </TabsTrigger>
          <TabsTrigger value="patients" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <IdCard className="h-3.5 w-3.5" />
            <span>Patient Management</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Financial Reports</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5 px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ScrollText className="h-3.5 w-3.5" />
            <span>Audit Trail</span>
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
      </Tabs>
    </div>
  )
}
