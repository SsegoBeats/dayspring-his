"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useFormatCurrency } from "@/lib/settings-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddMedicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMedicationDialog({ open, onOpenChange }: AddMedicationDialogProps) {
  const { addMedication, medications } = usePharmacy()
  const formatCurrency = useFormatCurrency()
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const [categories, setCategories] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    manufacturer: "",
    stockQuantity: "",
    unitPrice: "",
    costPrice: "",
    expiryDate: "",
    batchNumber: "",
    reorderLevel: "",
    minStockLevel: "",
    maxStockLevel: "",
    barcode: "",
  })

  // Auto-focus barcode input when dialog opens for easy scanning
  useEffect(() => {
    if (open && barcodeInputRef.current) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        barcodeInputRef.current?.focus()
      }, 100)
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    addMedication({
      name: formData.name,
      category: formData.category,
      manufacturer: formData.manufacturer,
      stockQuantity: Number.parseInt(formData.stockQuantity),
      unitPrice: Number.parseFloat(formData.unitPrice),
      costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
      expiryDate: formData.expiryDate,
      batchNumber: formData.batchNumber,
      reorderLevel: Number.parseInt(formData.reorderLevel),
      minStockLevel: formData.minStockLevel ? Number.parseInt(formData.minStockLevel) : undefined,
      maxStockLevel: formData.maxStockLevel ? Number.parseInt(formData.maxStockLevel) : undefined,
      barcode: formData.barcode || undefined,
    })

    // Reset form
    setFormData({
      name: "",
      category: "",
      manufacturer: "",
      stockQuantity: "",
      unitPrice: "",
      costPrice: "",
      expiryDate: "",
      batchNumber: "",
      reorderLevel: "",
      minStockLevel: "",
      maxStockLevel: "",
      barcode: "",
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Medication</DialogTitle>
          <DialogDescription>Enter the details of the new medication to add to inventory</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Medication Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              {categories.length > 0 ? (
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select medication category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Enter category (e.g., Antimalarials, Antibiotics)"
                  required
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number *</Label>
              <Input
                id="batchNumber"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                required
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorderLevel">Reorder Level *</Label>
              <Input
                id="reorderLevel"
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minStockLevel">Minimum Stock Level (optional)</Label>
              <Input
                id="minStockLevel"
                type="number"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                placeholder="Critical threshold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStockLevel">Maximum Stock Level (optional)</Label>
              <Input
                id="maxStockLevel"
                type="number"
                value={formData.maxStockLevel}
                onChange={(e) => setFormData({ ...formData, maxStockLevel: e.target.value })}
                placeholder="Maximum inventory capacity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">
                Unit Price ({formatCurrency(0).replace(/[\d.,\s]/g, "") || "currency"}) *
              </Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPrice">
                Cost Price ({formatCurrency(0).replace(/[\d.,\s]/g, "") || "currency"}) (optional)
              </Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="Purchase cost for profit analysis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="barcode">Barcode (scan from pack, optional)</Label>
              <Input
                ref={barcodeInputRef}
                id="barcode"
                value={formData.barcode}
                onChange={(e) => {
                  const barcode = e.target.value
                  const existing = medications.find((m) => m.barcode && m.barcode === barcode)
                  if (existing) {
                    setFormData((prev) => ({
                      ...prev,
                      barcode,
                      name: prev.name || existing.name,
                      category: prev.category || existing.category,
                      manufacturer: prev.manufacturer || existing.manufacturer,
                      batchNumber: prev.batchNumber,
                    }))
                  } else {
                    setFormData((prev) => ({ ...prev, barcode }))
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent form submission when Enter is pressed in barcode field
                  // Barcode scanners send Enter after the code
                  if (e.key === "Enter" && formData.barcode.trim()) {
                    e.preventDefault()
                    // Auto-fill from existing medication if found
                    const existing = medications.find((m) => m.barcode && m.barcode === formData.barcode.trim())
                    if (existing) {
                      setFormData((prev) => ({
                        ...prev,
                        name: prev.name || existing.name,
                        category: prev.category || existing.category,
                        manufacturer: prev.manufacturer || existing.manufacturer,
                      }))
                    }
                    // Clear barcode field for next scan
                    setFormData((prev) => ({ ...prev, barcode: "" }))
                    setTimeout(() => {
                      barcodeInputRef.current?.focus()
                    }, 50)
                  }
                }}
                placeholder="Focus here and scan the medication barcode"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Medication</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
