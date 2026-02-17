"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useBilling } from "@/lib/billing-context"
import { BillQueue } from "@/components/billing/bill-queue"
import { ProcessPayment } from "@/components/billing/process-payment"
import { CreateBill } from "@/components/billing/create-bill"
import { EditBill } from "@/components/billing/edit-bill"
import { FinancialReports } from "@/components/analytics/financial-reports"
import { OverdueBills } from "@/components/billing/overdue-bills"
import { ExportTransactions } from "@/components/billing/export-transactions"
import {
  DollarSign,
  Clock,
  CheckCircle,
  Receipt,
  BarChart3,
  Plus,
  FileSpreadsheet,
  AlertCircle,
  Search,
  ArrowLeft,
} from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"

export function CashierDashboard() {
  const { bills, getPendingBills, getPartiallyPaidBills, refreshBills } = useBilling()
  const formatCurrency = useFormatCurrency()
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [view, setView] = useState<"dashboard" | "reports" | "overdue" | "export">("dashboard")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("pending")

  const pendingBills = getPendingBills()
  const partiallyPaidBills = getPartiallyPaidBills()
  const paidBills = bills.filter((b) => b.status === "paid")
  // Use local date so "today" is the user's calendar day (resets correctly each new day)
  const todayLocal =
    typeof Intl !== "undefined"
      ? new Date().toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" })
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`
  const todayRevenue = paidBills
    .filter((b) => b.paymentDate === todayLocal)
    .reduce((sum, b) => sum + b.total, 0)

  // Current calendar week (Monday–Sunday) in local time for week's revenue
  const getWeekBounds = () => {
    const now = new Date()
    const day = now.getDay()
    const daysToMonday = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" }
    return {
      start: monday.toLocaleDateString("en-CA", opts),
      end: sunday.toLocaleDateString("en-CA", opts),
    }
  }
  const weekBounds = getWeekBounds()
  const weekRevenue = paidBills
    .filter((b) => b.paymentDate && b.paymentDate >= weekBounds.start && b.paymentDate <= weekBounds.end)
    .reduce((sum, b) => sum + b.total, 0)

  const partiallyPaidRemaining = partiallyPaidBills.reduce(
    (sum, b) => sum + (b.total - (b.paidAmount || 0)),
    0
  )

  const filterBills = (list: typeof bills) =>
    list.filter((b) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return true
      return (
        b.patientName.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.billNumber || "").toLowerCase().includes(q) ||
        (b.patientNumber || "").toLowerCase().includes(q)
      )
    })

  if (editingBillId) {
    return <EditBill billId={editingBillId} onBack={() => setEditingBillId(null)} />
  }

  if (selectedBillId) {
    return <ProcessPayment billId={selectedBillId} onBack={() => setSelectedBillId(null)} />
  }

  if (view === "reports") {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setView("dashboard")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <FinancialReports />
      </div>
    )
  }

  if (view === "overdue") {
    return (
      <OverdueBills
        onBack={() => setView("dashboard")}
        onSelectBill={(billId) => setSelectedBillId(billId)}
        onEditBill={(billId) => {
          const bill = bills.find((b) => b.id === billId)
          if (bill?.status === "pending") setEditingBillId(billId)
        }}
      />
    )
  }

  if (view === "export") {
    return <ExportTransactions onBack={() => setView("dashboard")} />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Cashier Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Process payments, manage bills, and track revenue
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setView("reports")}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Financial Reports
          </Button>
          <Button size="sm" onClick={() => setShowCreateBill(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Bill
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 to-slate-100/80 shadow-sm dark:from-slate-900/50 dark:to-slate-800/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Total Bills
            </CardTitle>
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{bills.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-sm dark:from-amber-950/30 dark:to-orange-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending
            </CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {pendingBills.length}
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-indigo-50/80 shadow-sm dark:from-blue-950/30 dark:to-indigo-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Partially Paid
            </CardTitle>
            <Clock className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {partiallyPaidBills.length}
            </div>
            <p className="text-xs text-blue-700/80 dark:text-blue-400/80">
              {formatCurrency(partiallyPaidRemaining)} remaining
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-50 to-teal-50/80 shadow-sm dark:from-emerald-950/30 dark:to-teal-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Paid
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              {paidBills.length}
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Completed</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-50 to-purple-50/80 shadow-sm dark:from-violet-950/30 dark:to-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-violet-400">
              Today&apos;s Revenue
            </CardTitle>
            <DollarSign className="h-5 w-5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
              {formatCurrency(todayRevenue)}
            </div>
            <p className="text-xs text-violet-700/80 dark:text-violet-400/80">Collected today</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-gradient-to-br from-fuchsia-50 to-pink-50/80 shadow-sm dark:from-fuchsia-950/30 dark:to-pink-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-fuchsia-700 dark:text-fuchsia-400">
              Week&apos;s Revenue
            </CardTitle>
            <DollarSign className="h-5 w-5 text-fuchsia-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-fuchsia-900 dark:text-fuchsia-100">
              {formatCurrency(weekRevenue)}
            </div>
            <p className="text-xs text-fuchsia-700/80 dark:text-fuchsia-400/80">This week (Mon–Sun)</p>
          </CardContent>
        </Card>
      </div>

      {/* Bill queue + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
                <TabsTrigger value="pending" className="gap-1.5 text-sm">
                  Pending
                  <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">
                    {pendingBills.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="partially" className="gap-1.5 text-sm">
                  Partially Paid
                  <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">
                    {partiallyPaidBills.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="paid" className="gap-1.5 text-sm">
                  Paid
                  <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">
                    {paidBills.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-1.5 text-sm">
                  All
                  <Badge variant="outline" className="ml-0.5 px-1.5 py-0 text-xs">
                    {bills.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patient or invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <TabsContent value="pending" className="mt-4">
              <BillQueue
                bills={filterBills(pendingBills)}
                onSelectBill={setSelectedBillId}
                onEditBill={setEditingBillId}
                onDeleteBill={async (id) => {
                  await refreshBills()
                  if (selectedBillId === id) setSelectedBillId(null)
                  if (editingBillId === id) setEditingBillId(null)
                }}
                onCreateBill={() => setShowCreateBill(true)}
                emptyMessage='No pending bills. Click "Create Bill" to get started.'
                showCreateButton
              />
            </TabsContent>
            <TabsContent value="partially" className="mt-4">
              <BillQueue
                bills={filterBills(partiallyPaidBills)}
                onSelectBill={setSelectedBillId}
                onEditBill={setEditingBillId}
                emptyMessage="No partially paid bills."
              />
            </TabsContent>
            <TabsContent value="paid" className="mt-4">
              <BillQueue
                bills={filterBills(paidBills)}
                onSelectBill={setSelectedBillId}
                emptyMessage="No paid bills in this view."
              />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <BillQueue
                bills={filterBills(bills)}
                onSelectBill={setSelectedBillId}
                onEditBill={(billId) => {
                  const bill = bills.find((b) => b.id === billId)
                  if (bill?.status === "pending") setEditingBillId(billId)
                }}
                onDeleteBill={async (id) => {
                  await refreshBills()
                  if (selectedBillId === id) setSelectedBillId(null)
                  if (editingBillId === id) setEditingBillId(null)
                }}
                emptyMessage="No bills recorded yet."
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <p className="text-xs text-muted-foreground">Common tasks</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full justify-start gap-2"
              variant="default"
              size="sm"
              onClick={() => setShowCreateBill(true)}
            >
              <Plus className="h-4 w-4" />
              Create Bill
            </Button>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              size="sm"
              onClick={() => setView("overdue")}
            >
              <AlertCircle className="h-4 w-4" />
              Overdue Bills
            </Button>
            <Button
              className="w-full justify-start gap-2"
              variant="outline"
              size="sm"
              onClick={() => setView("export")}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Transactions
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Bill</DialogTitle>
          </DialogHeader>
          <CreateBill onBack={() => setShowCreateBill(false)} mode="dialog" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
