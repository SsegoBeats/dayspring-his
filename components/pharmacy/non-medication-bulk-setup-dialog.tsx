"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { type NonMedicationInventoryItem } from "@/lib/non-medication-inventory-insights"
import {
  getNonMedicationCategoryRules,
  getNonMedicationRequirementLabels,
} from "@/lib/non-medication-inventory-validation"
import {
  AlertTriangle,
  Barcode,
  Download,
  Loader2,
  MapPin,
  Sparkles,
  Upload,
} from "lucide-react"

type BulkSetupDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NonMedicationInventoryItem[]
  onItemsUpdated: (items: NonMedicationInventoryItem[]) => void
}

type BulkSetupRow = {
  id: string
  itemName: string
  itemType: string
  requirementLabels: string[]
  missingLabels: string[]
  location: string
  barcode: string
  manufacturer: string
  modelNumber: string
  serialNumber: string
  reorderLevel: string
  minStockLevel: string
  maxStockLevel: string
  description: string
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim())
}

function needsSetupAttention(item: NonMedicationInventoryItem): boolean {
  const rules = getNonMedicationCategoryRules(item.item_type)
  const threshold = Math.max(Number(item.reorder_level) || 0, Number(item.min_stock_level) || 0)

  if (rules.locationRequired && !hasText(item.location)) return true
  if (rules.assetIdentifierRequired && !hasText(item.barcode) && !hasText(item.model_number) && !hasText(item.serial_number)) return true
  if (rules.stockThresholdRequired && threshold <= 0) return true

  return false
}

function getMissingLabels(item: NonMedicationInventoryItem): string[] {
  const rules = getNonMedicationCategoryRules(item.item_type)
  const threshold = Math.max(Number(item.reorder_level) || 0, Number(item.min_stock_level) || 0)
  const labels: string[] = []

  if (rules.locationRequired && !hasText(item.location)) {
    labels.push("Location")
  }
  if (rules.assetIdentifierRequired && !hasText(item.barcode) && !hasText(item.model_number) && !hasText(item.serial_number)) {
    labels.push("Asset identifier")
  }
  if (rules.stockThresholdRequired && threshold <= 0) {
    labels.push("Par level")
  }

  return labels
}

