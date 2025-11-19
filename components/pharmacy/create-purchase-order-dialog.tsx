"use client"

import type React from "react"

import { useState } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"

interface CreatePurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePurchaseOrderDialog({ open, onOpenChange }: CreatePurchaseOrderDialogProps) {
  const { suppliers, medications, createPurchaseOrder } = usePharmacy()
  const [supplierId, setSupplierId] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<
    {
      medicationId: string
      medicationName: string
      quantity: number
      unitPrice: number
      batchNumber: string
      expiryDate: string
    }[]
  >([])

  const handleAddItem = () => {
    setItems([
      ...items,
      { medicationId: "", medicationName: "", quantity: 0, unitPrice: 0, batchNumber: "", expiryDate: "" },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items]
    if (field === "medicationId") {
      const med = medications.find((m) => m.id === value)
      if (med) {
        newItems[index] = {
          ...newItems[index],
          medicationId: med.id,
          medicationName: med.name,
          unitPrice: med.unitPrice,
        }
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value }
    }
    setItems(newItems)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    createPurchaseOrder({
      supplierId,
      orderDate: new Date().toISOString().split("T")[0],
      expectedDeliveryDate,
      status: "pending",
      items,
      totalAmount,
      notes,
    })
    setSupplierId("")
    setExpectedDeliveryDate("")
    setNotes("")
    setItems([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deliveryDate">Expected Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Order Items</Label>
              <Button type="button" size="sm" onClick={handleAddItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Select
                      value={item.medicationId}
                      onValueChange={(value) => handleItemChange(index, "medicationId", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Medication" />
                      </SelectTrigger>
                      <SelectContent>
                        {medications.map((med) => (
                          <SelectItem key={med.id} value={med.id}>
                            {med.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={item.quantity || ""}
                    onChange={(e) => handleItemChange(index, "quantity", Number.parseInt(e.target.value))}
                    required
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Unit Price"
                    value={item.unitPrice || ""}
                    onChange={(e) => handleItemChange(index, "unitPrice", Number.parseFloat(e.target.value))}
                    required
                  />
                  <Input
                    placeholder="Batch #"
                    value={item.batchNumber}
                    onChange={(e) => handleItemChange(index, "batchNumber", e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      placeholder="Expiry"
                      value={item.expiryDate}
                      onChange={(e) => handleItemChange(index, "expiryDate", e.target.value)}
                    />
                    <Button type="button" size="icon" variant="destructive" onClick={() => handleRemoveItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-between">
            <div className="text-lg font-semibold text-foreground">
              Total: ${items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Order</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
