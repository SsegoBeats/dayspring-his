"use client"

import { useState, useEffect, useCallback, type Dispatch, type FormEvent, type SetStateAction, type ReactNode } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useFormatCurrency } from "@/lib/settings-context"
import {
  NON_MEDICATION_CATEGORIES,
  NON_MEDICATION_SUBTYPES,
  type NonMedicationCategory,
} from "@/lib/constants/non-medication-inventory"
import {
  getConfiguredThreshold,
  getInventoryCompleteness,
  getInventoryHealthSignal,
  getInventorySignals,
  getInventorySortScore,
  normalizeInventoryName,
  type InventorySignalTone,
  type NonMedicationInventoryItem,
} from "@/lib/non-medication-inventory-insights"
import {
  AlertTriangle,
  ArrowUpRight,
  Barcode,
  Boxes,
  CheckCircle2,
  Clock3,
  Layers3,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"

type InventoryMovement = {
  id: string
  movement_type: string
  quantity: number
  reference: string | null
  notes: string | null
  created_at: string
  actor_name: string | null
}

type InventoryStockTake = {
  id: string
  recorded_quantity: number
  system_quantity: number
  variance: number
  notes: string | null
  status: "Pending" | "Approved" | "Rejected"
  taken_at: string
  actor_name: string | null
}

type InventoryDuplicateRecord = {
  id: string
  item_name: string
  item_type: string
  item_subtype: string | null
  stock_quantity: number
  unit_of_measure: string
  location: string | null
  updated_at: string
}

type InventoryItemDetailResponse = {
  item: NonMedicationInventoryItem
  duplicates: InventoryDuplicateRecord[]
  movements: InventoryMovement[]
  stockTaking: InventoryStockTake[]
}

type InventoryFormData = {
  itemName: string
  itemType: string
  itemSubtype: string
  description: string
  manufacturer: string
  modelNumber: string
  serialNumber: string
  stockQuantity: string
  unitOfMeasure: string
  unitPrice: string
  costPrice: string
  reorderLevel: string
  minStockLevel: string
  maxStockLevel: string
  location: string
  barcode: string
  expiryDate: string
}

type InventoryFocusFilter = "all" | "setup" | "duplicates" | "stock" | "ready"

const EMPTY_FORM_DATA: InventoryFormData = {
  itemName: "",
  itemType: "",
  itemSubtype: "",
  description: "",
  manufacturer: "",
  modelNumber: "",
  serialNumber: "",
  stockQuantity: "",
  unitOfMeasure: "units",
  unitPrice: "",
  costPrice: "",
  reorderLevel: "",
  minStockLevel: "",
  maxStockLevel: "",
  location: "",
  barcode: "",
  expiryDate: "",
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim())
}

function formatDateTime(value: string | null | undefined, emptyLabel = "Not recorded"): string {
  if (!value) return emptyLabel
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return emptyLabel
  return format(parsed, "MMM d, yyyy 'at' h:mm a")
}

function formatRelativeTime(value: string | null | undefined, emptyLabel = "Not recorded"): string {
  if (!value) return emptyLabel
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return emptyLabel
  return formatDistanceToNow(parsed, { addSuffix: true })
}

function signalClasses(tone: InventorySignalTone): string {
  switch (tone) {
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    default:
      return "border-slate-200 bg-slate-100 text-slate-700"
  }
}

function progressBarClasses(percent: number): string {
  if (percent >= 80) return "bg-emerald-500"
  if (percent >= 50) return "bg-sky-500"
  return "bg-amber-500"
}

function movementDirectionLabel(quantity: number): string {
  if (quantity > 0) return `+${quantity}`
  return `${quantity}`
}

function buildInventoryPayload(formData: InventoryFormData) {
  return {
    itemName: formData.itemName.trim(),
    itemType: formData.itemType,
    itemSubtype: formData.itemSubtype.trim() || undefined,
    description: formData.description.trim() || undefined,
    manufacturer: formData.manufacturer.trim() || undefined,
    modelNumber: formData.modelNumber.trim() || undefined,
    serialNumber: formData.serialNumber.trim() || undefined,
    stockQuantity: formData.stockQuantity === "" ? 0 : Number.parseInt(formData.stockQuantity, 10) || 0,
    unitOfMeasure: formData.unitOfMeasure.trim() || "units",
    unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
    costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
    reorderLevel: formData.reorderLevel ? Number.parseInt(formData.reorderLevel, 10) : undefined,
    minStockLevel: formData.minStockLevel ? Number.parseInt(formData.minStockLevel, 10) : undefined,
    maxStockLevel: formData.maxStockLevel ? Number.parseInt(formData.maxStockLevel, 10) : undefined,
    location: formData.location.trim() || undefined,
    barcode: formData.barcode.trim() || undefined,
    expiryDate: formData.expiryDate || undefined,
  }
}

