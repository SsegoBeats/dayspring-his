"use client"

import type React from "react"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"

interface AllergyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
}

export function AllergyDialog({ open, onOpenChange, patientId }: AllergyDialogProps) {
  const { addAllergy } = useMedical()
  const [formData, setFormData] = useState({
    allergen: "",
    reaction: "",
    severity: "",
    diagnosedDate: "",
    notes: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    addAllergy({
      patientId,
      allergen: formData.allergen,
      reaction: formData.reaction,
      severity: formData.severity as any,
      diagnosedDate: formData.diagnosedDate,
      notes: formData.notes,
    })

    // Reset form
    setFormData({ allergen: "", reaction: "", severity: "", diagnosedDate: "", notes: "" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Add Allergy
          </DialogTitle>
          <DialogDescription>Record a new allergy for this patient</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allergen">Allergen *</Label>
            <Input
              id="allergen"
              value={formData.allergen}
              onChange={(e) => setFormData({ ...formData, allergen: e.target.value })}
              placeholder="e.g., Penicillin, Peanuts"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reaction">Reaction *</Label>
            <Input
              id="reaction"
              value={formData.reaction}
              onChange={(e) => setFormData({ ...formData, reaction: e.target.value })}
              placeholder="e.g., Rash, Difficulty breathing"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">Severity *</Label>
            <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
              <SelectTrigger id="severity">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mild">Mild</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosedDate">Diagnosed Date *</Label>
            <Input
              id="diagnosedDate"
              type="date"
              value={formData.diagnosedDate}
              onChange={(e) => setFormData({ ...formData, diagnosedDate: e.target.value })}
              required
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
            <Button type="submit">Add Allergy</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
