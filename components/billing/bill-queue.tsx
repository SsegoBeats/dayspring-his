"use client"

import type { Bill } from "@/lib/billing-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Plus, Edit } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"

interface BillQueueProps {
  bills: Bill[]
  onSelectBill: (billId: string) => void
  onEditBill?: (billId: string) => void
  onCreateBill?: () => void
  emptyMessage: string
  showCreateButton?: boolean
}

export function BillQueue({ bills, onSelectBill, onCreateBill, onEditBill, emptyMessage, showCreateButton }: BillQueueProps) {
  const formatCurrency = useFormatCurrency()
  
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bills & Invoices</CardTitle>
            <CardDescription className="text-xs">View and process patient bills</CardDescription>
          </div>
          {showCreateButton && onCreateBill && (
            <Button size="sm" onClick={onCreateBill} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create Bill
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/30 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
            {showCreateButton && onCreateBill && (
              <Button variant="outline" size="sm" onClick={onCreateBill} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create Bill
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{bill.patientName}</p>
                    <Badge
                      variant={
                        bill.status === "paid"
                          ? "default"
                          : bill.status === "pending"
                            ? "secondary"
                            : bill.status === "partially paid"
                              ? "outline"
                              : "destructive"
                      }
                    >
                      {bill.status === "partially paid" ? "Partially Paid" : bill.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Invoice: {bill.id}</span>
                    <span>Date: {bill.date}</span>
                    <span>Total: {formatCurrency(bill.total)}</span>
                    {bill.status === "partially paid" && bill.paidAmount && (
                      <>
                        <span className="text-green-600 font-medium">
                          Paid: {formatCurrency(bill.paidAmount)}
                        </span>
                        <span className="text-amber-600 font-medium">
                          Remaining: {formatCurrency(bill.total - bill.paidAmount)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{bill.items.length} item(s)</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {bill.status === "pending" && onEditBill && (
                    <Button variant="outline" size="sm" onClick={() => onEditBill(bill.id)} title="Edit bill">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" onClick={() => onSelectBill(bill.id)}>
                    <FileText className="mr-1.5 h-4 w-4" />
                    {bill.status === "pending" || bill.status === "partially paid" ? "Process" : "View"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
