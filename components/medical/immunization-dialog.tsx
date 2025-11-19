"use client"

import type React from "react"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Syringe } from "lucide-react"

interface ImmunizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
}

export function ImmunizationDialog({ open, onOpenChange, patientId }: ImmunizationDialogProps) {
  const { addImmunization } = useMedical()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    vaccineName: "",
    dateAdministered: "",
    nextDueDate: "",
    batchNumber: "",
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    addImmunization({
      patientId,
      vaccineName: formData.vaccineName,
      dateAdministered: formData.dateAdministered,
      nextDueDate: formData.nextDueDate || undefined,
      administeredBy: user?.name || "Unknown",
      batchNumber: formData.batchNumber || undefined,
      notes: formData.notes || undefined,
    })

    // Reset form
    setFormData({ vaccineName: "", dateAdministered: "", nextDueDate: "", batchNumber: "", notes: "" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Add Immunization
          </DialogTitle>
          <DialogDescription>Record a new immunization for this patient</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vaccineName">Vaccine Name *</Label>
            <Input
              id="vaccineName"
              value={formData.vaccineName}
              onChange={(e) => setFormData({ ...formData, vaccineName: e.target.value })}
              placeholder="e.g., COVID-19, Hepatitis B"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateAdministered">Date Administered *</Label>
              <Input
                id="dateAdministered"
                type="date"
                value={formData.dateAdministered}
                onChange={(e) => setFormData({ ...formData, dateAdministered: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDueDate">Next Due Date</Label>
              <Input
                id="nextDueDate"
                type="date"
                value={formData.nextDueDate}
                onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batchNumber">Batch Number</Label>
            <Input
              id="batchNumber"
              value={formData.batchNumber}
              onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
              placeholder="Vaccine batch number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional information"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Immunization</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
