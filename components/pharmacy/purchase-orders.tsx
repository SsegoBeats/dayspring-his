"use client"

import { useState, useEffect, useCallback } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  PackageCheck,
  Loader2,
  AlertCircle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface PurchaseOrdersProps {
  onSwitchToGrnTab?: (poId?: string) => void
  role?: string
}

interface LineItem {
  medication_id: string
  quantity_ordered: number
  unit_cost: number | ""
  notes: string
}

interface PODetail {
  id: string
  po_number: string
  supplier_id: string
  supplier_name?: string
  status: string
  notes?: string
  expected_delivery_date?: string
  item_count?: number
  total_value?: number
  created_by_name?: string
  created_at: string
  items?: Array<{
    id: string
    medication_id: string
    medication_name?: string
    quantity_ordered: number
    unit_cost?: number
    notes?: string
  }>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  partially_received: "bg-blue-100 text-blue-800",
  received: "bg-teal-100 text-teal-800",
  cancelled: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  partially_received: "Partially Received",
  received: "Received",
  cancelled: "Cancelled",
}

const FILTER_TABS = ["all", "draft", "pending_approval", "approved", "partially_received", "received", "cancelled"]

function formatCurrency(amount?: number) {
  if (amount == null) return "—"
  return `UGX ${amount.toLocaleString()}`
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-UG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ")
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── New LPO Dialog (3-step) ────────────────────────────────────────────────────

const EMPTY_ITEM: LineItem = { medication_id: "", quantity_ordered: 1, unit_cost: "", notes: "" }

function NewLPODialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { suppliers, medications, createPurchaseOrder, refreshPurchaseOrders } = usePharmacy()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [supplierId, setSupplierId] = useState("")
  const [expectedDelivery, setExpectedDelivery] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1)
      setSupplierId("")
      setExpectedDelivery("")
      setNotes("")
      setItems([{ ...EMPTY_ITEM }])
      setError(null)
    }
  }, [open])

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) =>
    setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  const updateItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  const canProceedStep1 = supplierId !== ""
  const canProceedStep2 = items.every((it) => it.medication_id !== "" && Number(it.quantity_ordered) > 0)

  const totalValue = items.reduce((sum, it) => {
    const qty = Number(it.quantity_ordered) || 0
    const cost = Number(it.unit_cost) || 0
    return sum + qty * cost
  }, 0)

  const getSupplierName = () => suppliers.find((s) => s.id === supplierId)?.name ?? "—"
  const getMedName = (id: string) => medications.find((m) => m.id === id)?.name ?? id

  const handleSubmit = async (submitForApproval: boolean) => {
    setError(null)
    setLoading(true)
    try {
      await createPurchaseOrder({
        supplier_id: supplierId,
        expected_delivery_date: expectedDelivery || undefined,
        notes: notes || undefined,
        submit_for_approval: submitForApproval,
        items: items.map((it) => ({
          medication_id: it.medication_id,
          quantity_ordered: Number(it.quantity_ordered),
          unit_cost: it.unit_cost !== "" ? Number(it.unit_cost) : undefined,
          notes: it.notes || undefined,
        })),
      })
      toast({
        title: submitForApproval ? "LPO submitted for approval" : "LPO saved as draft",
        description: "Purchase order created successfully.",
      })
      onOpenChange(false)
      refreshPurchaseOrders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create purchase order"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Local Purchase Order (LPO)</DialogTitle>
          <DialogDescription>Step {step} of 3</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Supplier ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="supplier" className="mt-1">
                  <SelectValue placeholder="Select a supplier…" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="delivery-date">Expected Delivery Date</Label>
              <Input
                id="delivery-date"
                type="date"
                className="mt-1"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                className="mt-1 resize-none"
                rows={3}
                placeholder="Optional notes for this purchase order…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Line Items ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Medication *</Label>
                    <Select
                      value={item.medication_id}
                      onValueChange={(v) => updateItem(idx, "medication_id", v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select medication…" />
                      </SelectTrigger>
                      <SelectContent>
                        {medications.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`po-item-qty-${idx}`} className="text-xs">Qty Ordered *</Label>
                      <Input
                        id={`po-item-qty-${idx}`}
                        name={`poItemQty-${idx}`}
                        type="number"
                        min={1}
                        autoComplete="off"
                        className="mt-1"
                        value={item.quantity_ordered}
                        onChange={(e) => updateItem(idx, "quantity_ordered", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`po-item-cost-${idx}`} className="text-xs">Unit Cost (UGX)</Label>
                      <Input
                        id={`po-item-cost-${idx}`}
                        name={`poItemCost-${idx}`}
                        type="number"
                        min={0}
                        autoComplete="off"
                        className="mt-1"
                        placeholder="Optional"
                        value={item.unit_cost}
                        onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`po-item-notes-${idx}`} className="text-xs">Notes</Label>
                    <Input
                      id={`po-item-notes-${idx}`}
                      name={`poItemNotes-${idx}`}
                      autoComplete="off"
                      className="mt-1"
                      placeholder="Optional"
                      value={item.notes}
                      onChange={(e) => updateItem(idx, "notes", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Supplier</span>
                <span className="font-medium">{getSupplierName()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Delivery</span>
                <span className="font-medium">{expectedDelivery ? formatDate(expectedDelivery) : "—"}</span>
              </div>
              {notes && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notes</span>
                  <span className="font-medium max-w-[60%] text-right">{notes}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Line Items</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity_ordered) || 0
                    const cost = Number(item.unit_cost) || 0
                    return (
                      <TableRow key={idx}>
                        <TableCell>{getMedName(item.medication_id)}</TableCell>
                        <TableCell className="text-right">{qty}</TableCell>
                        <TableCell className="text-right">
                          {item.unit_cost !== "" ? formatCurrency(cost) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.unit_cost !== "" ? formatCurrency(qty * cost) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {totalValue > 0 && (
                <div className="mt-2 flex justify-end">
                  <span className="text-sm font-semibold">
                    Total Value: {formatCurrency(totalValue)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
            >
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            >
              Next
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save as Draft
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit for Approval
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Cancel Dialog ─────────────────────────────────────────────────────────────

function CancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setReason(""); setError(null) }
  }, [open])

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    try {
      await onConfirm(reason)
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel order")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Purchase Order</DialogTitle>
          <DialogDescription>
            Please provide a reason for cancellation. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <Label htmlFor="cancel-reason">Cancellation Reason</Label>
          <Textarea
            id="cancel-reason"
            className="mt-1 resize-none"
            rows={3}
            placeholder="Enter reason for cancellation…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Keep Order
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Cancel Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Details Sheet ─────────────────────────────────────────────────────────────

function DetailsSheet({
  poId,
  open,
  onOpenChange,
}: {
  poId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [detail, setDetail] = useState<PODetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !poId) return
    setLoading(true)
    setError(null)
    setDetail(null)
    fetch(`/api/pharmacy/purchase-orders/${poId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load purchase order details")
        const data = await res.json()
        setDetail(data.purchase_order ?? data)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Error loading details"))
      .finally(() => setLoading(false))
  }, [poId, open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Purchase Order Details</SheetTitle>
          <SheetDescription>
            {detail ? detail.po_number : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading details…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {detail && !loading && (
            <div className="space-y-6">
              <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PO Number</span>
                  <span className="font-medium">{detail.po_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier</span>
                  <span className="font-medium">{detail.supplier_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Delivery</span>
                  <span className="font-medium">{formatDate(detail.expected_delivery_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created By</span>
                  <span className="font-medium">{detail.created_by_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created At</span>
                  <span className="font-medium">{formatDate(detail.created_at)}</span>
                </div>
                {detail.total_value != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-semibold">{formatCurrency(detail.total_value)}</span>
                  </div>
                )}
                {detail.notes && (
                  <div className="pt-1">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    <span className="font-medium">{detail.notes}</span>
                  </div>
                )}
              </div>

              {detail.items && detail.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Line Items</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medication</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => {
                        const subtotal =
                          item.unit_cost != null
                            ? item.quantity_ordered * item.unit_cost
                            : null
                        return (
                          <TableRow key={item.id}>
                            <TableCell>{item.medication_name ?? item.medication_id}</TableCell>
                            <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unit_cost)}
                            </TableCell>
                            <TableCell className="text-right">
                              {subtotal != null ? formatCurrency(subtotal) : "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PurchaseOrders({ onSwitchToGrnTab, role }: PurchaseOrdersProps) {
  const {
    purchaseOrders,
    refreshPurchaseOrders,
    approvePurchaseOrder,
    cancelPurchaseOrder,
  } = usePharmacy()
  const { toast } = useToast()

  const [filterStatus, setFilterStatus] = useState("all")
  const [showNewLPO, setShowNewLPO] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [detailPoId, setDetailPoId] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Refresh on mount if empty
  useEffect(() => {
    if (purchaseOrders.length === 0) {
      refreshPurchaseOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered =
    filterStatus === "all"
      ? purchaseOrders
      : purchaseOrders.filter((po) => po.status === filterStatus)

  const isAdmin = role === "Hospital Admin"

  const handleApprove = useCallback(
    async (id: string) => {
      if (!window.confirm("Approve this purchase order?")) return
      setApprovingId(id)
      try {
        await approvePurchaseOrder(id)
        toast({ title: "Purchase order approved" })
      } catch (err: unknown) {
        toast({
          title: "Approval failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        })
      } finally {
        setApprovingId(null)
      }
    },
    [approvePurchaseOrder, toast]
  )

  const handleCancelConfirm = useCallback(
    async (reason: string) => {
      if (!cancelTarget) return
      await cancelPurchaseOrder(cancelTarget, reason || undefined)
      toast({ title: "Purchase order cancelled" })
      setCancelTarget(null)
    },
    [cancelPurchaseOrder, cancelTarget, toast]
  )

  return (
    <>
      <Card>
        <CardHeader>
          {/* Print-only header */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold uppercase tracking-wide">Dayspring Community Health Care</h1>
            <h2 className="text-base font-semibold">Purchase Orders</h2>
            <p className="text-xs text-gray-600">Printed: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div>
              <CardTitle>Purchase Orders</CardTitle>
              <CardDescription>Manage medication local purchase orders (LPOs)</CardDescription>
            </div>
            <Button onClick={() => setShowNewLPO(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New LPO
            </Button>
          </div>

          {/* Status filter tabs */}
          <div className="mt-2 flex flex-wrap gap-1 print:hidden">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterStatus === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {STATUS_LABELS[tab]}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PackageCheck className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No purchase orders found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filterStatus === "all"
                  ? "Get started by creating a new LPO."
                  : `No orders with status "${STATUS_LABELS[filterStatus] ?? filterStatus}".`}
              </p>
              {filterStatus === "all" && (
                <Button size="sm" className="mt-4" onClick={() => setShowNewLPO(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New LPO
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="print:text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right print:hidden">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((po) => {
                    const canApprove =
                      isAdmin && ["draft", "pending_approval"].includes(po.status)
                    const canCancel = !["received", "cancelled"].includes(po.status)
                    const canReceive = ["approved", "partially_received"].includes(po.status)
                    const isApproving = approvingId === po.id

                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {po.po_number}
                        </TableCell>
                        <TableCell>{po.supplier_name ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={po.status} />
                        </TableCell>
                        <TableCell className="text-right">{po.item_count ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(po.total_value)}
                        </TableCell>
                        <TableCell>{formatDate(po.expected_delivery_date)}</TableCell>
                        <TableCell>{po.created_by_name ?? "—"}</TableCell>
                        <TableCell className="print:hidden">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setDetailPoId(po.id)
                                setShowDetails(true)
                              }}
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </Button>

                            {/* Approve */}
                            {canApprove && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                                onClick={() => handleApprove(po.id)}
                                disabled={isApproving}
                              >
                                {isApproving ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                            )}

                            {/* Receive Stock */}
                            {canReceive && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                                onClick={() => onSwitchToGrnTab?.(po.id)}
                              >
                                <PackageCheck className="mr-1 h-3.5 w-3.5" />
                                Receive
                              </Button>
                            )}

                            {/* Cancel */}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setCancelTarget(po.id)}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New LPO Dialog */}
      <NewLPODialog open={showNewLPO} onOpenChange={setShowNewLPO} />

      {/* Cancel Dialog */}
      <CancelDialog
        open={cancelTarget !== null}
        onOpenChange={(v) => { if (!v) setCancelTarget(null) }}
        onConfirm={handleCancelConfirm}
      />

      {/* Details Sheet */}
      <DetailsSheet
        poId={detailPoId}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  )
}
