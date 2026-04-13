"use client"

import type React from "react"

import { useState } from "react"
import { usePharmacy } from "@/lib/pharmacy-context"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface StockAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StockAdjustmentDialog({ open, onOpenChange }: StockAdjustmentDialogProps) {
  const { medications, adjustStock } = usePharmacy()
  const { user } = useAuth()
  const { toast } = useToast()
  const [medicationId, setMedicationId] = useState("")
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "correction">("add")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  const isReduction = adjustmentType === "remove"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const medication = medications.find((m) => m.id === medicationId)
    if (!medication) return

    const qty = Number.parseInt(quantity)
    if (!Number.isFinite(qty) || qty < 0) {
      toast({
        title: "Validation error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      })
      return
    }

    // For reductions, show confirmation dialog first
    if (isReduction) {
      setShowConfirm(true)
      return
    }

    await submitAdjustment()
  }

  const submitAdjustment = async () => {
    const medication = medications.find((m) => m.id === medicationId)
    if (!medication) return
    const qty = Number.parseInt(quantity)
    try {
      const res = await fetch("/api/pharmacy/stock-adjustments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId,
          adjustmentType,
          quantity: qty,
          reason,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast({
          title: "Error",
          description: error.error || "Failed to process adjustment",
          variant: "destructive",
        })
        return
      }

      // Refresh medications from backend
      adjustStock({
        medicationId,
        medicationName: medication.name,
        adjustmentType,
        quantity: qty,
        reason,
        adjustedBy: user?.email || "Unknown",
      })

      toast({
        title: "Stock adjustment recorded",
        description: `Stock adjustment for ${medication.name} has been successfully recorded.`,
        variant: "default",
      })

      setMedicationId("")
      setAdjustmentType("add")
      setQuantity("")
      setReason("")
      onOpenChange(false)
    } catch (err) {
      console.error("Error submitting adjustment:", err)
      toast({
        title: "Error",
        description: "Failed to process adjustment. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
            <DialogDescription>Record an inventory adjustment (add, remove, or correction) with a reason.</DialogDescription>
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

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm Stock Reduction</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to remove <strong>{quantity}</strong> unit(s) from stock. This will reduce the inventory immediately. Are you sure you want to proceed?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirm(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowConfirm(false)
                await submitAdjustment()
              }}
            >
              Confirm Reduction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
