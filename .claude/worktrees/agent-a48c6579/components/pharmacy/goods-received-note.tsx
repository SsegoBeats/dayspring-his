"use client"

import { useState, useCallback } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import type { GRN } from "@/lib/pharmacy-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { X, Printer, Plus } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GrnLineItem {
  /** client-side unique key */
  _key: string
  medication_id: string
  medication_name: string
  batch_number: string
  expiry_date: string
  quantity_ordered: string
  quantity_received: string
  unit_cost: string
}

// GRN items that come back from the PO detail endpoint
interface PoDetailItem {
  medication_id: string
  medication_name?: string
  quantity_ordered: number
  unit_cost?: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _keyCounter = 0
function newKey() {
  return `row-${++_keyCounter}`
}

function emptyRow(): GrnLineItem {
  return {
    _key: newKey(),
    medication_id: "",
    medication_name: "",
    batch_number: "",
    expiry_date: "",
    quantity_ordered: "",
    quantity_received: "",
    unit_cost: "",
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoodsReceivedNote() {
  const { suppliers, purchaseOrders, medications, createGrn } = usePharmacy()

  // ── Form state ──
  const [linkToPo, setLinkToPo] = useState(false)
  const [selectedPoId, setSelectedPoId] = useState("")
  const [supplierId, setSupplierId] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<GrnLineItem[]>([emptyRow()])
  const [poLoading, setPoLoading] = useState(false)

  // ── Submission state ──
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Print mode ──
  const [savedGrn, setSavedGrn] = useState<GRN | null>(null)

  // ── Derived: linkable POs (approved or partially_received) ──
  const linkablePOs = purchaseOrders.filter(
    (po) => po.status === "approved" || po.status === "partially_received",
  )

  // ── Active suppliers ──
  const activeSuppliers = suppliers.filter((s) => s.is_active)

  // ─── PO toggle ────────────────────────────────────────────────────────────

  const handleLinkToggle = useCallback((checked: boolean) => {
    setLinkToPo(checked)
    if (!checked) {
      setSelectedPoId("")
      setSupplierId("")
      setSupplierName("")
      setItems([emptyRow()])
    }
  }, [])

  // ─── PO selection: fetch line items ───────────────────────────────────────

  const handlePoSelect = useCallback(async (poId: string) => {
    setSelectedPoId(poId)
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po) return

    setSupplierId(po.supplier_id)
    setSupplierName(po.supplier_name ?? "")

    setPoLoading(true)
    try {
      const res = await fetch(`/api/pharmacy/purchase-orders/${poId}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch PO details")
      const data = await res.json()
      const poItems: PoDetailItem[] = data.items ?? []
      if (poItems.length > 0) {
        setItems(
          poItems.map((item) => ({
            _key: newKey(),
            medication_id: item.medication_id,
            medication_name: item.medication_name ?? "",
            batch_number: "",
            expiry_date: "",
            quantity_ordered: String(item.quantity_ordered ?? ""),
            quantity_received: "",
            unit_cost: item.unit_cost != null ? String(item.unit_cost) : "",
          })),
        )
      } else {
        setItems([emptyRow()])
      }
    } catch {
      // Fall back to single empty row on error
      setItems([emptyRow()])
    } finally {
      setPoLoading(false)
    }
  }, [purchaseOrders])

  // ─── Item row helpers ─────────────────────────────────────────────────────

  const updateItem = useCallback(
    (key: string, field: keyof Omit<GrnLineItem, "_key">, value: string) => {
      setItems((prev) =>
        prev.map((row) => (row._key === key ? { ...row, [field]: value } : row)),
      )
    },
    [],
  )

  const addRow = useCallback(() => {
    setItems((prev) => [...prev, emptyRow()])
  }, [])

  const removeRow = useCallback((key: string) => {
    setItems((prev) => {
      if (prev.length === 1) return prev // keep at least one row
      return prev.filter((row) => row._key !== key)
    })
  }, [])

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      const effectiveSupplierId = supplierId
      if (!effectiveSupplierId) {
        setError("Please select a supplier.")
        return
      }

      // Validate rows
      for (let i = 0; i < items.length; i++) {
        const row = items[i]
        if (!row.medication_id) {
          setError(`Row ${i + 1}: medication is required.`)
          return
        }
        if (!row.batch_number.trim()) {
          setError(`Row ${i + 1}: batch number is required.`)
          return
        }
        if (!row.expiry_date) {
          setError(`Row ${i + 1}: expiry date is required.`)
          return
        }
        const qtyRcv = Number(row.quantity_received)
        if (!Number.isFinite(qtyRcv) || qtyRcv < 1) {
          setError(`Row ${i + 1}: quantity received must be at least 1.`)
          return
        }
      }

      setSaving(true)
      try {
        const grn = await createGrn({
          supplier_id: effectiveSupplierId,
          purchase_order_id: linkToPo && selectedPoId ? selectedPoId : undefined,
          invoice_number: invoiceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
          items: items.map((row) => ({
            medication_id: row.medication_id,
            batch_number: row.batch_number.trim(),
            expiry_date: row.expiry_date,
            quantity_ordered: row.quantity_ordered ? Number(row.quantity_ordered) : undefined,
            quantity_received: Number(row.quantity_received),
            unit_cost: row.unit_cost ? Number(row.unit_cost) : undefined,
          })),
        })
        setSavedGrn(grn)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save GRN. Please try again.")
      } finally {
        setSaving(false)
      }
    },
    [supplierId, items, linkToPo, selectedPoId, invoiceNumber, notes, createGrn],
  )

  // ─── Reset to form ────────────────────────────────────────────────────────

  const handleNewReceipt = useCallback(() => {
    setSavedGrn(null)
    setLinkToPo(false)
    setSelectedPoId("")
    setSupplierId("")
    setSupplierName("")
    setInvoiceNumber("")
    setNotes("")
    setItems([emptyRow()])
    setError(null)
  }, [])

  // ─── Print mode ───────────────────────────────────────────────────────────

  if (savedGrn) {
    const printItems = items.map((row) => ({
      medication_name: row.medication_name,
      batch_number: row.batch_number,
      expiry_date: row.expiry_date,
      quantity_ordered: row.quantity_ordered ? Number(row.quantity_ordered) : null,
      quantity_received: Number(row.quantity_received),
      unit_cost: row.unit_cost ? Number(row.unit_cost) : null,
      total: row.unit_cost ? Number(row.quantity_received) * Number(row.unit_cost) : null,
    }))

    const totalItems = printItems.reduce((acc, r) => acc + r.quantity_received, 0)
    const totalValue = printItems.reduce((acc, r) => acc + (r.total ?? 0), 0)
    const receivedDate = savedGrn.received_at
      ? new Date(savedGrn.received_at).toLocaleDateString()
      : new Date().toLocaleDateString()

    return (
      <div className="mx-auto max-w-4xl">
        {/* Action buttons — hidden on print */}
        <div className="mb-4 flex gap-2 print:hidden">
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={handleNewReceipt}>
            New Receipt
          </Button>
        </div>

        {/* GRN Document */}
        <div className="rounded-md border bg-white p-8 text-black print:border-0 print:p-0">
          {/* Hospital header */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              Dayspring Community Health Care
            </h1>
            <h2 className="mt-1 text-xl font-semibold uppercase tracking-widest text-gray-700">
              Goods Received Note
            </h2>
            <hr className="mt-3 border-t-2 border-black" />
          </div>

          {/* GRN meta */}
          <div className="mb-5 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold">GRN No:</span>{" "}
              <span>{savedGrn.grn_number}</span>
            </div>
            <div>
              <span className="font-semibold">Date:</span>{" "}
              <span>{receivedDate}</span>
            </div>
            <div>
              <span className="font-semibold">Invoice No:</span>{" "}
              <span>{savedGrn.invoice_number || "—"}</span>
            </div>
          </div>
          <div className="mb-5 text-sm">
            <span className="font-semibold">Supplier:</span>{" "}
            <span>{savedGrn.supplier_name ?? supplierName}</span>
          </div>
          {savedGrn.notes && (
            <div className="mb-5 text-sm">
              <span className="font-semibold">Notes:</span>{" "}
              <span>{savedGrn.notes}</span>
            </div>
          )}

          {/* Items table */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-3 py-2 text-left">Medication</th>
                  <th className="border border-gray-400 px-3 py-2 text-left">Batch No.</th>
                  <th className="border border-gray-400 px-3 py-2 text-left">Expiry</th>
                  <th className="border border-gray-400 px-3 py-2 text-right">Qty Ordered</th>
                  <th className="border border-gray-400 px-3 py-2 text-right">Qty Received</th>
                  <th className="border border-gray-400 px-3 py-2 text-right">Unit Cost</th>
                  <th className="border border-gray-400 px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-3 py-2">{row.medication_name || "—"}</td>
                    <td className="border border-gray-300 px-3 py-2">{row.batch_number}</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {row.expiry_date
                        ? new Date(row.expiry_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {row.quantity_ordered ?? "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {row.quantity_received}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {row.unit_cost != null ? `UGX ${row.unit_cost.toLocaleString()}` : "—"}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right">
                      {row.total != null ? `UGX ${row.total.toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mb-8 flex justify-end gap-8 text-sm font-semibold">
            <span>Total Items Received: {totalItems.toLocaleString()}</span>
            {totalValue > 0 && (
              <span>Total Value: UGX {totalValue.toLocaleString()}</span>
            )}
          </div>

          {/* Signature section */}
          <div className="mt-10 grid grid-cols-3 gap-8 text-sm">
            <div>
              <p>Received by:</p>
              <p className="mt-6 border-t border-black pt-1">Signature / Date</p>
            </div>
            <div>
              <p>Store Keeper:</p>
              <p className="mt-6 border-t border-black pt-1">Signature / Date</p>
            </div>
            <div>
              <p>Verified by:</p>
              <p className="mt-6 border-t border-black pt-1">Signature / Date</p>
            </div>
          </div>
        </div>

        <style>{`
          @media print {
            .print\\:hidden { display: none !important; }
            .print\\:border-0 { border: none !important; }
            .print\\:p-0 { padding: 0 !important; }
          }
        `}</style>
      </div>
    )
  }

  // ─── Form mode ────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:hidden">
      <Card>
        <CardHeader>
          <CardTitle>Receive Stock — New GRN</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* ── Section 1: PO Linkage ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                PO Linkage
              </h3>
              <div className="flex items-center gap-3">
                <Switch
                  id="link-po-toggle"
                  checked={linkToPo}
                  onCheckedChange={handleLinkToggle}
                />
                <Label htmlFor="link-po-toggle">Link to Purchase Order?</Label>
              </div>

              {linkToPo && (
                <div className="space-y-1">
                  <Label htmlFor="po-select">Purchase Order</Label>
                  {linkablePOs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No approved or partially received purchase orders available.
                    </p>
                  ) : (
                    <Select
                      value={selectedPoId}
                      onValueChange={handlePoSelect}
                      disabled={poLoading}
                    >
                      <SelectTrigger id="po-select">
                        <SelectValue placeholder="Select a purchase order…" />
                      </SelectTrigger>
                      <SelectContent>
                        {linkablePOs.map((po) => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.po_number} — {po.supplier_name ?? po.supplier_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {poLoading && (
                    <p className="text-xs text-muted-foreground">Loading PO items…</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Section 2: Header Fields ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Receipt Details
              </h3>

              {/* Supplier */}
              <div className="space-y-1">
                <Label htmlFor="supplier">Supplier *</Label>
                {linkToPo && selectedPoId ? (
                  <Input
                    id="supplier"
                    value={supplierName}
                    readOnly
                    className="bg-muted"
                  />
                ) : (
                  <Select value={supplierId} onValueChange={(v) => {
                    setSupplierId(v)
                    setSupplierName(activeSuppliers.find((s) => s.id === v)?.name ?? "")
                  }}>
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Select supplier…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSuppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Invoice Number */}
              <div className="space-y-1">
                <Label htmlFor="invoice-number">Invoice Number (optional)</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0042"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label htmlFor="grn-notes">Notes (optional)</Label>
                <Textarea
                  id="grn-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this receipt…"
                  rows={3}
                />
              </div>
            </div>

            {/* ── Section 3: Items Table ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </h3>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Medication *</TableHead>
                      <TableHead className="min-w-[130px]">Batch No. *</TableHead>
                      <TableHead className="min-w-[140px]">Expiry Date *</TableHead>
                      <TableHead className="min-w-[100px] text-right">Qty Ordered</TableHead>
                      <TableHead className="min-w-[110px] text-right">Qty Received *</TableHead>
                      <TableHead className="min-w-[110px] text-right">Unit Cost</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <TableRow key={row._key}>
                        {/* Medication */}
                        <TableCell>
                          {linkToPo && selectedPoId && row.medication_name ? (
                            <span className="text-sm">{row.medication_name}</span>
                          ) : (
                            <Select
                              value={row.medication_id}
                              onValueChange={(v) => {
                                const med = medications.find((m) => m.id === v)
                                updateItem(row._key, "medication_id", v)
                                updateItem(row._key, "medication_name", med?.name ?? "")
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                              <SelectContent>
                                {medications.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>

                        {/* Batch Number */}
                        <TableCell>
                          <Input
                            className="h-8"
                            value={row.batch_number}
                            onChange={(e) => updateItem(row._key, "batch_number", e.target.value)}
                            placeholder="BATCH-001"
                          />
                        </TableCell>

                        {/* Expiry Date */}
                        <TableCell>
                          <Input
                            className="h-8"
                            type="date"
                            value={row.expiry_date}
                            onChange={(e) => updateItem(row._key, "expiry_date", e.target.value)}
                          />
                        </TableCell>

                        {/* Qty Ordered */}
                        <TableCell className="text-right">
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min={0}
                            value={row.quantity_ordered}
                            onChange={(e) => updateItem(row._key, "quantity_ordered", e.target.value)}
                            placeholder="—"
                            readOnly={!!(linkToPo && selectedPoId && row.quantity_ordered)}
                          />
                        </TableCell>

                        {/* Qty Received */}
                        <TableCell className="text-right">
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min={1}
                            value={row.quantity_received}
                            onChange={(e) => updateItem(row._key, "quantity_received", e.target.value)}
                            placeholder="0"
                            required
                          />
                        </TableCell>

                        {/* Unit Cost */}
                        <TableCell className="text-right">
                          <Input
                            className="h-8 text-right"
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.unit_cost}
                            onChange={(e) => updateItem(row._key, "unit_cost", e.target.value)}
                            placeholder="0.00"
                          />
                        </TableCell>

                        {/* Remove */}
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeRow(row._key)}
                            disabled={items.length === 1}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {/* ── Error message ── */}
            {error && (
              <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* ── Submit ── */}
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save GRN"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
