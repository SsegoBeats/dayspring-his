"use client"
import { useState, useCallback } from "react"
import { useMedical } from "@/lib/medical-context"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2, numFloat, numInt } from "@/lib/vital-formatting"
import { validateVitalSigns } from "@/lib/vital-signs-validation"
import type { VitalSignsAlert } from "@/lib/vital-signs-validation"
import { toast } from "sonner"

interface ConsultationTabProps {
  patient: Patient
  user: User
  onSaved?: () => void
}

interface ConsultationFormData {
  bloodPressure: string
  temperature: string
  heartRate: string
  respiratoryRate: string
  oxygenSaturation: string
  complaints: string
  history: string
  impression: string
  treatmentPlan: string
  diagnosis: string
  notes: string
}

const EMPTY_FORM: ConsultationFormData = {
  bloodPressure: "", temperature: "", heartRate: "",
  respiratoryRate: "", oxygenSaturation: "",
  complaints: "", history: "", impression: "",
  treatmentPlan: "", diagnosis: "", notes: "",
}

export function ConsultationTab({ patient, user, onSaved }: ConsultationTabProps) {
  const { addMedicalRecord } = useMedical()
  const [form, setForm] = useState<ConsultationFormData>(EMPTY_FORM)
  const [showCriticalAlert, setShowCriticalAlert] = useState(false)
  const [criticalAlerts, setCriticalAlerts] = useState<VitalSignsAlert[]>([])
  const [saving, setSaving] = useState(false)

  const set = (field: keyof ConsultationFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const doSave = useCallback(async () => {
    if (!form.complaints.trim() && !form.impression.trim() && !form.diagnosis.trim()) {
      toast.error("Enter at least Complaints, Impression, or Diagnosis before saving.")
      return
    }
    setSaving(true)
    const ok = await addMedicalRecord({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorName: user.name,
      date: new Date().toISOString().split("T")[0],
      diagnosis: form.diagnosis,
      symptoms: form.complaints,
      history: form.history,
      impression: form.impression,
      treatment: form.treatmentPlan,
      notes: form.notes,
      vitalSigns: {
        bloodPressure: form.bloodPressure,
        temperature: form.temperature,
        heartRate: form.heartRate,
        respiratoryRate: form.respiratoryRate,
        oxygenSaturation: form.oxygenSaturation,
      },
    })
    setSaving(false)
    setShowCriticalAlert(false)
    setCriticalAlerts([])
    if (ok) {
      setForm(EMPTY_FORM)
      toast.success("Consultation saved.")
      onSaved?.()
    } else {
      toast.error("Failed to save consultation. Please try again.")
    }
  }, [form, patient, user, addMedicalRecord, onSaved])

  const handleSubmit = useCallback(() => {
    const parts = form.bloodPressure.split("/")
    const vitalNumbers = {
      systolicBP: numFloat(parts[0] ?? "") ?? null,
      diastolicBP: numFloat(parts[1] ?? "") ?? null,
      temperature: numFloat(form.temperature),
      heartRate: numInt(form.heartRate),
      respiratoryRate: numInt(form.respiratoryRate),
      oxygenSaturation: numInt(form.oxygenSaturation),
    }
    const ageYears = patient.ageYears ?? null
    const alerts = validateVitalSigns(vitalNumbers, ageYears)
    const criticals = alerts.filter((a) => a.type === "critical")
    if (criticals.length > 0) {
      setCriticalAlerts(criticals)
      setShowCriticalAlert(true)
      return
    }
    doSave()
  }, [form, patient, doSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleSubmit() }
    },
    [handleSubmit],
  )

  const inputCls = "focus-visible:ring-teal-400"
  const skyBorder = "border-l-4 border-sky-400 pl-3"
  const amberBorder = "border-l-4 border-amber-400 pl-3"

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* Vital Signs */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-500">Vital Signs</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="bp">Blood Pressure</Label>
            <Input id="bp" name="bp" autoComplete="off" placeholder="120/80" value={form.bloodPressure}
              onChange={set("bloodPressure")}
              onBlur={(e) => setForm((f) => ({ ...f, bloodPressure: fmtBP(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", amberBorder)}>
            <Label htmlFor="temp">Temperature</Label>
            <Input id="temp" name="temp" autoComplete="off" placeholder="36.5" value={form.temperature}
              onChange={set("temperature")}
              onBlur={(e) => setForm((f) => ({ ...f, temperature: fmtTemp(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="hr">Heart Rate</Label>
            <Input id="hr" name="hr" autoComplete="off" placeholder="72 bpm" value={form.heartRate}
              onChange={set("heartRate")}
              onBlur={(e) => setForm((f) => ({ ...f, heartRate: fmtBpm(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="rr">Respiratory Rate</Label>
            <Input id="rr" name="rr" autoComplete="off" placeholder="16/min" value={form.respiratoryRate}
              onChange={set("respiratoryRate")}
              onBlur={(e) => setForm((f) => ({ ...f, respiratoryRate: fmtRR(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="spo2">Oxygen Saturation</Label>
            <Input id="spo2" name="spo2" autoComplete="off" placeholder="98%" value={form.oxygenSaturation}
              onChange={set("oxygenSaturation")}
              onBlur={(e) => setForm((f) => ({ ...f, oxygenSaturation: fmtSpO2(e.target.value) }))}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* Clinical Notes */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-500">Clinical Notes</p>

        <div className="space-y-1.5">
          <Label htmlFor="complaints">Complaints</Label>
          <Textarea id="complaints" name="complaints" autoComplete="off"
            value={form.complaints} onChange={set("complaints")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Chief complaint and presenting symptoms…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="history">Patient History</Label>
          <Textarea id="history" name="history" autoComplete="off"
            value={form.history} onChange={set("history")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Relevant past medical, surgical, and family history…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="impression">Impression / Clinical Suspicion</Label>
          <Textarea id="impression" name="impression" autoComplete="off"
            value={form.impression} onChange={set("impression")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Preliminary clinical impression or suspected diagnosis…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatmentPlan">Treatment Plan</Label>
          <Textarea id="treatmentPlan" name="treatmentPlan" autoComplete="off"
            value={form.treatmentPlan} onChange={set("treatmentPlan")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Treatment plan and instructions…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="diagnosis">Diagnosis</Label>
          <Textarea id="diagnosis" name="diagnosis" autoComplete="off"
            value={form.diagnosis} onChange={set("diagnosis")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Final clinical diagnosis…" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" autoComplete="off"
            value={form.notes} onChange={set("notes")}
            className={cn("min-h-[80px]", inputCls)}
            placeholder="Additional notes…" />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full bg-teal-700 text-white hover:bg-teal-800">
        {saving ? "Saving…" : <>Save Consultation <span className="ml-2 text-xs opacity-70">(Ctrl+Enter)</span></>}
      </Button>

      {/* Critical Vitals AlertDialog */}
      <AlertDialog open={showCriticalAlert} onOpenChange={setShowCriticalAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-rose-700">Critical Vital Signs Detected</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                One or more vital signs are outside safe ranges. Proceed with saving?
                <ul className="mt-2 space-y-1 text-rose-600">
                  {criticalAlerts.map((a) => (
                    <li key={a.field}>&#9888; {a.message}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review vitals</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 text-white hover:bg-rose-700" onClick={doSave}>
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
