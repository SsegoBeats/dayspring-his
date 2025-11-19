"use client"

import type React from "react"
import { useState } from "react"
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

interface AddMedicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMedicationDialog({ open, onOpenChange }: AddMedicationDialogProps) {
  const { addMedication, medications } = usePharmacy()
  const formatCurrency = useFormatCurrency()
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    manufacturer: "",
    stockQuantity: "",
    unitPrice: "",
    expiryDate: "",
    batchNumber: "",
    reorderLevel: "",
    barcode: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    addMedication({
      name: formData.name,
      category: formData.category,
      manufacturer: formData.manufacturer,
      stockQuantity: Number.parseInt(formData.stockQuantity),
      unitPrice: Number.parseFloat(formData.unitPrice),
      expiryDate: formData.expiryDate,
      batchNumber: formData.batchNumber,
      reorderLevel: Number.parseInt(formData.reorderLevel),
      barcode: formData.barcode || undefined,
    })

    // Reset form
    setFormData({
      name: "",
      category: "",
      manufacturer: "",
      stockQuantity: "",
      unitPrice: "",
      expiryDate: "",
      batchNumber: "",
      reorderLevel: "",
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
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
              />
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
