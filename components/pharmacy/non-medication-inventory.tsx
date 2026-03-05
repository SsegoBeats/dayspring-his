"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Search, Plus, Info, Barcode, Trash2, AlertTriangle } from "lucide-react"
import { useFormatCurrency } from "@/lib/settings-context"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type NonMedicationItem = {
  id: string
  item_name: string
  item_type: string
  description: string | null
  manufacturer: string | null
  model_number: string | null
  serial_number: string | null
  stock_quantity: number
  unit_of_measure: string
  unit_price: number | null
  cost_price: number | null
  reorder_level: number
  min_stock_level: number
  max_stock_level: number | null
  location: string | null
  barcode: string | null
  expiry_date: string | null
  last_restocked_at: string | null
  created_at: string
  updated_at: string
}

const ITEM_TYPES = [
  "Medical Equipment",
  "Personal Protective Gear",
  "Patient Care Items",
  "Diagnostic Equipment",
  "Surgical & Procedure Equipment",
  "Consumables and Supplies",
]

export function NonMedicationInventory() {
  const formatCurrency = useFormatCurrency()
  const { toast } = useToast()
  const [items, setItems] = useState<NonMedicationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedItem, setSelectedItem] = useState<NonMedicationItem | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pharmacy/non-medication-inventory", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load non-medication inventory",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = filterType === "all" || item.item_type === filterType
    return matchesSearch && matchesType
  })

  const lowStockItems = filteredItems.filter(
    (item) => item.stock_quantity <= item.reorder_level && item.stock_quantity > 0,
  )
  const outOfStockItems = filteredItems.filter((item) => item.stock_quantity <= 0)

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle>Non-Medication Inventory</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Non-Medication Inventory</CardTitle>
              <CardDescription>Manage medical equipment, PPE, supplies, and other non-medication items</CardDescription>
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name, type, description, or barcode"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ITEM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="font-medium">Total Items:</span>
              <span>{filteredItems.length}</span>
            </div>
            {lowStockItems.length > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span className="font-medium text-amber-600">Low Stock: {lowStockItems.length}</span>
              </div>
            )}
            {outOfStockItems.length > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <span className="font-medium text-red-600">Out of Stock: {outOfStockItems.length}</span>
              </div>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-center text-muted-foreground">No items match the current filters</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isLowStock = item.stock_quantity <= item.reorder_level && item.stock_quantity > 0
                    const isOutOfStock = item.stock_quantity <= 0
                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer ${isOutOfStock ? "bg-red-50/50" : isLowStock ? "bg-amber-50/50" : ""}`}
                        onClick={() => {
                          setSelectedItem(item)
                          setIsEditing(false)
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.item_name}</span>
                            {isOutOfStock && (
                              <Badge variant="destructive">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Out
                              </Badge>
                            )}
                            {isLowStock && (
                              <Badge variant="secondary">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Low
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.item_type}</TableCell>
                        <TableCell>{item.location || "—"}</TableCell>
                        <TableCell className="text-right">
                          <span className={isOutOfStock ? "font-medium text-red-600" : isLowStock ? "font-medium text-amber-600" : ""}>
                            {item.stock_quantity} {item.unit_of_measure}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{item.reorder_level}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItem(item)
                                setIsEditing(false)
                              }}
                            >
                              <Info className="mr-1 h-4 w-4" />
                              Details
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
        </CardContent>
      </Card>
      </div>

      <AddNonMedicationItemDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={loadItems} />

      <Sheet open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <SheetContent side="right">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedItem.item_name}</SheetTitle>
                <SheetDescription>Non-medication inventory item details</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Item Type</p>
                  <p className="font-medium">{selectedItem.item_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedItem.location || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Model Number</p>
                  <p className="font-medium">{selectedItem.model_number || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Serial Number</p>
                  <p className="font-medium">{selectedItem.serial_number || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Barcode</p>
                  <p className="font-medium">{selectedItem.barcode || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Stock</p>
                  <p className="font-medium">
                    {selectedItem.stock_quantity} {selectedItem.unit_of_measure}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reorder Level</p>
                  <p className="font-medium">{selectedItem.reorder_level}</p>
                </div>
                {selectedItem.unit_price && (
                  <div>
                    <p className="text-muted-foreground">Unit Price</p>
                    <p className="font-medium">{formatCurrency(selectedItem.unit_price)}</p>
                  </div>
                )}
                {selectedItem.expiry_date && (
                  <div>
                    <p className="text-muted-foreground">Expiry Date</p>
                    <p className="font-medium">{selectedItem.expiry_date}</p>
                  </div>
                )}
                {selectedItem.description && (
                  <div className="sm:col-span-2">
                    <p className="text-muted-foreground">Description</p>
                    <p className="font-medium">{selectedItem.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
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
  const [formData, setFormData] = useState({
    itemName: "",
    itemType: "",
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
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.itemName || !formData.itemType) {
      toast({
        title: "Validation error",
        description: "Item name and type are required",
        variant: "destructive",
      })
      return
    }

    try {
      const res = await fetch("/api/pharmacy/non-medication-inventory", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: formData.itemName,
          itemType: formData.itemType,
          description: formData.description || undefined,
          manufacturer: null,
          modelNumber: formData.modelNumber || undefined,
          serialNumber: formData.serialNumber || undefined,
          stockQuantity: Number.parseInt(formData.stockQuantity) || 0,
          unitOfMeasure: formData.unitOfMeasure,
          unitPrice: formData.unitPrice ? Number.parseFloat(formData.unitPrice) : undefined,
          costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
          reorderLevel: Number.parseInt(formData.reorderLevel) || 0,
          minStockLevel: formData.minStockLevel ? Number.parseInt(formData.minStockLevel) : undefined,
          maxStockLevel: formData.maxStockLevel ? Number.parseInt(formData.maxStockLevel) : undefined,
          location: formData.location || undefined,
          barcode: formData.barcode || undefined,
          expiryDate: formData.expiryDate || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast({
          title: "Error",
          description: error.error || "Failed to add item",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Non-medication item added successfully",
      })
      setFormData({
        itemName: "",
        itemType: "",
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
      })
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error("Error adding non-medication item:", err)
      toast({
        title: "Error",
        description: "Failed to add non-medication item",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Non-Medication Inventory Item</DialogTitle>
          <DialogDescription>Add medical equipment, PPE, supplies, or other non-medication items to inventory</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="itemName">Item Name *</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemType">Item Type *</Label>
              <Select value={formData.itemType} onValueChange={(value) => setFormData({ ...formData, itemType: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Storage Room A, Ward 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelNumber">Model Number</Label>
              <Input
                id="modelNumber"
                value={formData.modelNumber}
                onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockQuantity">Stock Quantity *</Label>
              <Input
                id="stockQuantity"
                type="number"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                required
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
              <Input
                id="unitOfMeasure"
                value={formData.unitOfMeasure}
                onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                placeholder="e.g., units, boxes, packs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderLevel">Reorder Level</Label>
              <Input
                id="reorderLevel"
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockLevel">Minimum Stock Level</Label>
              <Input
                id="minStockLevel"
                type="number"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="Scan or enter barcode"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details about this item"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Item</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