function itemToBulkRow(item: NonMedicationInventoryItem): BulkSetupRow {
  return {
    id: item.id,
    itemName: item.item_name,
    itemType: item.item_type,
    requirementLabels: getNonMedicationRequirementLabels(item.item_type),
    missingLabels: getMissingLabels(item),
    location: item.location ?? "",
    barcode: item.barcode ?? "",
    manufacturer: item.manufacturer ?? "",
    modelNumber: item.model_number ?? "",
    serialNumber: item.serial_number ?? "",
    reorderLevel: String(item.reorder_level ?? 0),
    minStockLevel: String(item.min_stock_level ?? 0),
    maxStockLevel: item.max_stock_level !== null && item.max_stock_level !== undefined ? String(item.max_stock_level) : "",
    description: item.description ?? "",
  }
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildTemplateCsv(rows: BulkSetupRow[]): string {
  const headers = [
    "id",
    "itemName",
    "itemType",
    "requirements",
    "location",
    "barcode",
    "manufacturer",
    "modelNumber",
    "serialNumber",
    "reorderLevel",
    "minStockLevel",
    "maxStockLevel",
    "description",
  ]

  const lines = rows.map((row) =>
    [
      row.id,
      row.itemName,
      row.itemType,
      row.requirementLabels.join(" | "),
      row.location,
      row.barcode,
      row.manufacturer,
      row.modelNumber,
      row.serialNumber,
      row.reorderLevel,
      row.minStockLevel,
      row.maxStockLevel,
      row.description,
    ]
      .map((value) => csvEscape(value))
      .join(","),
  )

  return [headers.join(","), ...lines].join("\n")
}

export function NonMedicationBulkSetupDialog({
  open,
  onOpenChange,
  items,
  onItemsUpdated,
}: BulkSetupDialogProps) {
  const { toast } = useToast()
  const setupItems = useMemo(() => items.filter(needsSetupAttention).map(itemToBulkRow), [items])
  const [rows, setRows] = useState<BulkSetupRow[]>([])
  const [activeTab, setActiveTab] = useState<"grid" | "csv">("grid")
  const [csvContent, setCsvContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (open) {
      setRows(setupItems)
      setCsvContent(buildTemplateCsv(setupItems))
      setRowErrors({})
      setActiveTab("grid")
    }
  }, [open, setupItems])

  const changedRows = useMemo(() => {
    const originalById = new Map(setupItems.map((row) => [row.id, row]))

    return rows
      .map((row) => {
        const original = originalById.get(row.id)
        if (!original) return null

        const changed = {
          id: row.id,
          location: row.location.trim(),
          barcode: row.barcode.trim(),
          manufacturer: row.manufacturer.trim(),
          modelNumber: row.modelNumber.trim(),
          serialNumber: row.serialNumber.trim(),
          reorderLevel: row.reorderLevel.trim(),
          minStockLevel: row.minStockLevel.trim(),
          maxStockLevel: row.maxStockLevel.trim(),
          description: row.description.trim(),
        }

        const isChanged =
          changed.location !== original.location.trim() ||
          changed.barcode !== original.barcode.trim() ||
          changed.manufacturer !== original.manufacturer.trim() ||
          changed.modelNumber !== original.modelNumber.trim() ||
          changed.serialNumber !== original.serialNumber.trim() ||
          changed.reorderLevel !== original.reorderLevel.trim() ||
          changed.minStockLevel !== original.minStockLevel.trim() ||
          changed.maxStockLevel !== original.maxStockLevel.trim() ||
          changed.description !== original.description.trim()

        return isChanged ? changed : null
      })
      .filter(Boolean)
  }, [rows, setupItems])

  const missingCount = setupItems.length

  const applyGridUpdates = async () => {
    if (changedRows.length === 0) {
      toast({
        title: "No setup changes detected",
        description: "Edit one or more rows before applying the bulk setup console.",
      })
      return
    }

    setSaving(true)
    setRowErrors({})
    try {
      const response = await fetch("/api/pharmacy/non-medication-inventory/bulk-setup", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: changedRows }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (Array.isArray(data.rowErrors)) {
          const nextErrors = Object.fromEntries(data.rowErrors.map((row: { id: string; errors: string[] }) => [row.id, row.errors]))
          setRowErrors(nextErrors)
        }
        throw new Error(data.error || "Failed to apply bulk setup updates.")
      }

      onItemsUpdated(data.items || [])
      toast({
        title: "Bulk setup applied",
        description: `${data.count || 0} inventory records were updated.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Bulk setup failed",
        description: error instanceof Error ? error.message : "Failed to apply bulk setup updates.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const applyCsvImport = async () => {
    if (!csvContent.trim()) {
      toast({
        title: "CSV content required",
        description: "Paste CSV content or load a CSV file before importing.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    setRowErrors({})
    try {
      const response = await fetch("/api/pharmacy/non-medication-inventory/bulk-setup", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (Array.isArray(data.rowErrors)) {
          const nextErrors = Object.fromEntries(data.rowErrors.map((row: { id: string; errors: string[] }) => [row.id, row.errors]))
          setRowErrors(nextErrors)
        }
        throw new Error(data.error || "Failed to import CSV setup data.")
      }

      onItemsUpdated(data.items || [])
      toast({
        title: "CSV setup imported",
        description: `${data.count || 0} inventory records were updated from CSV.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "CSV import failed",
        description: error instanceof Error ? error.message : "Failed to import CSV setup data.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv(setupItems)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "non-medication-inventory-setup-template.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const loadCsvFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCsvContent(await file.text())
    event.target.value = ""
  }

  const categoryCount = new Set(setupItems.map((row) => row.itemType)).size

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),transparent_32%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),transparent_28%),linear-gradient(135deg,_#ffffff_0%,_#f8fbff_52%,_#fffaf2_100%)]">
          <DialogHeader className="border-b border-slate-200/80 px-6 py-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Bulk Setup Console
            </div>
            <DialogTitle className="text-2xl text-slate-950">Close remaining inventory setup gaps in batches</DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-6 text-slate-600">
              This console enforces the new category rules while letting you repair incomplete records in one pass. Use guided row edits or paste a CSV template back in.
            </DialogDescription>

            <div className="grid gap-3 pt-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Records needing setup</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{missingCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Categories affected</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{categoryCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Validation mode</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">Server-enforced</p>
                <p className="mt-1 text-sm text-slate-600">Bulk and single-record edits follow the same rules.</p>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "grid" | "csv")} className="flex flex-col">
            <div className="border-b border-slate-200/70 px-6 py-4">
              <TabsList className="rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="grid" className="rounded-xl">Guided grid</TabsTrigger>
                <TabsTrigger value="csv" className="rounded-xl">CSV import</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="max-h-[62vh]">
              <TabsContent value="grid" className="m-0 space-y-4 p-6">
                {setupItems.length === 0 ? (
                  <Alert className="border-emerald-200 bg-emerald-50/80">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <AlertTitle className="text-emerald-900">No setup gaps remain</AlertTitle>
                    <AlertDescription className="text-emerald-800">
                      All currently loaded inventory records satisfy the category-based setup rules.
                    </AlertDescription>
                  </Alert>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div>
                            <p className="text-lg font-semibold text-slate-950">{row.itemName}</p>
                            <p className="text-sm text-slate-600">{row.itemType}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {row.requirementLabels.map((label) => (
                              <Badge key={label} className="rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
                                {label}
                              </Badge>
                            ))}
                            {row.missingLabels.map((label) => (
                              <Badge key={`${row.id}-${label}`} className="rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                Missing {label}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {rowErrors[row.id] && (
                          <Alert className="max-w-xl border-rose-200 bg-rose-50/80">
                            <AlertTriangle className="h-4 w-4 text-rose-700" />
                            <AlertTitle className="text-rose-900">Row validation failed</AlertTitle>
                            <AlertDescription className="text-rose-800">
                              {rowErrors[row.id].join(" ")}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-location`}>Location</Label>
                          <div className="relative">
                            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              id={`${row.id}-location`}
                              value={row.location}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((entry) => (entry.id === row.id ? { ...entry, location: event.target.value } : entry)),
                                )
                              }
                              className="pl-9"
                              placeholder="Ward, lab, room, shelf"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-barcode`}>Barcode</Label>
                          <div className="relative">
                            <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              id={`${row.id}-barcode`}
                              value={row.barcode}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((entry) => (entry.id === row.id ? { ...entry, barcode: event.target.value } : entry)),
                                )
                              }
                              className="pl-9"
                              placeholder="Scan or type barcode"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-manufacturer`}>Manufacturer</Label>
                          <Input
                            id={`${row.id}-manufacturer`}
                            value={row.manufacturer}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, manufacturer: event.target.value } : entry)),
                              )
                            }
                            placeholder="Vendor or maker"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-modelNumber`}>Model Number</Label>
                          <Input
                            id={`${row.id}-modelNumber`}
                            value={row.modelNumber}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, modelNumber: event.target.value } : entry)),
                              )
                            }
                            placeholder="Equipment model"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-serialNumber`}>Serial Number</Label>
                          <Input
                            id={`${row.id}-serialNumber`}
                            value={row.serialNumber}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, serialNumber: event.target.value } : entry)),
                              )
                            }
                            placeholder="Asset serial"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-reorderLevel`}>Reorder Level</Label>
                          <Input
                            id={`${row.id}-reorderLevel`}
                            type="number"
                            min={0}
                            value={row.reorderLevel}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, reorderLevel: event.target.value } : entry)),
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-minStockLevel`}>Minimum Stock Level</Label>
                          <Input
                            id={`${row.id}-minStockLevel`}
                            type="number"
                            min={0}
                            value={row.minStockLevel}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, minStockLevel: event.target.value } : entry)),
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${row.id}-maxStockLevel`}>Maximum Stock Level</Label>
                          <Input
                            id={`${row.id}-maxStockLevel`}
                            type="number"
                            min={0}
                            value={row.maxStockLevel}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, maxStockLevel: event.target.value } : entry)),
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2 xl:col-span-3">
                          <Label htmlFor={`${row.id}-description`}>Description</Label>
                          <Textarea
                            id={`${row.id}-description`}
                            value={row.description}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((entry) => (entry.id === row.id ? { ...entry, description: event.target.value } : entry)),
                              )
                            }
                            rows={2}
                            placeholder="Optional setup notes or identifying detail"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="csv" className="m-0 space-y-5 p-6">
                <Alert className="border-sky-200 bg-sky-50/80">
                  <Upload className="h-4 w-4 text-sky-700" />
                  <AlertTitle className="text-sky-900">CSV import follows the same validation rules</AlertTitle>
                  <AlertDescription className="text-sky-800">
                    Include the `id` column from the template. Rows that still fail category rules will be rejected with row-level errors.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="inventory-csv-file">Load CSV file</Label>
                    <Input id="inventory-csv-file" type="file" accept=".csv,text/csv" onChange={loadCsvFile} />
                  </div>
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={downloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Download template
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inventory-csv-content">CSV content</Label>
                  <Textarea
                    id="inventory-csv-content"
                    value={csvContent}
                    onChange={(event) => setCsvContent(event.target.value)}
                    rows={18}
                    className="font-mono text-xs"
                    placeholder="Paste the completed CSV template here"
                  />
                </div>

                {Object.keys(rowErrors).length > 0 && (
                  <Alert className="border-rose-200 bg-rose-50/80">
                    <AlertTriangle className="h-4 w-4 text-rose-700" />
                    <AlertTitle className="text-rose-900">Some CSV rows failed validation</AlertTitle>
                    <AlertDescription className="space-y-2 text-rose-800">
                      {Object.entries(rowErrors).map(([id, errors]) => (
                        <p key={id}>
                          <span className="font-medium">{id}:</span> {errors.join(" ")}
                        </p>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="border-t border-slate-200/80 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={saving}>
              Close
            </Button>
            {activeTab === "grid" ? (
              <Button type="button" className="rounded-2xl bg-sky-600 hover:bg-sky-700" onClick={applyGridUpdates} disabled={saving || setupItems.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Apply grid updates
              </Button>
            ) : (
              <Button type="button" className="rounded-2xl bg-sky-600 hover:bg-sky-700" onClick={applyCsvImport} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import CSV
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
