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
  symptoms: string
  diagnosis: string
  treatmentPlan: string
  notes: string
}

const EMPTY_FORM: ConsultationFormData = {
  bloodPressure: "", temperature: "", heartRate: "",
  respiratoryRate: "", oxygenSaturation: "",
  symptoms: "", diagnosis: "", treatmentPlan: "", notes: "",
}

export function ConsultationTab({ patient, user, onSaved }: ConsultationTabProps) {
  const { addMedicalRecord } = useMedical()
  const [form, setForm] = useState<ConsultationFormData>(EMPTY_FORM)
  const [showCriticalAlert, setShowCriticalAlert] = useState(false)
  const [criticalAlerts, setCriticalAlerts] = useState<VitalSignsAlert[]>([])

  const set = (field: keyof ConsultationFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const doSave = useCallback(() => {
    if (!form.diagnosis.trim() && !form.symptoms.trim()) {
      toast.error("Enter at least symptoms or diagnosis before saving.")
      return
    }
    addMedicalRecord({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      doctorName: user.name,
      date: new Date().toISOString().split("T")[0],
      diagnosis: form.diagnosis,
      symptoms: form.symptoms,
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
    setForm(EMPTY_FORM)
    setCriticalAlerts([])
    setShowCriticalAlert(false)
    toast.success("Consultation saved successfully!")
    onSaved?.()
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
            <Input id="bp" placeholder="120/80" value={form.bloodPressure}
              onChange={set("bloodPressure")}
              onBlur={(e) => setForm((f) => ({ ...f, bloodPressure: fmtBP(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", amberBorder)}>
            <Label htmlFor="temp">Temperature</Label>
            <Input id="temp" placeholder="36.5" value={form.temperature}
              onChange={set("temperature")}
              onBlur={(e) => setForm((f) => ({ ...f, temperature: fmtTemp(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="hr">Heart Rate</Label>
            <Input id="hr" placeholder="72 bpm" value={form.heartRate}
              onChange={set("heartRate")}
              onBlur={(e) => setForm((f) => ({ ...f, heartRate: fmtBpm(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="rr">Respiratory Rate</Label>
            <Input id="rr" placeholder="16/min" value={form.respiratoryRate}
              onChange={set("respiratoryRate")}
              onBlur={(e) => setForm((f) => ({ ...f, respiratoryRate: fmtRR(e.target.value) }))}
              className={inputCls} />
          </div>
          <div className={cn("space-y-1.5", skyBorder)}>
            <Label htmlFor="spo2">Oxygen Saturation</Label>
            <Input id="spo2" placeholder="98%" value={form.oxygenSaturation}
              onChange={set("oxygenSaturation")}
              onBlur={(e) => setForm((f) => ({ ...f, oxygenSaturation: fmtSpO2(e.target.value) }))}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* Clinical Fields */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-500">Clinical Notes</p>
        {(["symptoms", "diagnosis", "treatmentPlan", "notes"] as const).map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field} className="capitalize">
              {field === "treatmentPlan" ? "Treatment Plan" : field}
            </Label>
            <Textarea
              id={field}
              value={form[field]}
              onChange={set(field)}
              className={cn("min-h-[80px]", inputCls)}
              placeholder={
                field === "symptoms" ? "Chief complaint and symptoms\u2026" :
                field === "diagnosis" ? "Clinical diagnosis\u2026" :
                field === "treatmentPlan" ? "Treatment plan and instructions\u2026" :
                "Additional notes\u2026"
              }
            />
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} className="w-full bg-teal-700 text-white hover:bg-teal-800">
        Save Consultation <span className="ml-2 text-xs opacity-70">(Ctrl+Enter)</span>
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
                    <li key={a.field}>\u26a0 {a.message}</li>
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
