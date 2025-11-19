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
import { FinancialReports } from "@/components/analytics/financial-reports"
import { DollarSign, Clock, CheckCircle, Receipt } from "lucide-react"

export function CashierDashboard() {
  const { bills, getPendingBills } = useBilling()
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null)
  const [showCreateBill, setShowCreateBill] = useState(false)
  const [view, setView] = useState<"dashboard" | "reports">("dashboard")
  const [searchTerm, setSearchTerm] = useState("")

  const pendingBills = getPendingBills()
  const paidBills = bills.filter((b) => b.status === "paid")
  const todayRevenue = paidBills
    .filter((b) => b.paymentDate === new Date().toISOString().split("T")[0])
    .reduce((sum, b) => sum + b.total, 0)

  if (selectedBillId) {
    return <ProcessPayment billId={selectedBillId} onBack={() => setSelectedBillId(null)} />
  }

  if (view === "reports") {
    return (
      <div className="space-y-6">
        <button onClick={() => setView("dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </button>
        <FinancialReports />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Cashier Dashboard</h2>
          <p className="text-muted-foreground">Process payments and manage billing</p>
        </div>
        <button
          onClick={() => setView("reports")}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          View Financial Reports
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-100 bg-slate-50/60 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-700">Total Bills</CardTitle>
            <Receipt className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{bills.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card className="border-amber-100 bg-amber-50/50 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending Bills</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{pendingBills.length}</div>
            <p className="text-xs text-amber-800/80">Awaiting payment</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-100 bg-emerald-50/60 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-emerald-700">Paid Bills</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{paidBills.length}</div>
            <p className="text-xs text-emerald-800/80">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-sky-100 bg-sky-50/60 transition-shadow hover:shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-sky-700">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">${todayRevenue.toFixed(2)}</div>
            <p className="text-xs text-slate-700/80">Collected today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(260px,1fr)]">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs defaultValue="pending">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="pending">
                  Pending Bills <Badge variant="secondary">{pendingBills.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="paid">
                  Paid Bills <Badge variant="outline">{paidBills.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="all">
                  All Bills <Badge variant="outline">{bills.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="w-full max-w-xs">
              <Input
                placeholder="Search by patient or invoice"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Tabs defaultValue="pending">
            <TabsList className="sr-only">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <BillQueue
                bills={pendingBills.filter((b) => {
                  const q = searchTerm.trim().toLowerCase()
                  if (!q) return true
                  return (
                    b.patientName.toLowerCase().includes(q) ||
                    b.id.toLowerCase().includes(q) ||
                    (b.billNumber || "").toLowerCase().includes(q)
                  )
                })}
                onSelectBill={setSelectedBillId}
                onCreateBill={() => setShowCreateBill(true)}
                emptyMessage='No pending bills. Click "Create Bill" to get started.'
                showCreateButton
              />
            </TabsContent>

            <TabsContent value="paid">
              <BillQueue
                bills={paidBills.filter((b) => {
                  const q = searchTerm.trim().toLowerCase()
                  if (!q) return true
                  return (
                    b.patientName.toLowerCase().includes(q) ||
                    b.id.toLowerCase().includes(q) ||
                    (b.billNumber || "").toLowerCase().includes(q)
                  )
                })}
                onSelectBill={setSelectedBillId}
                emptyMessage="No paid bills for this view."
              />
            </TabsContent>

            <TabsContent value="all">
              <BillQueue
                bills={bills.filter((b) => {
                  const q = searchTerm.trim().toLowerCase()
                  if (!q) return true
                  return (
                    b.patientName.toLowerCase().includes(q) ||
                    b.id.toLowerCase().includes(q) ||
                    (b.billNumber || "").toLowerCase().includes(q)
                  )
                })}
                onSelectBill={setSelectedBillId}
                emptyMessage="No bills recorded yet."
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="border-slate-100 bg-white/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" size="sm" onClick={() => setShowCreateBill(true)}>
              Create Bill
            </Button>
            <Button className="w-full justify-start" variant="outline" size="sm" disabled>
              Record Payment (from terminal)
            </Button>
            <Button className="w-full justify-start" variant="outline" size="sm" disabled>
              View Overdue Bills
            </Button>
            <Button className="w-full justify-start" variant="outline" size="sm" disabled>
              Export Transactions
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreateBill} onOpenChange={setShowCreateBill}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Bill</DialogTitle>
          </DialogHeader>
          <CreateBill onBack={() => setShowCreateBill(false)} mode="dialog" />
        </DialogContent>
      </Dialog>
    </div>
  )
}
