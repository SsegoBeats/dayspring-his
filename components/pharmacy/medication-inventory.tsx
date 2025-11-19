"use client"

import { useMemo, useState } from "react"
import type { Medication } from "@/lib/pharmacy-context"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Search, AlertTriangle, Plus, Info, Barcode, Filter, Trash2 } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { AddMedicationDialog } from "./add-medication-dialog"
import { StockMovements } from "./stock-movements"

type ScanSummary = {
  name: string
  quantity: number
  newStock: number
}

type StockFilter = "all" | "healthy" | "low" | "out"
type ExpiryFilter = "all" | "expiring" | "expired" | "none"
type SortKey = "name" | "stock" | "expiry" | "price" | "manufacturer"

export function MedicationInventory() {
  const { medications, getLowStockMedications, updateMedication, getExpiringMedications, deleteMedication } =
    usePharmacy()
  const formatCurrency = useFormatCurrency()
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [filterLowStock, setFilterLowStock] = useState(false)
  const [stockFilter, setStockFilter] = useState<StockFilter>("all")
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [scanCode, setScanCode] = useState("")
  const [scanQty, setScanQty] = useState("")
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null)
  const [scanMode, setScanMode] = useState(true)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<{
    name: string
    category: string
    manufacturer: string
    batchNumber: string
    stockQuantity: string
    reorderLevel: string
    unitPrice: string
    expiryDate: string
    barcode: string
  } | null>(null)

  const lowStockMeds = getLowStockMedications()
  const expiringSoonSet = new Set(getExpiringMedications(30).map((m) => m.id))

  const classifyStock = (med: Medication): StockFilter => {
    if (med.stockQuantity <= 0) return "out"
    if (med.stockQuantity <= med.reorderLevel) return "low"
    return "healthy"
  }

  const classifyExpiry = (med: Medication): ExpiryFilter => {
    if (!med.expiryDate) return "none"
    const today = new Date()
    const exp = new Date(med.expiryDate)
    if (Number.isNaN(exp.getTime())) return "none"
    if (exp < today) return "expired"
    if (expiringSoonSet.has(med.id)) return "expiring"
    return "all"
  }

  const normalized = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    return medications
      .filter((med) => {
        const matchesSearch =
          !query ||
          med.name.toLowerCase().includes(query) ||
          med.category.toLowerCase().includes(query) ||
          med.manufacturer.toLowerCase().includes(query) ||
          (med.barcode && med.barcode.toLowerCase().includes(query))

        if (!matchesSearch) return false

        if (filterLowStock && med.stockQuantity > med.reorderLevel) return false

        const sClass = classifyStock(med)
        if (stockFilter !== "all" && sClass !== stockFilter) return false

        const eClass = classifyExpiry(med)
        if (expiryFilter !== "all" && eClass !== expiryFilter) return false

        return true
      })
      .sort((a, b) => {
        switch (sortKey) {
          case "name":
            return a.name.localeCompare(b.name)
          case "manufacturer":
            return a.manufacturer.localeCompare(b.manufacturer)
          case "stock":
            return b.stockQuantity - a.stockQuantity
          case "price":
            return b.unitPrice - a.unitPrice
          case "expiry": {
            const ad = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity
            const bd = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity
            return ad - bd
          }
          default:
            return 0
        }
      })
  }, [medications, searchQuery, filterLowStock, stockFilter, expiryFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(normalized.length / pageSize))
  const pageClamped = Math.min(page, totalPages - 1)
  const pagedMedications = normalized.slice(pageClamped * pageSize, pageClamped * pageSize + pageSize)

  const handleOpenDetails = (med: Medication) => {
    setSelectedMedication(med)
    setIsEditing(false)
    setEditForm(null)
  }

  const closeDetails = () => {
    setSelectedMedication(null)
    setIsEditing(false)
    setEditForm(null)
  }

  const handleDeleteSelected = () => {
    if (!selectedMedication) return
    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedMedication.name}" from inventory? This cannot be undone.`,
    )
    if (!confirmed) return
    deleteMedication(selectedMedication.id)
    closeDetails()
  }

  const startEditing = () => {
    if (!selectedMedication) return
    setIsEditing(true)
    setEditForm({
      name: selectedMedication.name,
      category: selectedMedication.category,
      manufacturer: selectedMedication.manufacturer,
      batchNumber: selectedMedication.batchNumber || "",
      stockQuantity: String(selectedMedication.stockQuantity),
      reorderLevel: String(selectedMedication.reorderLevel),
      unitPrice: String(selectedMedication.unitPrice),
      expiryDate: selectedMedication.expiryDate || "",
      barcode: selectedMedication.barcode || "",
    })
  }

  const saveEdits = () => {
    if (!selectedMedication || !editForm) return
    const updated: Partial<Medication> = {
      name: editForm.name,
      category: editForm.category,
      manufacturer: editForm.manufacturer,
      batchNumber: editForm.batchNumber,
      stockQuantity: Number.parseInt(editForm.stockQuantity) || 0,
      reorderLevel: Number.parseInt(editForm.reorderLevel) || 0,
      unitPrice: Number.parseFloat(editForm.unitPrice) || 0,
      expiryDate: editForm.expiryDate,
      barcode: editForm.barcode || undefined,
    }
    updateMedication(selectedMedication.id, updated)
    setSelectedMedication({ ...selectedMedication, ...updated })
    setIsEditing(false)
  }

  const handleReceiveStock = () => {
    setScanMessage(null)
    setScanError(null)
    const code = scanCode.trim()
    const qty = Number.parseInt(scanQty || "0", 10)
    if (!code) {
      setScanError("Scan or enter a barcode first.")
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setScanError("Enter a valid quantity received.")
      return
    }
    const med =
      medications.find((m) => m.barcode && m.barcode === code) ||
      medications.find((m) => m.name.toLowerCase() === code.toLowerCase())
    if (!med) {
      setScanError("No medication found for this barcode. Use Add Medication to register it.")
      return
    }
    const newQty = med.stockQuantity + qty
    updateMedication(med.id, { stockQuantity: newQty })
    void (async () => {
      try {
        await fetch("/api/pharmacy/stock-receipts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicationId: med.id,
            quantity: qty,
            batchNumber: med.batchNumber || undefined,
            expiryDate: med.expiryDate || undefined,
            barcode: med.barcode || code,
            reference: "Manual scan receive",
          }),
        })
      } catch {
        // Non-fatal; UI already updated and core stock persisted via updateMedication.
      }
    })()
    setScanSummary({ name: med.name, quantity: qty, newStock: newQty })
    setScanMessage(`Received ${qty} units into ${med.name}. New stock: ${newQty}.`)
    setScanQty("")
  }

  const handleExport = async (format: "xlsx" | "pdf") => {
    try {
      const res = await fetch("/api/pharmacy/inventory-export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = format === "xlsx" ? "pharmacy-inventory.xlsx" : "pharmacy-inventory.pdf"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // ignore; export failure can be handled via toast layer if needed
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Medication Inventory</CardTitle>
              <CardDescription>Manage medication stock levels</CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Medication
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
            <div className="rounded-md border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Scan to receive stock</p>
                <Button
                  size="xs"
                  variant={scanMode ? "default" : "outline"}
                  onClick={() => setScanMode((v) => !v)}
                >
                  {scanMode ? "Scan mode: ON" : "Scan mode: OFF"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[2fr,auto,auto] sm:items-center">
                <div className="relative">
                  <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Scan medication barcode or enter code manually"
                    value={scanCode}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                    onChange={(e) => setScanCode(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={scanQty}
                  onChange={(e) => setScanQty(e.target.value)}
                  className="w-20"
                />
                <Button size="sm" onClick={handleReceiveStock}>
                  Receive
                </Button>
              </div>
              {scanError && <p className="text-xs text-destructive">{scanError}</p>}
              {scanMessage && <p className="text-xs text-emerald-600">{scanMessage}</p>}
            </div>

            <div className="rounded-md border bg-background p-3 space-y-2 text-xs">
              <p className="text-sm font-medium text-foreground">Receiving summary</p>
              {scanSummary ? (
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{scanSummary.name}</p>
                  <p className="text-muted-foreground">
                    Qty added: <span className="font-medium">{scanSummary.quantity}</span>
                  </p>
                  <p className="text-muted-foreground">
                    New stock level: <span className="font-medium">{scanSummary.newStock}</span>
                  </p>
                  <p className="text-muted-foreground">
                    View details in stock history for full audit trail.
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">No recent receipts recorded in this session.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, category, manufacturer, or barcode"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={filterLowStock ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterLowStock(!filterLowStock)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock ({lowStockMeds.length})
              </Button>
              <Button
                variant={stockFilter !== "all" || expiryFilter !== "all" ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-1"
                onClick={() => {
                  setStockFilter("all")
                  setExpiryFilter("all")
                }}
              >
                <Filter className="h-4 w-4" />
                Clear filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
              >
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
              >
                Export PDF
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">Stock:</span>
              <button
                type="button"
                className={stockFilter === "all" ? "font-semibold text-foreground" : ""}
                onClick={() => setStockFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={stockFilter === "healthy" ? "font-semibold text-emerald-600" : ""}
                onClick={() => setStockFilter("healthy")}
              >
                Healthy
              </button>
              <button
                type="button"
                className={stockFilter === "low" ? "font-semibold text-amber-600" : ""}
                onClick={() => setStockFilter("low")}
              >
                Low
              </button>
              <button
                type="button"
                className={stockFilter === "out" ? "font-semibold text-red-600" : ""}
                onClick={() => setStockFilter("out")}
              >
                Out
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Expiry:</span>
              <button
                type="button"
                className={expiryFilter === "all" ? "font-semibold text-foreground" : ""}
                onClick={() => setExpiryFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={expiryFilter === "expiring" ? "font-semibold text-amber-600" : ""}
                onClick={() => setExpiryFilter("expiring")}
              >
                Expiring soon
              </button>
              <button
                type="button"
                className={expiryFilter === "expired" ? "font-semibold text-red-600" : ""}
                onClick={() => setExpiryFilter("expired")}
              >
                Expired
              </button>
              <button
                type="button"
                className={expiryFilter === "none" ? "font-semibold text-muted-foreground" : ""}
                onClick={() => setExpiryFilter("none")}
              >
                No expiry
              </button>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Sort by:</span>
              <select
                className="rounded border bg-background px-2 py-1 text-xs"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="name">Name</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="stock">Stock</option>
                <option value="expiry">Expiry</option>
                <option value="price">Unit price</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="font-medium">Rows:</span>
              <select
                className="rounded border bg-background px-2 py-1 text-xs"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 25)
                  setPage(0)
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {pagedMedications.length === 0 ? (
            <p className="text-center text-muted-foreground">No medications match the current filters</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Medication</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedMedications.map((med, idx) => {
                    const isLowStock = med.stockQuantity <= med.reorderLevel
                    const expiryDate = med.expiryDate ? new Date(med.expiryDate) : null
                    const isExpiringSoon =
                      !!expiryDate &&
                      expiryDate.getTime() - new Date().getTime() < 90 * 24 * 60 * 60 * 1000 &&
                      expiryDate.getTime() > Date.now()
                    const stockClass = classifyStock(med)

                    return (
                      <TableRow
                        key={med.id}
                        className={`cursor-pointer ${idx % 2 === 0 ? "bg-background" : "bg-muted/40"}`}
                        onClick={() => handleOpenDetails(med)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{med.name}</span>
                            {isLowStock && (
                              <Badge variant="destructive">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Low
                              </Badge>
                            )}
                            {isExpiringSoon && <Badge variant="secondary">Expiring soon</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{med.category}</TableCell>
                        <TableCell>{med.manufacturer || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={isLowStock ? "font-medium text-destructive" : "font-medium"}>
                              {med.stockQuantity}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    stockClass === "healthy"
                                      ? "bg-emerald-500"
                                      : stockClass === "low"
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (med.stockQuantity / Math.max(1, med.reorderLevel * 2)) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] uppercase text-muted-foreground">
                                {stockClass === "healthy" ? "OK" : stockClass === "low" ? "LOW" : "OUT"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{med.reorderLevel}</TableCell>
                        <TableCell>
                          {med.expiryDate ? (
                            <span
                              className={
                                expiryDate && expiryDate < new Date()
                                  ? "text-red-600 font-medium"
                                  : isExpiringSoon
                                  ? "text-amber-600"
                                  : undefined
                              }
                            >
                              {med.expiryDate}
                              {expiryDate && expiryDate < new Date() && " (Expired)"}
                              {isExpiringSoon && expiryDate && expiryDate >= new Date() && " (Soon)"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(med.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenDetails(med)
                              }}
                            >
                              <Info className="mr-1 h-4 w-4" />
                              Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                const confirmed = window.confirm(
                                  `Delete "${med.name}" from inventory? This cannot be undone.`,
                                )
                                if (!confirmed) return
                                deleteMedication(med.id)
                              }}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>
                Page {pageClamped + 1} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageClamped === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pageClamped >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddMedicationDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Stock history</h3>
        <Button variant="outline" size="sm" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide history" : "Show recent movements"}
        </Button>
      </div>
      {showHistory && (
        <div className="mt-2">
          <StockMovements />
        </div>
      )}

      <Sheet open={!!selectedMedication} onOpenChange={(open) => !open && closeDetails()}>
        <SheetContent side="right">
          {selectedMedication && (
            <>
              <SheetHeader>
                <SheetTitle>{isEditing ? "Edit medication" : selectedMedication.name}</SheetTitle>
                <SheetDescription>
                  {isEditing ? "Update inventory details for this medication." : "Inventory details and status."}
                </SheetDescription>
              </SheetHeader>
              {isEditing && editForm ? (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Medication name</p>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <Input
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Manufacturer</p>
                    <Input
                      value={editForm.manufacturer}
                      onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Batch number</p>
                    <Input
                      value={editForm.batchNumber}
                      onChange={(e) => setEditForm({ ...editForm, batchNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current stock</p>
                    <Input
                      type="number"
                      value={editForm.stockQuantity}
                      onChange={(e) => setEditForm({ ...editForm, stockQuantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reorder level</p>
                    <Input
                      type="number"
                      value={editForm.reorderLevel}
                      onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unit price</p>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.unitPrice}
                      onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expiry date</p>
                    <Input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Barcode (optional)</p>
                    <Input
                      value={editForm.barcode}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                      placeholder="Scan or enter barcode"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdits}>
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium">{selectedMedication.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{selectedMedication.manufacturer || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Batch number</p>
                    <p className="font-medium">{selectedMedication.batchNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expiry date</p>
                    <p className="font-medium">
                      {selectedMedication.expiryDate || <span className="text-muted-foreground">Not set</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current stock</p>
                    <p className="font-medium">{selectedMedication.stockQuantity} units</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reorder level</p>
                    <p className="font-medium">{selectedMedication.reorderLevel} units</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unit price</p>
                    <p className="font-medium">{formatCurrency(selectedMedication.unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Barcode</p>
                    <p className="font-medium">
                      {selectedMedication.barcode || <span className="text-muted-foreground">—</span>}
                    </p>
                  </div>
                  <div className="sm:col-span-2 flex justify-end pt-2">
                    <Button size="sm" variant="outline" onClick={startEditing}>
                      Edit medication
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4 border-t pt-3">
                <StockMovements medicationId={selectedMedication.id} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
