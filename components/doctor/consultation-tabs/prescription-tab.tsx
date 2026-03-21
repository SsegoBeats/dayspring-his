"use client"
import { useState } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PrescriptionTabProps {
  patient: Patient
  user: User
  onSaved?: () => void
}

interface MedicationItem {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

interface PrescriptionFormData {
  visitType: "OPD" | "INPATIENT" | "EMERGENCY"
  medications: MedicationItem[]
}

const EMPTY_MED: MedicationItem = { name: "", dosage: "", frequency: "", duration: "", instructions: "" }

export function PrescriptionTab({ patient, user, onSaved }: PrescriptionTabProps) {
  const { refreshMedicalData } = useMedical()
  const [form, setForm] = useState<PrescriptionFormData>({
    visitType: "OPD",
    medications: [{ ...EMPTY_MED }],
  })
  const [saving, setSaving] = useState(false)

  const addMed = () => setForm((f) => ({ ...f, medications: [...f.medications, { ...EMPTY_MED }] }))
  const removeMed = (i: number) =>
    setForm((f) => ({ ...f, medications: f.medications.filter((_, idx) => idx !== i) }))
  const setMed = (i: number, field: keyof MedicationItem, value: string) =>
    setForm((f) => {
      const meds = [...f.medications]
      meds[i] = { ...meds[i], [field]: value }
      return { ...f, medications: meds }
    })

  const handleSave = async () => {
    const valid = form.medications.filter((m) => m.name && m.dosage)
    if (valid.length === 0) { toast.error("Add at least one medication with name and dosage."); return }
    setSaving(true)
    try {
      const res = await fetch("/api/medical/prescriptions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          visitType: form.visitType,
          medications: valid.map((m) => ({ ...m, quantity: 1 })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      const validations: Array<{ severity?: string; message?: string }> = Array.isArray(data.validations) ? data.validations : []
      const hasCritical = data.hasCritical === true
      if (!res.ok) { toast.error(data.error || "Failed to save prescription"); return }
      if (hasCritical && validations.some((v) => v.severity === "Critical")) {
        toast.error("Prescription saved with critical warnings – please review.", { duration: 8000 })
      } else if (validations.length > 0) {
        toast.warning(`Prescription saved with ${validations.length} warning(s). Review recommended.`, { duration: 6000 })
      } else {
        toast.success("Prescription saved successfully!")
      }
      validations.slice(0, 5).forEach((v) => {
        if (v.severity === "Critical") toast.error(v.message || "Critical validation", { duration: 8000 })
        else if (v.severity === "Warning") toast.warning(v.message || "Warning", { duration: 5000 })
        else toast.info(v.message || "Info", { duration: 4000 })
      })
      if (form.visitType === "OPD") toast.info("Bill sent to cashier for payment collection.", { duration: 4000 })
      await refreshMedicalData()
      setForm({ visitType: "OPD", medications: [{ ...EMPTY_MED }] })
      onSaved?.()
    } catch {
      toast.error("Failed to save prescription")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Visit Type Segmented Selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Visit Type</p>
        <div className="flex overflow-hidden rounded-lg border border-teal-200">
          {(["OPD", "INPATIENT", "EMERGENCY"] as const).map((vt) => (
            <button
              key={vt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, visitType: vt }))}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium transition-colors",
                form.visitType === vt
                  ? "bg-teal-700 text-white"
                  : "border border-teal-300 text-teal-700 hover:bg-teal-50",
              )}
            >
              {vt === "INPATIENT" ? "Inpatient" : vt === "EMERGENCY" ? "Emergency" : "OPD"}
            </button>
          ))}
        </div>
      </div>

      {/* Medication Cards */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Medications</p>
        {form.medications.map((med, i) => (
          <div key={i} className="rounded-xl border-l-4 border-amber-400 bg-amber-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-700">Medication {i + 1}</span>
              {form.medications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMed(i)}
                  className="text-xs text-rose-600 hover:text-rose-800"
                  aria-label="Remove medication"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["name", "dosage", "frequency", "duration"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="capitalize">{field}</Label>
                  <Input
                    value={med[field]}
                    onChange={(e) => setMed(i, field, e.target.value)}
                    placeholder={
                      field === "name" ? "Drug name…" :
                      field === "dosage" ? "e.g. 500mg" :
                      field === "frequency" ? "e.g. TDS" : "e.g. 7 days"
                    }
                    className="focus-visible:ring-amber-400"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Instructions</Label>
              <Textarea
                value={med.instructions}
                onChange={(e) => setMed(i, "instructions", e.target.value)}
                placeholder="Take after meals…"
                className="min-h-[60px] focus-visible:ring-amber-400"
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={addMed}
          className="border-dashed border-amber-400 text-amber-700 hover:bg-amber-50"
        >
          + Add Medication
        </Button>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-amber-600 text-white hover:bg-amber-700"
      >
        {saving ? "Saving…" : "Save Prescription"}
      </Button>
    </div>
  )
}
