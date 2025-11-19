"use client"

import type React from "react"

import { useState } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface StockAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockAdjustmentDialog({ open, onOpenChange }: StockAdjustmentDialogProps) {
  const { medications, adjustStock } = usePharmacy()
  const { user } = useAuth()
  const [medicationId, setMedicationId] = useState("")
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "correction">("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const medication = medications.find((m) => m.id === medicationId)
    if (!medication) return

    adjustStock({
      medicationId,
      medicationName: medication.name,
      adjustmentType,
      quantity: Number.parseInt(quantity),
      reason,
      adjustedBy: user?.email || "Unknown",
    })

    setMedicationId("")
    setAdjustmentType("add")
    setQuantity("")
    setReason("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="medication">Medication</Label>
            <Select value={medicationId} onValueChange={setMedicationId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select medication" />
              </SelectTrigger>
              <SelectContent>
                {medications.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {med.name} (Current: {med.stockQuantity} units)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)} required>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Stock</SelectItem>
                <SelectItem value="remove">Remove Stock</SelectItem>
                <SelectItem value="correction">Stock Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={adjustmentType === "correction" ? "New total quantity" : "Quantity to adjust"}
              required
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for adjustment..."
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Adjustment</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
