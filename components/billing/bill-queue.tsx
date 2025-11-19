"use client"

import type { Bill } from "@/lib/billing-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Plus } from "lucide-react"

interface BillQueueProps {
  bills: Bill[]
  onSelectBill: (billId: string) => void
  onCreateBill?: () => void
  emptyMessage: string
  showCreateButton?: boolean
}

export function BillQueue({ bills, onSelectBill, onCreateBill, emptyMessage, showCreateButton }: BillQueueProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Bills & Invoices</CardTitle>
            <CardDescription>View and process patient bills</CardDescription>
          </div>
          {showCreateButton && (
            <Button onClick={onCreateBill}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bill
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
            {showCreateButton && onCreateBill && (
              <Button variant="outline" size="sm" className="mt-1" onClick={onCreateBill}>
                <Plus className="mr-2 h-4 w-4" />
                Create Bill
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{bill.patientName}</p>
                    <Badge
                      variant={
                        bill.status === "paid" ? "default" : bill.status === "pending" ? "secondary" : "destructive"
                      }
                    >
                      {bill.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                    <span>Invoice: {bill.id}</span>
                    <span>Date: {bill.date}</span>
                    <span>Amount: ${bill.total.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{bill.items.length} item(s)</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onSelectBill(bill.id)}>
                  <FileText className="mr-2 h-4 w-4" />
                  {bill.status === "pending" ? "Process" : "View"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
