"use client"

import { Loader2, ReceiptText, Edit, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Bill } from "@/lib/billing-context"
import { useFormatCurrency } from "@/lib/settings-context"
import { formatPatientNumber } from "@/lib/patients"

interface BillRowProps {
  bill: Bill
  highlightBillId?: string | null
  showAging?: boolean
  onSelect: (billId: string) => void
  onEdit?: (billId: string) => void
  onDelete?: (billId: string) => void
  onReprint?: (billId: string) => void
  deletingId?: string | null
  reprintLoadingId?: string | null
}

export function getAgingBand(dateStr: string): { label: string; rowClass: string; badgeClass: string } {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 90) return {
    label: `${days}d overdue`,
    rowClass: "border-purple-200 bg-purple-50/30",
    badgeClass: "border border-purple-200 bg-purple-50 text-purple-700",
  }
  if (days >= 60) return {
    label: `${days}d overdue`,
    rowClass: "border-red-200 bg-red-50/30",
    badgeClass: "border border-red-200 bg-red-50 text-red-700",
  }
  if (days >= 30) return {
    label: `${days}d overdue`,
    rowClass: "border-orange-200 bg-orange-50/30",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-700",
  }
  return {
    label: `${days}d`,
    rowClass: "border-amber-200 bg-amber-50/20",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
  }
}

function getAvatarColors(bill: Bill, showAging: boolean): string {
  if (showAging) {
    const aging = getAgingBand(bill.date)
    if (aging.rowClass.includes("purple")) return "bg-purple-100 text-purple-700 ring-purple-200"
    if (aging.rowClass.includes("red"))    return "bg-red-100 text-red-700 ring-red-200"
    if (aging.rowClass.includes("orange")) return "bg-orange-100 text-orange-700 ring-orange-200"
    return "bg-amber-100 text-amber-700 ring-amber-200"
  }
  switch (bill.status) {
    case "paid":           return "bg-emerald-100 text-emerald-700 ring-emerald-200"
    case "partially paid": return "bg-orange-100 text-orange-700 ring-orange-200"
    case "cancelled":      return "bg-slate-100 text-slate-500 ring-slate-200"
    default:               return "bg-amber-100 text-amber-700 ring-amber-200" // pending
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function BillRow({
  bill,
  highlightBillId,
  showAging = false,
  onSelect,
  onEdit,
  onDelete,
  onReprint,
  deletingId,
  reprintLoadingId,
}: BillRowProps) {
  const formatCurrency = useFormatCurrency()
  const aging = showAging ? getAgingBand(bill.date) : null
  const isHighlighted = highlightBillId === bill.id

  const rowBase = isHighlighted
    ? "border-sky-300 bg-sky-50/60 shadow-sm shadow-sky-100 ring-2 ring-sky-400 motion-safe:animate-[highlight-pulse_600ms_ease-out]"
    : aging
      ? aging.rowClass
      : "border-border/60 bg-card"

  const balance = bill.total - (bill.paidAmount ?? 0)

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between ${rowBase}`}
    >
      {/* Left zone — avatar */}
      <div className="flex shrink-0 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 shadow-inner ${getAvatarColors(bill, showAging)}`}
        >
          {getInitials(bill.patientName)}
        </div>

        {/* Middle zone — bill info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{bill.patientName}</p>
            {bill.patientNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatPatientNumber(bill.patientNumber)}
              </span>
            )}
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
            {aging && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${aging.badgeClass}`}>
                {aging.label}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.billNumber || `${bill.id.slice(0, 8)}…`}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.date}
            </span>
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5">
              {bill.items.length} item(s)
            </span>
          </div>
          {(bill.paidAmount ?? 0) > 0 && (bill.paidAmount ?? 0) < bill.total && (
            <div className="mt-1 flex flex-wrap gap-3 text-xs">
              <span className="font-medium text-green-600">Paid: {formatCurrency(bill.paidAmount ?? 0)}</span>
              <span className="font-medium text-amber-600">Balance due: {formatCurrency(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right zone — amount + actions */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <span className="mr-2 text-lg font-bold text-foreground">
          {bill.status === "partially paid" ? formatCurrency(balance) : formatCurrency(bill.total)}
        </span>

        {bill.status === "paid" && onReprint && (
          <Button
            variant="outline"
            size="sm"
            disabled={reprintLoadingId === bill.id}
            title="Reprint receipt"
            onClick={() => onReprint(bill.id)}
          >
            {reprintLoadingId === bill.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <ReceiptText className="h-4 w-4" />}
          </Button>
        )}

        {bill.status === "pending" && onEdit && (
          <Button variant="outline" size="sm" onClick={() => onEdit(bill.id)} title="Edit bill">
            <Edit className="h-4 w-4" />
          </Button>
        )}

        {bill.status === "pending" && onDelete && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={deletingId === bill.id}
            onClick={() => onDelete(bill.id)}
            title="Delete bill"
          >
            {deletingId === bill.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Trash className="h-4 w-4" />}
          </Button>
        )}

        <Button
          size="sm"
          className="rounded-full"
          onClick={() => onSelect(bill.id)}
        >
          {bill.status === "paid" || bill.status === "cancelled" ? "View" : "Process"}
        </Button>
      </div>
    </div>
  )
}
