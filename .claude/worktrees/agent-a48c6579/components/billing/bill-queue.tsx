"use client"

import { useState } from "react"
import type { Bill } from "@/lib/billing-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { BillRow } from "./bill-row"

interface BillQueueProps {
  bills: Bill[]
  onSelectBill: (billId: string) => void
  onEditBill?: (billId: string) => void
  onDeleteBill?: (billId: string) => void
  onCreateBill?: () => void
  emptyMessage: string
  showCreateButton?: boolean
  highlightBillId?: string | null
  showAging?: boolean
}

export function BillQueue({
  bills,
  onSelectBill,
  onCreateBill,
  onEditBill,
  onDeleteBill,
  emptyMessage,
  showCreateButton,
  highlightBillId,
  showAging = false,
}: BillQueueProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [reprintLoadingId, setReprintLoadingId] = useState<string | null>(null)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Bills &amp; Invoices</CardTitle>
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
            {bills.map((bill) => {
              const canDelete = bill.status === "pending" && (bill.paidAmount ?? 0) <= 0
              return (
                <div key={bill.id} className="relative">
                  <BillRow
                    bill={bill}
                    highlightBillId={highlightBillId}
                    showAging={showAging}
                    onSelect={onSelectBill}
                    onEdit={onEditBill}
                    onReprint={async (billId) => {
                      setReprintLoadingId(billId)
                      try {
                        const res = await fetch(`/api/payments?billId=${encodeURIComponent(billId)}&limit=1`, {
                          credentials: "include",
                        })
                        const data = await res.json().catch(() => ({})) as { payments?: { id: string }[] }
                        const paymentId = data.payments?.[0]?.id
                        if (paymentId) {
                          window.open(`/api/receipts/${paymentId}`, "_blank", "noopener,noreferrer")
                        } else {
                          toast.error("No receipt found for this bill")
                        }
                      } catch {
                        toast.error("Failed to load receipt")
                      } finally {
                        setReprintLoadingId(null)
                      }
                    }}
                    onDelete={canDelete && onDeleteBill ? () => setConfirmDeleteId(bill.id) : undefined}
                    deletingId={deletingId}
                    reprintLoadingId={reprintLoadingId}
                  />
                  {canDelete && onDeleteBill && (
                    <AlertDialog open={confirmDeleteId === bill.id} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null) }}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the bill. Use this if the patient will not pay (e.g. cancelled visit). This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            disabled={deletingId === bill.id}
                            onClick={async () => {
                              setConfirmDeleteId(null)
                              setDeletingId(bill.id)
                              try {
                                const res = await fetch(`/api/billing/${bill.id}`, { method: "DELETE", credentials: "include" })
                                if (!res.ok) {
                                  const err = await res.json().catch(() => ({})) as { error?: string }
                                  toast.error(err.error || "Failed to delete bill")
                                  return
                                }
                                toast.success("Bill deleted")
                                onDeleteBill(bill.id)
                              } catch {
                                toast.error("Failed to delete bill")
                              } finally {
                                setDeletingId(null)
                              }
                            }}
                          >
                            {deletingId === bill.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