function itemToFormData(item: NonMedicationInventoryItem): InventoryFormData {
  return {
    itemName: item.item_name ?? "",
    itemType: item.item_type ?? "",
    itemSubtype: item.item_subtype ?? "",
    description: item.description ?? "",
    manufacturer: item.manufacturer ?? "",
    modelNumber: item.model_number ?? "",
    serialNumber: item.serial_number ?? "",
    stockQuantity: String(item.stock_quantity ?? 0),
    unitOfMeasure: item.unit_of_measure ?? "units",
    unitPrice: item.unit_price !== null && item.unit_price !== undefined ? String(item.unit_price) : "",
    costPrice: item.cost_price !== null && item.cost_price !== undefined ? String(item.cost_price) : "",
    reorderLevel: String(item.reorder_level ?? 0),
    minStockLevel: String(item.min_stock_level ?? 0),
    maxStockLevel: item.max_stock_level !== null && item.max_stock_level !== undefined ? String(item.max_stock_level) : "",
    location: item.location ?? "",
    barcode: item.barcode ?? "",
    expiryDate: item.expiry_date ? String(item.expiry_date).slice(0, 10) : "",
  }
}

function InventoryFormFields({
  formData,
  setFormData,
  idPrefix,
}: {
  formData: InventoryFormData
  setFormData: Dispatch<SetStateAction<InventoryFormData>>
  idPrefix: string
}) {
  const subtypeOptions =
    formData.itemType && NON_MEDICATION_CATEGORIES.includes(formData.itemType as NonMedicationCategory)
      ? NON_MEDICATION_SUBTYPES[formData.itemType as NonMedicationCategory]
      : []

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-itemName`}>Item Name *</Label>
        <Input
          id={`${idPrefix}-itemName`}
          value={formData.itemName}
          onChange={(event) => setFormData((current) => ({ ...current, itemName: event.target.value }))}
          placeholder="e.g. Ultrasound machine"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-itemType`}>Category *</Label>
        <Select
          value={formData.itemType}
          onValueChange={(value) => setFormData((current) => ({ ...current, itemType: value, itemSubtype: "" }))}
        >
          <SelectTrigger id={`${idPrefix}-itemType`}>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {NON_MEDICATION_CATEGORIES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-itemSubtype`}>Subtype</Label>
        <Select
          value={formData.itemSubtype || "__none"}
          onValueChange={(value) =>
            setFormData((current) => ({
              ...current,
              itemSubtype: value === "__none" ? "" : value,
              itemName:
                value !== "__none" && (!current.itemName || current.itemName === current.itemSubtype)
                  ? value
                  : current.itemName,
            }))
          }
          disabled={!subtypeOptions.length}
        >
          <SelectTrigger id={`${idPrefix}-itemSubtype`}>
            <SelectValue placeholder={subtypeOptions.length ? "Select subtype" : "Choose a category first"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">No subtype</SelectItem>
            {subtypeOptions.map((subtype) => (
              <SelectItem key={subtype} value={subtype}>
                {subtype}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-location`}>Location</Label>
        <Input
          id={`${idPrefix}-location`}
          value={formData.location}
          onChange={(event) => setFormData((current) => ({ ...current, location: event.target.value }))}
          placeholder="Ward, lab, or store room"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-barcode`}>Barcode</Label>
        <Input
          id={`${idPrefix}-barcode`}
          value={formData.barcode}
          onChange={(event) => setFormData((current) => ({ ...current, barcode: event.target.value }))}
          placeholder="Scan or type barcode"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-manufacturer`}>Manufacturer</Label>
        <Input
          id={`${idPrefix}-manufacturer`}
          value={formData.manufacturer}
          onChange={(event) => setFormData((current) => ({ ...current, manufacturer: event.target.value }))}
          placeholder="Vendor or maker"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-modelNumber`}>Model Number</Label>
        <Input
          id={`${idPrefix}-modelNumber`}
          value={formData.modelNumber}
          onChange={(event) => setFormData((current) => ({ ...current, modelNumber: event.target.value }))}
          placeholder="Optional model number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-serialNumber`}>Serial Number</Label>
        <Input
          id={`${idPrefix}-serialNumber`}
          value={formData.serialNumber}
          onChange={(event) => setFormData((current) => ({ ...current, serialNumber: event.target.value }))}
          placeholder="Optional serial number"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-stockQuantity`}>Stock Quantity *</Label>
        <Input
          id={`${idPrefix}-stockQuantity`}
          type="number"
          min={0}
          value={formData.stockQuantity}
          onChange={(event) => setFormData((current) => ({ ...current, stockQuantity: event.target.value }))}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-unitOfMeasure`}>Unit of Measure</Label>
        <Input
          id={`${idPrefix}-unitOfMeasure`}
          value={formData.unitOfMeasure}
          onChange={(event) => setFormData((current) => ({ ...current, unitOfMeasure: event.target.value }))}
          placeholder="units, boxes, packs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-reorderLevel`}>Reorder Level</Label>
        <Input
          id={`${idPrefix}-reorderLevel`}
          type="number"
          min={0}
          value={formData.reorderLevel}
          onChange={(event) => setFormData((current) => ({ ...current, reorderLevel: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-minStockLevel`}>Minimum Stock Level</Label>
        <Input
          id={`${idPrefix}-minStockLevel`}
          type="number"
          min={0}
          value={formData.minStockLevel}
          onChange={(event) => setFormData((current) => ({ ...current, minStockLevel: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-maxStockLevel`}>Maximum Stock Level</Label>
        <Input
          id={`${idPrefix}-maxStockLevel`}
          type="number"
          min={0}
          value={formData.maxStockLevel}
          onChange={(event) => setFormData((current) => ({ ...current, maxStockLevel: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-unitPrice`}>Unit Price</Label>
        <Input
          id={`${idPrefix}-unitPrice`}
          type="number"
          step="0.01"
          min={0}
          value={formData.unitPrice}
          onChange={(event) => setFormData((current) => ({ ...current, unitPrice: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-costPrice`}>Cost Price</Label>
        <Input
          id={`${idPrefix}-costPrice`}
          type="number"
          step="0.01"
          min={0}
          value={formData.costPrice}
          onChange={(event) => setFormData((current) => ({ ...current, costPrice: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-expiryDate`}>Expiry Date</Label>
        <Input
          id={`${idPrefix}-expiryDate`}
          type="date"
          value={formData.expiryDate}
          onChange={(event) => setFormData((current) => ({ ...current, expiryDate: event.target.value }))}
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={formData.description}
          onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
          placeholder="Capture distinguishing details, purpose, or setup notes"
          rows={4}
        />
      </div>
    </div>
  )
}

export function NonMedicationInventory() {
  const formatCurrency = useFormatCurrency()
  const { toast } = useToast()
  const [items, setItems] = useState<NonMedicationInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [focusFilter, setFocusFilter] = useState<InventoryFocusFilter>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<"overview" | "history" | "edit">("overview")
  const [detailData, setDetailData] = useState<InventoryItemDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [deletingItem, setDeletingItem] = useState(false)
  const [editFormData, setEditFormData] = useState<InventoryFormData>(EMPTY_FORM_DATA)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/pharmacy/non-medication-inventory", { credentials: "include" })
      if (!response.ok) {
        throw new Error("Failed to fetch inventory")
      }
      const data = await response.json()
      setItems(data.items || [])
    } catch {
      toast({
        title: "Error",
        description: "Failed to load non-medication inventory",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadItemDetail = useCallback(async (itemId: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const response = await fetch(`/api/pharmacy/non-medication-inventory/${itemId}`, {
        credentials: "include",
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to fetch inventory item")
      }
      const data = (await response.json()) as InventoryItemDetailResponse
      setDetailData(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch inventory item"
      setDetailError(message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!selectedItemId) {
      setDetailData(null)
      setDetailError(null)
      return
    }

    setDetailData(null)
    void loadItemDetail(selectedItemId)
  }, [selectedItemId, loadItemDetail])

  useEffect(() => {
    if (detailData?.item) {
      setEditFormData(itemToFormData(detailData.item))
    }
  }, [detailData])

  const duplicateCountByName = new Map<string, number>()
  const duplicateItemsByName = new Map<string, NonMedicationInventoryItem[]>()
  for (const item of items) {
    const key = normalizeInventoryName(item.item_name)
    duplicateCountByName.set(key, (duplicateCountByName.get(key) || 0) + 1)
    const group = duplicateItemsByName.get(key) || []
    group.push(item)
    duplicateItemsByName.set(key, group)
  }

  const enrichedItems = [...items]
    .map((item) => {
      const duplicateCount = duplicateCountByName.get(normalizeInventoryName(item.item_name)) || 1
      const completeness = getInventoryCompleteness(item)
      const threshold = getConfiguredThreshold(item)
      const healthSignal = getInventoryHealthSignal(item)
      const signals = getInventorySignals(item, duplicateCount)
      const stockRisk = item.stock_quantity <= 0 || (threshold !== null && item.stock_quantity <= threshold)
      const setupGaps = signals.filter((signal) =>
        ["location", "barcode", "pricing"].includes(signal.id) || signal.label === "Par level missing",
      )

      return {
        ...item,
        completeness,
        duplicateCount,
        threshold,
        healthSignal,
        signals,
        stockRisk,
        setupGapCount: setupGaps.length,
        score: getInventorySortScore(item, duplicateCount),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return left.item_name.localeCompare(right.item_name)
    })

  const duplicateGroups = Array.from(duplicateItemsByName.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      count: group.length,
      label: group[0]?.item_name || "Duplicate record",
      records: group,
    }))
    .sort((left, right) => right.count - left.count)

  const filteredItems = enrichedItems.filter((item) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !query ||
      item.item_name.toLowerCase().includes(query) ||
      item.item_type.toLowerCase().includes(query) ||
      (item.item_subtype || "").toLowerCase().includes(query) ||
      (item.description || "").toLowerCase().includes(query) ||
      (item.barcode || "").toLowerCase().includes(query) ||
      (item.location || "").toLowerCase().includes(query) ||
      (item.manufacturer || "").toLowerCase().includes(query) ||
      (item.model_number || "").toLowerCase().includes(query) ||
      (item.serial_number || "").toLowerCase().includes(query)

    const matchesType = filterType === "all" || item.item_type === filterType

    let matchesFocus = true
    if (focusFilter === "setup") matchesFocus = item.setupGapCount > 0 || item.threshold === null
    if (focusFilter === "duplicates") matchesFocus = item.duplicateCount > 1
    if (focusFilter === "stock") matchesFocus = item.stockRisk
    if (focusFilter === "ready") {
      matchesFocus =
        item.duplicateCount === 1 &&
        item.threshold !== null &&
        hasText(item.location) &&
        hasText(item.barcode) &&
        item.completeness.percent >= 80
    }

    return matchesSearch && matchesType && matchesFocus
  })

  const totalUnits = items.reduce((sum, item) => sum + (Number(item.stock_quantity) || 0), 0)
  const averageCompleteness =
    enrichedItems.length > 0
      ? Math.round(enrichedItems.reduce((sum, item) => sum + item.completeness.percent, 0) / enrichedItems.length)
      : 0
  const mappedLocations = items.filter((item) => hasText(item.location)).length
  const barcodeReady = items.filter((item) => hasText(item.barcode)).length
  const thresholdConfigured = enrichedItems.filter((item) => item.threshold !== null).length
  const setupGapCount = enrichedItems.filter((item) => item.setupGapCount > 0 || item.threshold === null).length
  const stockRiskCount = enrichedItems.filter((item) => item.stockRisk).length
  const priceTracked = items.filter((item) => item.unit_price !== null || item.cost_price !== null).length

  const selectedListItem = selectedItemId ? items.find((item) => item.id === selectedItemId) || null : null
  const activeItem = detailData?.item ?? selectedListItem
  const activeDuplicateCount = activeItem ? duplicateCountByName.get(normalizeInventoryName(activeItem.item_name)) || 1 : 1
  const activeSignals = activeItem ? getInventorySignals(activeItem, activeDuplicateCount) : []
  const activeCompleteness = activeItem ? getInventoryCompleteness(activeItem) : null
  const activeThreshold = activeItem ? getConfiguredThreshold(activeItem) : null

  const openWorkspace = (itemId: string, view: "overview" | "history" | "edit" = "overview") => {
    setSelectedItemId(itemId)
    setDetailView(view)
  }

  const closeWorkspace = (open: boolean) => {
    if (open) return
    setSelectedItemId(null)
    setDetailView("overview")
  }

  const handleUpdateItem = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedItemId) return

    if (!editFormData.itemName.trim() || !editFormData.itemType) {
      toast({
        title: "Validation error",
        description: "Item name and category are required",
        variant: "destructive",
      })
      return
    }

    setSavingItem(true)
    try {
      const response = await fetch(`/api/pharmacy/non-medication-inventory/${selectedItemId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInventoryPayload(editFormData)),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to update inventory item")
      }

      const data = await response.json()
      const updatedItem = data.item as NonMedicationInventoryItem

      setItems((current) => current.map((item) => (item.id === updatedItem.id ? updatedItem : item)))
      setDetailData((current) => (current ? { ...current, item: updatedItem } : current))
      setDetailView("overview")
      toast({
        title: "Inventory updated",
        description: "The item workspace has been refreshed with the latest details.",
      })
      await loadItemDetail(selectedItemId)
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update inventory item",
        variant: "destructive",
      })
    } finally {
      setSavingItem(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!selectedItemId || !activeItem) return
    if (!window.confirm(`Delete "${activeItem.item_name}" from non-medication inventory?`)) {
      return
    }

    setDeletingItem(true)
    try {
      const response = await fetch(`/api/pharmacy/non-medication-inventory/${selectedItemId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to delete inventory item")
      }

      setItems((current) => current.filter((item) => item.id !== selectedItemId))
      setSelectedItemId(null)
      setDetailView("overview")
      setDetailData(null)
      toast({
        title: "Inventory item deleted",
        description: "The record has been removed from non-medication inventory.",
      })
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete inventory item",
        variant: "destructive",
      })
    } finally {
      setDeletingItem(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)]">
          <CardHeader className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),transparent_36%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#fbfdff_50%,_#f5faf6_100%)]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Inventory Control Studio
            </div>
            <CardTitle className="text-2xl text-slate-950">Syncing non-medication inventory</CardTitle>
            <CardDescription className="max-w-2xl text-sm text-slate-600">
              Pulling stock posture, record quality, and duplicate signals into one admin workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-32 rounded-3xl border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(248,250,252,0.95),_rgba(239,246,255,0.75))]"
              />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <Card className="overflow-hidden border-slate-200/80 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.38)]">
          <CardHeader className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),transparent_36%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#fbfdff_50%,_#f5faf6_100%)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Inventory Control Studio
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-2xl text-slate-950">Non-medication inventory, with the weak spots exposed</CardTitle>
                  <CardDescription className="max-w-3xl text-sm leading-6 text-slate-600">
                    Track stock, duplicate records, missing setup metadata, and item readiness in one place. This view is designed to
                    show where inventory is trustworthy and where it still needs cleanup.
                  </CardDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button
                  className="rounded-2xl bg-sky-600 px-5 shadow-[0_20px_45px_-28px_rgba(2,132,199,0.8)] hover:bg-sky-700"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </div>

            <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Records in scope</p>
                  <Boxes className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{items.length}</p>
                <p className="mt-2 text-sm text-slate-600">{totalUnits} units currently represented across the catalog.</p>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Setup coverage</p>
                  <Layers3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{averageCompleteness}%</p>
                <p className="mt-2 text-sm text-slate-600">Average record completeness across location, barcode, par level, and pricing.</p>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Par levels configured</p>
                  <CheckCircle2 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {thresholdConfigured}/{items.length || 0}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Without par levels, stock warnings are incomplete and attention thresholds cannot be trusted.
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">Duplicate families</p>
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{duplicateGroups.length}</p>
                <p className="mt-2 text-sm text-slate-600">Potential duplicates are grouped so you can review them from one workspace.</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {(setupGapCount > 0 || duplicateGroups.length > 0) && (
              <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
                <Alert className="border-amber-200 bg-amber-50/80">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <AlertTitle className="text-amber-900">Inventory setup gaps are hiding real stock posture</AlertTitle>
                  <AlertDescription className="text-amber-800">
                    <p>
                      {thresholdConfigured} of {items.length} records have par levels configured, {mappedLocations} have assigned
                      locations, {barcodeReady} have barcodes, and {priceTracked} have pricing data.
                    </p>
                    <p>Until those fields are set, “healthy stock” should be treated as provisional rather than final.</p>
                  </AlertDescription>
                </Alert>

                {duplicateGroups.length > 0 && (
                  <Alert className="border-rose-200 bg-rose-50/80">
                    <AlertTriangle className="h-4 w-4 text-rose-700" />
                    <AlertTitle className="text-rose-900">Duplicate-looking records found</AlertTitle>
                    <AlertDescription className="text-rose-800">
                      <p>
                        {duplicateGroups[0].label} appears in {duplicateGroups[0].count} records. Review similar records before relying on
                        counts or locations.
                      </p>
                      <Button
                        variant="ghost"
                        className="mt-2 h-auto px-0 text-rose-800 hover:bg-transparent hover:text-rose-900"
                        onClick={() => setFocusFilter("duplicates")}
                      >
                        Focus duplicate families
                        <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92))] p-4 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1.6fr_0.8fr_0.8fr]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search name, barcode, location, manufacturer, serial number, or notes"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 rounded-2xl border-slate-200 pl-10"
                  />
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {NON_MEDICATION_CATEGORIES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={focusFilter} onValueChange={(value) => setFocusFilter(value as InventoryFocusFilter)}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                    <SelectValue placeholder="Inventory focus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All records</SelectItem>
                    <SelectItem value="setup">Setup gaps</SelectItem>
                    <SelectItem value="duplicates">Duplicate families</SelectItem>
                    <SelectItem value="stock">Stock risk</SelectItem>
                    <SelectItem value="ready">Ready records</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {filteredItems.length} record{filteredItems.length === 1 ? "" : "s"} in view
                </Badge>
                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {stockRiskCount} stock-risk flag{stockRiskCount === 1 ? "" : "s"}
                </Badge>
                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {setupGapCount} setup-gap record{setupGapCount === 1 ? "" : "s"}
                </Badge>
                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {mappedLocations}/{items.length || 0} locations mapped
                </Badge>
                <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                  {barcodeReady}/{items.length || 0} barcode-ready
                </Badge>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-14 text-center">
                <p className="text-lg font-semibold text-slate-900">No inventory records match this view</p>
                <p className="mt-2 text-sm text-slate-600">Try a broader search, a different focus filter, or add a new item.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openWorkspace(item.id)}
                    aria-label={`Open workspace for ${item.item_name}`}
                    className="group w-full rounded-[30px] border border-slate-200/80 bg-white p-5 text-left shadow-[0_18px_45px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_30px_65px_-42px_rgba(14,165,233,0.35)]"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                            <Boxes className="h-5 w-5" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-950">{item.item_name}</h3>
                              <Badge className={`rounded-full border ${signalClasses(item.healthSignal.tone)} hover:bg-transparent`}>
                                {item.healthSignal.label}
                              </Badge>
                              {item.duplicateCount > 1 && (
                                <Badge className={`rounded-full border ${signalClasses("danger")} hover:bg-transparent`}>
                                  Duplicate family
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <span>{item.item_type}</span>
                              {item.item_subtype && (
                                <>
                                  <span className="text-slate-300">/</span>
                                  <span>{item.item_subtype}</span>
                                </>
                              )}
                            </div>
                            {item.description && <p className="max-w-3xl text-sm leading-6 text-slate-600">{item.description}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {item.signals.map((signal) => (
                            <Badge
                              key={`${item.id}-${signal.id}`}
                              className={`rounded-full border px-3 py-1 ${signalClasses(signal.tone)} hover:bg-transparent`}
                            >
                              {signal.label}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                        <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.92))] p-4 text-white shadow-lg">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/80">On hand</p>
                          <p className="mt-3 text-3xl font-semibold">{item.stock_quantity}</p>
                          <p className="mt-1 text-sm text-sky-50/80">{item.unit_of_measure}</p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Record completeness</p>
                          <p className="mt-3 text-3xl font-semibold text-slate-950">{item.completeness.percent}%</p>
                          <div className="mt-3 h-2 rounded-full bg-slate-200">
                            <div
                              className={`h-2 rounded-full ${progressBarClasses(item.completeness.percent)}`}
                              style={{ width: `${item.completeness.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Location</p>
                        <p className="mt-2 font-medium text-slate-900">{item.location || "Assign a storage location"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Par level</p>
                        <p className="mt-2 font-medium text-slate-900">
                          {item.threshold !== null ? `${item.threshold} ${item.unit_of_measure}` : "Not configured"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last restocked</p>
                        <p className="mt-2 font-medium text-slate-900">{formatRelativeTime(item.last_restocked_at, "Not captured yet")}</p>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Updated</p>
                          <p className="mt-2 font-medium text-slate-900">{formatRelativeTime(item.updated_at)}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-sky-700">
                          Open workspace
                          <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddNonMedicationItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadItems} />

      <Dialog open={Boolean(selectedItemId)} onOpenChange={closeWorkspace}>
        <DialogContent size="xl" className="max-h-[92vh] overflow-hidden p-0 sm:max-w-5xl">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),transparent_34%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.13),transparent_28%),linear-gradient(135deg,_#ffffff_0%,_#f8fbff_54%,_#f6faf7_100%)]">
            <div className="border-b border-slate-200/80 px-6 py-6">
              <DialogHeader className="gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                  <Sparkles className="h-3.5 w-3.5 text-sky-600" />
                  Inventory workspace
                </div>
                <DialogTitle className="sr-only">Inventory workspace</DialogTitle>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-semibold text-slate-950">{activeItem?.item_name || "Loading inventory item"}</p>
                      <DialogDescription className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                        Review stock posture, duplicate clues, history, and quick-fix edits without losing the rest of the screen.
                      </DialogDescription>
                    </div>
                    {activeItem && (
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`rounded-full border ${signalClasses(getInventoryHealthSignal(activeItem).tone)} hover:bg-transparent`}>
                          {getInventoryHealthSignal(activeItem).label}
                        </Badge>
                        <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                          {activeItem.item_type}
                        </Badge>
                        {activeItem.item_subtype && (
                          <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                            {activeItem.item_subtype}
                          </Badge>
                        )}
                        {activeDuplicateCount > 1 && (
                          <Badge className={`rounded-full border ${signalClasses("danger")} hover:bg-transparent`}>
                            {activeDuplicateCount} similar records
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {activeItem && (
                    <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                      <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(15,118,110,0.92))] px-4 py-3 text-white">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-sky-100/80">On hand</p>
                        <p className="mt-2 text-2xl font-semibold">{activeItem.stock_quantity}</p>
                        <p className="text-sm text-sky-50/80">{activeItem.unit_of_measure}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Par level</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">
                          {activeThreshold !== null ? activeThreshold : "Unset"}
                        </p>
                        <p className="text-sm text-slate-600">{activeThreshold !== null ? activeItem.unit_of_measure : "Needs setup"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Completeness</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{activeCompleteness?.percent ?? 0}%</p>
                        <p className="text-sm text-slate-600">{activeCompleteness?.ready ?? 0} of {activeCompleteness?.total ?? 5} checks ready</p>
                      </div>
                    </div>
                  )}
                </div>
              </DialogHeader>
            </div>
            <Tabs value={detailView} onValueChange={(value) => setDetailView(value as "overview" | "history" | "edit")} className="flex min-h-0 flex-col">
              <div className="border-b border-slate-200/70 px-6 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="w-full justify-start rounded-2xl bg-slate-100 p-1 lg:w-auto">
                    <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-xl">History</TabsTrigger>
                    <TabsTrigger value="edit" className="rounded-xl">Edit record</TabsTrigger>
                  </TabsList>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={() => setDetailView("edit")} disabled={!activeItem}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Quick fix
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                      onClick={handleDeleteItem}
                      disabled={!activeItem || deletingItem}
                    >
                      {deletingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="max-h-[65vh]">
                {detailLoading && !detailData ? (
                  <div className="flex min-h-[320px] items-center justify-center px-6 py-16">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                      Loading inventory workspace...
                    </div>
                  </div>
                ) : detailError && !detailData ? (
                  <div className="p-6">
                    <Alert className="border-rose-200 bg-rose-50/80">
                      <AlertTriangle className="h-4 w-4 text-rose-700" />
                      <AlertTitle className="text-rose-900">Unable to load the item workspace</AlertTitle>
                      <AlertDescription className="text-rose-800">{detailError}</AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <>
                    <TabsContent value="overview" className="m-0 space-y-6 p-6">
                      {activeItem && activeSignals.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {activeSignals.map((signal) => (
                            <div
                              key={signal.id}
                              className={`rounded-2xl border p-4 ${signalClasses(signal.tone)}`}
                            >
                              <p className="text-sm font-semibold">{signal.label}</p>
                              <p className="mt-1 text-sm opacity-90">
                                {signal.id === "duplicate" && "Review similar records before trusting totals or locations."}
                                {signal.id === "location" && "Assign a room, ward, shelf, or store so staff can actually find it."}
                                {signal.id === "barcode" && "Barcode coverage is still missing, so scan-based workflows cannot use this record yet."}
                                {signal.id === "pricing" && "Add pricing to make valuations and replacement planning trustworthy."}
                                {signal.id === "stock" && activeThreshold === null && "Configure a par level so this stock can trigger meaningful alerts."}
                                {signal.id === "stock" && activeThreshold !== null && activeItem.stock_quantity <= 0 && "This item has no available stock on hand."}
                                {signal.id === "stock" && activeThreshold !== null && activeItem.stock_quantity > 0 && activeItem.stock_quantity <= activeThreshold && "Stock is at or below the configured threshold."}
                                {signal.id === "stock" && activeThreshold !== null && activeItem.stock_quantity > activeThreshold && "This item is currently above the configured threshold."}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeItem && (
                        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                          <div className="space-y-6 rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                            <div className="space-y-1">
                              <h3 className="text-lg font-semibold text-slate-950">Record profile</h3>
                              <p className="text-sm text-slate-600">Core identity, stock setup, and traceability fields for this item.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <DetailMetric label="Category" value={activeItem.item_type} />
                              <DetailMetric label="Subtype" value={activeItem.item_subtype || "Not set"} />
                              <DetailMetric label="Location" value={activeItem.location || "Not set"} icon={<MapPin className="h-4 w-4 text-slate-400" />} />
                              <DetailMetric label="Barcode" value={activeItem.barcode || "Not set"} icon={<Barcode className="h-4 w-4 text-slate-400" />} />
                              <DetailMetric label="Manufacturer" value={activeItem.manufacturer || "Not set"} />
                              <DetailMetric label="Model Number" value={activeItem.model_number || "Not set"} />
                              <DetailMetric label="Serial Number" value={activeItem.serial_number || "Not set"} />
                              <DetailMetric
                                label="Stock policy"
                                value={
                                  activeThreshold !== null
                                    ? `Par ${activeThreshold} ${activeItem.unit_of_measure}`
                                    : "No par level configured"
                                }
                              />
                              <DetailMetric label="Last restocked" value={formatDateTime(activeItem.last_restocked_at, "Not captured yet")} />
                              <DetailMetric label="Last updated" value={formatDateTime(activeItem.updated_at)} />
                              <DetailMetric
                                label="Unit price"
                                value={activeItem.unit_price !== null ? formatCurrency(activeItem.unit_price) : "Not set"}
                              />
                              <DetailMetric
                                label="Cost price"
                                value={activeItem.cost_price !== null ? formatCurrency(activeItem.cost_price) : "Not set"}
                              />
                            </div>

                            {activeItem.description && (
                              <>
                                <Separator />
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Description</p>
                                  <p className="mt-2 text-sm leading-6 text-slate-600">{activeItem.description}</p>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="space-y-6">
                            <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-slate-950">Record readiness</h3>
                                <p className="text-sm text-slate-600">How much of this record is operationally usable right now.</p>
                              </div>
                              <div className="mt-4 h-3 rounded-full bg-slate-100">
                                <div
                                  className={`h-3 rounded-full ${progressBarClasses(activeCompleteness?.percent ?? 0)}`}
                                  style={{ width: `${activeCompleteness?.percent ?? 0}%` }}
                                />
                              </div>
                              <p className="mt-3 text-sm font-medium text-slate-900">
                                {activeCompleteness?.ready ?? 0} of {activeCompleteness?.total ?? 5} checks are ready
                              </p>
                              {(activeCompleteness?.missing.length || 0) > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {activeCompleteness?.missing.map((missing) => (
                                    <Badge
                                      key={missing}
                                      className={`rounded-full border px-3 py-1 ${signalClasses("warning")} hover:bg-transparent`}
                                    >
                                      {missing}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold text-slate-950">Similar records</h3>
                                <p className="text-sm text-slate-600">Potential duplicate variants based on a normalized item name match.</p>
                              </div>

                              {detailData?.duplicates.length ? (
                                <div className="mt-4 space-y-3">
                                  {detailData.duplicates.map((duplicate) => (
                                    <div key={duplicate.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                          <p className="font-medium text-slate-950">{duplicate.item_name}</p>
                                          <p className="mt-1 text-sm text-slate-600">
                                            {duplicate.item_type}
                                            {duplicate.item_subtype ? ` / ${duplicate.item_subtype}` : ""}
                                          </p>
                                          <p className="mt-1 text-sm text-slate-600">
                                            {duplicate.stock_quantity} {duplicate.unit_of_measure}
                                            {duplicate.location ? ` • ${duplicate.location}` : " • Location missing"}
                                          </p>
                                        </div>
                                        <Button variant="outline" className="rounded-2xl" onClick={() => openWorkspace(duplicate.id)}>
                                          Open record
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-4 text-sm text-slate-600">No similar records detected for this item name.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="history" className="m-0 space-y-6 p-6">
                      <div className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-slate-950">Recent activity</h3>
                            <p className="text-sm text-slate-600">Receipts, adjustments, and stock edits recorded for this item.</p>
                          </div>

                          {detailData?.movements.length ? (
                            <div className="mt-4 space-y-4">
                              {detailData.movements.map((movement) => (
                                <div key={movement.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-slate-950">{movement.movement_type}</p>
                                      <p className="mt-1 text-sm text-slate-600">
                                        {movement.reference || "No reference provided"}
                                      </p>
                                      {movement.notes && <p className="mt-2 text-sm text-slate-600">{movement.notes}</p>}
                                    </div>
                                    <Badge className="rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white">
                                      {movementDirectionLabel(Number(movement.quantity) || 0)}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span>{formatDateTime(movement.created_at)}</span>
                                    <span>{movement.actor_name?.trim() || "System"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EmptyPanel
                              title="No movement history yet"
                              description="This item has not recorded any receipts, adjustments, or stock edits in the movement log."
                            />
                          )}
                        </div>

                        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-slate-950">Stock-taking checks</h3>
                            <p className="text-sm text-slate-600">Physical count reviews linked to this record.</p>
                          </div>

                          {detailData?.stockTaking.length ? (
                            <div className="mt-4 space-y-4">
                              {detailData.stockTaking.map((stockTake) => (
                                <div key={stockTake.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-slate-950">{stockTake.status} stock check</p>
                                      <p className="mt-1 text-sm text-slate-600">
                                        Recorded {stockTake.recorded_quantity} versus system {stockTake.system_quantity}
                                      </p>
                                      {stockTake.notes && <p className="mt-2 text-sm text-slate-600">{stockTake.notes}</p>}
                                    </div>
                                    <Badge
                                      className={`rounded-full border ${
                                        stockTake.variance === 0 ? signalClasses("success") : signalClasses("warning")
                                      } hover:bg-transparent`}
                                    >
                                      Variance {stockTake.variance > 0 ? "+" : ""}
                                      {stockTake.variance}
                                    </Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    <span>{formatDateTime(stockTake.taken_at)}</span>
                                    <span>{stockTake.actor_name?.trim() || "Unknown staff"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EmptyPanel
                              title="No stock-taking history yet"
                              description="No physical count checks have been logged for this record."
                            />
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="edit" className="m-0 p-6">
                      <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-slate-950">Quick-fix editor</h3>
                          <p className="text-sm text-slate-600">
                            Correct duplicates, assign locations, add barcodes, and configure stock thresholds without leaving the inventory workspace.
                          </p>
                        </div>

                        {detailError && (
                          <Alert className="mt-4 border-rose-200 bg-rose-50/80">
                            <AlertTriangle className="h-4 w-4 text-rose-700" />
                            <AlertTitle className="text-rose-900">Some detail panels could not be refreshed</AlertTitle>
                            <AlertDescription className="text-rose-800">{detailError}</AlertDescription>
                          </Alert>
                        )}

                        <form onSubmit={handleUpdateItem} className="mt-6 space-y-6">
                          <InventoryFormFields formData={editFormData} setFormData={setEditFormData} idPrefix="inventory-edit" />

                          <DialogFooter className="border-t border-slate-100 pt-5">
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setDetailView("overview")}>
                              Cancel
                            </Button>
                            <Button type="submit" className="rounded-2xl bg-sky-600 hover:bg-sky-700" disabled={savingItem}>
                              {savingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                              Save changes
                            </Button>
                          </DialogFooter>
                        </form>
                      </div>
                    </TabsContent>
                  </>
                )}
              </ScrollArea>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DetailMetric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-900">{value}</p>
    </div>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-center">
      <Clock3 className="mx-auto h-5 w-5 text-slate-400" />
      <p className="mt-3 font-medium text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  )
}

function AddNonMedicationItemDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<InventoryFormData>(EMPTY_FORM_DATA)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!formData.itemName.trim() || !formData.itemType) {
      toast({
        title: "Validation error",
        description: "Item name and category are required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/pharmacy/non-medication-inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildInventoryPayload(formData)),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to add item")
      }

      toast({
        title: "Inventory item added",
        description: "The new non-medication item is now available in the control studio.",
      })
      setFormData(EMPTY_FORM_DATA)
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      toast({
        title: "Add item failed",
        description: error instanceof Error ? error.message : "Failed to add item",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) {
          setFormData(EMPTY_FORM_DATA)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto rounded-[28px] border-slate-200">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl text-slate-950">Add non-medication inventory item</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-600">
            Capture the item with enough metadata that staff can locate it, count it correctly, and monitor thresholds later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <InventoryFormFields formData={formData} setFormData={setFormData} idPrefix="inventory-add" />

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-2xl bg-sky-600 hover:bg-sky-700" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
