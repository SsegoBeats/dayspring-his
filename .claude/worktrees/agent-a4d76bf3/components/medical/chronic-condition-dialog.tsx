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
import { Activity, Plus, X } from "lucide-react"

interface ChronicConditionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
}

export function ChronicConditionDialog({ open, onOpenChange, patientId }: ChronicConditionDialogProps) {
  const { addChronicCondition } = useMedical()
  const [formData, setFormData] = useState({
    condition: "",
    diagnosedDate: "",
    status: "active" as "active" | "managed" | "resolved",
    notes: "",
  })
  const [medicationInput, setMedicationInput] = useState("")
  const [medications, setMedications] = useState<string[]>([])

  const addMedication = () => {
    const med = medicationInput.trim()
    if (med && !medications.includes(med)) {
      setMedications([...medications, med])
    }
    setMedicationInput("")
  }

  const removeMedication = (med: string) => {
    setMedications(medications.filter((m) => m !== med))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    addChronicCondition({
      patientId,
      condition: formData.condition,
      diagnosedDate: formData.diagnosedDate,
      status: formData.status,
      medications: medications.length > 0 ? medications : undefined,
      notes: formData.notes,
    })

    setFormData({ condition: "", diagnosedDate: "", status: "active", notes: "" })
    setMedications([])
    setMedicationInput("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Add Chronic Condition
          </DialogTitle>
          <DialogDescription>Record a chronic condition for this patient</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="condition">Condition *</Label>
            <Input
              id="condition"
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              placeholder="e.g., Type 2 Diabetes, Hypertension"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as "active" | "managed" | "resolved" })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="managed">Managed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosedDate">Diagnosed Date</Label>
            <Input
              id="diagnosedDate"
              type="date"
              value={formData.diagnosedDate}
              onChange={(e) => setFormData({ ...formData, diagnosedDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Medications</Label>
            <div className="flex gap-2">
              <Input
                value={medicationInput}
                onChange={(e) => setMedicationInput(e.target.value)}
                placeholder="e.g., Metformin 500mg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addMedication()
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addMedication}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {medications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {medications.map((med) => (
                  <span
                    key={med}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-sm"
                  >
                    {med}
                    <button
                      type="button"
                      onClick={() => removeMedication(med)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
            <Button type="submit">Add Condition</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
