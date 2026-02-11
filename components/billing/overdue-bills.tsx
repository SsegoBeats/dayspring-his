"use client"

import { useBilling } from "@/lib/billing-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, AlertTriangle, Calendar } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { BillQueue } from "./bill-queue"

interface OverdueBillsProps {
  onBack: () => void
  onSelectBill?: (billId: string) => void
}

export function OverdueBills({ onBack, onSelectBill }: OverdueBillsProps) {
  const { getOverdueBills } = useBilling()
  const formatCurrency = useFormatCurrency()
  const overdueBills = getOverdueBills()

  const totalOverdue = overdueBills.reduce((sum, bill) => {
    const remaining = bill.total - (bill.paidAmount || 0)
    return sum + remaining
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Overdue Bills</h2>
            <p className="text-muted-foreground">Bills that are past their due date</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-red-100 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-red-700">
              Overdue Bills
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{overdueBills.length}</div>
            <p className="text-xs text-red-800/80">Requires attention</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-amber-700">
              Total Overdue Amount
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-amber-800/80">Outstanding balance</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100 bg-slate-50/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-700">
              Average Days Overdue
            </CardTitle>
            <Calendar className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-slate-900">
              {overdueBills.length > 0
                ? Math.round(
                    overdueBills.reduce((sum, bill) => {
                      const billDate = new Date(bill.date)
                      const today = new Date()
                      const daysDiff = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24))
                      return sum + daysDiff
                    }, 0) / overdueBills.length,
                  )
                : 0}
            </div>
            <p className="text-xs text-slate-700/80">Days past due</p>
          </CardContent>
        </Card>
      </div>

      {overdueBills.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="mb-2">No Overdue Bills</CardTitle>
            <CardDescription>All bills are up to date. Great job!</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <BillQueue
          bills={overdueBills}
          onSelectBill={onSelectBill}
          emptyMessage="No overdue bills found."
          showCreateButton={false}
        />
      )}
    </div>
  )
}
