"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { formatPatientNumber } from "@/lib/patients"
import { Activity, FileText, Clock, AlertCircle, Loader2 } from "lucide-react"
import { TriageForm } from "@/components/patient/triage-form"
import { toast } from "sonner"
import { validateVitalSigns, parseBloodPressure, extractNumericValue } from "@/lib/vital-signs-validation"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2, fmtKg, fmtCm } from "@/lib/vital-formatting"

type CareTab = "vitals" | "notes" | "history" | "triage"

type NoteCategory = "assessment" | "medication" | "procedure" | "observation" | "other"

const NOTE_CATEGORIES: { value: NoteCategory; label: string; cls: string; activeCls: string }[] = [
  { value: "assessment", label: "Assessment", cls: "border border-violet-300 text-violet-700 hover:bg-violet-50", activeCls: "bg-violet-100 border border-violet-400 ring-2 ring-violet-300 ring-offset-1 text-violet-700" },
  { value: "medication", label: "Medication", cls: "border border-cyan-300 text-cyan-700 hover:bg-cyan-50", activeCls: "bg-cyan-100 border border-cyan-400 ring-2 ring-cyan-300 ring-offset-1 text-cyan-700" },
  { value: "procedure", label: "Procedure", cls: "border border-amber-300 text-amber-700 hover:bg-amber-50", activeCls: "bg-amber-100 border border-amber-400 ring-2 ring-amber-300 ring-offset-1 text-amber-700" },
  { value: "observation", label: "Observation", cls: "border border-emerald-300 text-emerald-700 hover:bg-emerald-50", activeCls: "bg-emerald-100 border border-emerald-400 ring-2 ring-emerald-300 ring-offset-1 text-emerald-700" },
  { value: "other", label: "Other", cls: "border border-slate-300 text-slate-600 hover:bg-slate-50", activeCls: "bg-slate-100 border border-slate-400 ring-2 ring-slate-300 ring-offset-1 text-slate-700" },
]

const NOTE_BORDER: Record<NoteCategory, string> = {
  assessment: "border-l-4 border-violet-400",
  medication: "border-l-4 border-cyan-400",
  procedure: "border-l-4 border-amber-400",
  observation: "border-l-4 border-emerald-400",
  other: "border-l-4 border-slate-300",
}

interface PatientCareViewProps {
  patientId: string
  onBack: () => void
  initialTab?: CareTab
  onUpdated?: (details: { patientId: string; activeTab: CareTab; category?: string }) => void
}

export function PatientCareView({ patientId, onBack, initialTab = "vitals", onUpdated }: PatientCareViewProps) {
  const { getPatient } = usePatients()
  const { addVitalSigns, addNursingNote, getPatientVitals, getPatientNotes, prefetchPatient, refreshPatient } = useNursing()
  const { user } = useAuth()
  const patient = getPatient(patientId)

  const [activeTab, setActiveTab] = useState<CareTab>(initialTab)
  const [savingVitals, setSavingVitals] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [vitalAlerts, setVitalAlerts] = useState<Array<{ type: "critical" | "warning" | "normal"; message: string; field: string }>>([])

  const storageKey = `nurse-care-tab:${patientId}`
  const vitalHistory = getPatientVitals(patientId)
  const noteHistory = getPatientNotes(patientId)

  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "",
    oxygenSaturation: "", weight: "", height: "", notes: "",
  })

  const [noteForm, setNoteForm] = useState<{ category: NoteCategory; note: string }>({
    category: "observation",
    note: "",
  })

  useEffect(() => {
    if (initialTab) { setActiveTab(initialTab); return }
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null
      if (saved && ["vitals", "notes", "history", "triage"].includes(saved)) setActiveTab(saved as CareTab)
    } catch {}
  }, [initialTab, storageKey])

  useEffect(() => {
    try { if (typeof window !== "undefined") localStorage.setItem(storageKey, activeTab) } catch {}
  }, [activeTab, storageKey])

  useEffect(() => {
    setLoadingHistory(true)
    prefetchPatient(patientId)
      .catch((error) => { console.error("Failed to prefetch patient:", error); toast.error("Failed to load patient history") })
      .finally(() => setLoadingHistory(false))
  }, [patientId, prefetchPatient])

  const patientAge = patient
    ? (() => {
        try {
          if (patient.ageYears) return patient.ageYears
          if (patient.dateOfBirth) {
            const dob = new Date(patient.dateOfBirth)
            const now = new Date()
            return now.getFullYear() - dob.getFullYear() -
              (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate()) ? 1 : 0)
          }
          return null
        } catch { return null }
      })()
    : null

  useEffect(() => {
    if (!patient) return
    const bp = parseBloodPressure(vitalsForm.bloodPressure)
    const temp = extractNumericValue(vitalsForm.temperature)
    const hr = extractNumericValue(vitalsForm.heartRate)
    const rr = extractNumericValue(vitalsForm.respiratoryRate)
    const spo2 = extractNumericValue(vitalsForm.oxygenSaturation)
    if (temp !== null || bp.systolic !== null || hr !== null || rr !== null || spo2 !== null) {
      setVitalAlerts(validateVitalSigns({ temperature: temp, systolicBP: bp.systolic, diastolicBP: bp.diastolic, heartRate: hr, respiratoryRate: rr, oxygenSaturation: spo2 }, patientAge))
      return
    }
    setVitalAlerts([])
  }, [patient, patientAge, vitalsForm])

  const notifyUpdate = useCallback((tab: CareTab, category?: string) => {
    onUpdated?.({ patientId: patient?.id ?? patientId, activeTab: tab, category })
  }, [onUpdated, patient, patientId])

  const commitVitals = useCallback(async () => {
    if (!user || !patient) return
    if (!vitalsForm.bloodPressure || !vitalsForm.temperature || !vitalsForm.heartRate || !vitalsForm.respiratoryRate || !vitalsForm.oxygenSaturation) {
      toast.error("Please fill in all required vital sign fields"); return
    }
    const criticalAlerts = vitalAlerts.filter((a) => a.type === "critical")
    if (criticalAlerts.length > 0) {
      const summary = criticalAlerts.map((a) => `- ${a.message}`).join("\n")
      if (!window.confirm(`Warning: critical vital signs detected.\n\n${summary}\n\nProceed?`)) return
    }
    setSavingVitals(true)
    const now = new Date()
    try {
      await addVitalSigns(
        { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, nurseName: user.name,
          date: now.toISOString().split("T")[0], time: now.toTimeString().slice(0, 5),
          bloodPressure: vitalsForm.bloodPressure, temperature: vitalsForm.temperature,
          heartRate: vitalsForm.heartRate, respiratoryRate: vitalsForm.respiratoryRate,
          oxygenSaturation: vitalsForm.oxygenSaturation, weight: vitalsForm.weight,
          height: vitalsForm.height, notes: vitalsForm.notes },
        () => {
          setVitalsForm({ bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", weight: "", height: "", notes: "" })
          setVitalAlerts([])
          toast.success("Vital signs recorded successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("vitals")
        },
        (error) => { toast.error(error.message || "Failed to record vital signs.") }
      )
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to record vital signs.")
    } finally {
      setSavingVitals(false)
    }
  }, [user, patient, vitalsForm, vitalAlerts, addVitalSigns, refreshPatient, notifyUpdate])

  const commitNote = useCallback(async () => {
    if (!user || !patient || !noteForm.note.trim()) { toast.error("Please enter a nursing note"); return }
    setSavingNote(true)
    const now = new Date()
    try {
      await addNursingNote(
        { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}`, nurseName: user.name,
          date: now.toISOString().split("T")[0], time: now.toTimeString().slice(0, 5),
          category: noteForm.category, note: noteForm.note },
        () => {
          setNoteForm({ category: "observation", note: "" })
          toast.success("Nursing note added successfully")
          refreshPatient(patient.id).catch(() => {})
          notifyUpdate("notes")
        },
        (error) => { toast.error(error.message || "Failed to add nursing note.") }
      )
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to add nursing note.")
    } finally {
      setSavingNote(false)
    }
  }, [user, patient, noteForm, addNursingNote, refreshPatient, notifyUpdate])

  useEffect(() => {
    if (!patient) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (activeTab === "vitals") void commitVitals()
        if (activeTab === "notes") void commitNote()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeTab, patient, commitVitals, commitNote])

  useEffect(() => {
    if (!patient) return
    try {
      const last = vitalHistory[vitalHistory.length - 1]
      if (!last) return
      setVitalsForm((current) => ({
        bloodPressure: current.bloodPressure || last.bloodPressure || "",
        temperature: current.temperature || last.temperature || "",
        heartRate: current.heartRate || last.heartRate || "",
        respiratoryRate: current.respiratoryRate || last.respiratoryRate || "",
        oxygenSaturation: current.oxygenSaturation || last.oxygenSaturation || "",
        weight: current.weight || last.weight || "",
        height: current.height || last.height || "",
        notes: current.notes || "",
      }))
    } catch {}
  }, [patient, patientId, vitalHistory])

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-slate-500">Patient not found</p>
        <Button onClick={onBack} className="mt-4 bg-violet-700 hover:bg-violet-800">Go Back</Button>
      </div>
    )
  }

  const TABS: { value: CareTab; label: string; Icon: typeof Activity }[] = [
    { value: "vitals", label: "Vitals", Icon: Activity },
    { value: "notes", label: "Note", Icon: FileText },
    { value: "history", label: "History", Icon: Clock },
    { value: "triage", label: "Triage", Icon: AlertCircle },
  ]

  return (
    <div className="flex flex-col">
      {/* Sticky patient header */}
      <div className="sticky top-0 z-10 border-b border-violet-100 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-bold text-slate-900">
            {patient.firstName} {patient.lastName}
          </span>
          <span className="font-mono text-sm text-violet-600">
            {formatPatientNumber(patient.patientNumber)}
          </span>
          {patientAge != null && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patientAge} yrs
            </span>
          )}
          {patient.gender && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patient.gender}
            </span>
          )}
          {patient.bloodGroup && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
              {patient.bloodGroup}
            </span>
          )}
          {patient.allergies && patient.allergies.trim().toLowerCase() !== "none" && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
              ⚠ Allergies: {patient.allergies}
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-violet-100 px-6 pt-4">
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === value
                ? "bg-violet-700 text-white"
                : "text-violet-600 hover:bg-violet-50"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* VITALS TAB */}
        {activeTab === "vitals" && (
          <form
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); void commitVitals() }}
            className="space-y-4"
          >
            {vitalAlerts.filter((a) => a.type === "critical").map((a, idx) => (
              <p key={`crit-${idx}`} role="alert" className="text-sm font-medium text-fuchsia-600">
                ⚠ {a.message}
              </p>
            ))}
            {vitalAlerts.filter((a) => a.type === "warning").map((a, idx) => (
              <p key={`warn-${idx}`} role="alert" className="text-sm font-medium text-amber-600">
                ⚡ {a.message}
              </p>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="bloodPressure">Blood Pressure *</Label>
                <Input id="bloodPressure" placeholder="120/80" value={vitalsForm.bloodPressure}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, bloodPressure: fmtBP(c.bloodPressure) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Blood pressure" />
              </div>
              <div className="space-y-1 border-l-4 border-amber-400 pl-3">
                <Label htmlFor="temperature">Temperature *</Label>
                <Input id="temperature" placeholder="37.0 C or 98.6 F" value={vitalsForm.temperature}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, temperature: fmtTemp(c.temperature) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Temperature" />
              </div>
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="heartRate">Heart Rate *</Label>
                <Input id="heartRate" placeholder="72 bpm" value={vitalsForm.heartRate}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, heartRate: fmtBpm(c.heartRate) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Heart rate" />
              </div>
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="respiratoryRate">Respiratory Rate *</Label>
                <Input id="respiratoryRate" placeholder="16/min" value={vitalsForm.respiratoryRate}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, respiratoryRate: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, respiratoryRate: fmtRR(c.respiratoryRate) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Respiratory rate" />
              </div>
              <div className="space-y-1 border-l-4 border-cyan-400 pl-3">
                <Label htmlFor="oxygenSaturation">Oxygen Saturation *</Label>
                <Input id="oxygenSaturation" placeholder="98%" value={vitalsForm.oxygenSaturation}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, oxygenSaturation: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, oxygenSaturation: fmtSpO2(c.oxygenSaturation) }))}
                  className="focus-visible:ring-violet-400" required aria-label="Oxygen saturation" />
              </div>
              <div className="space-y-1 border-l-4 border-violet-400 pl-3">
                <Label htmlFor="weight">Weight</Label>
                <Input id="weight" placeholder="70 kg" value={vitalsForm.weight}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, weight: c.weight ? fmtKg(c.weight) : "" }))}
                  className="focus-visible:ring-violet-400" aria-label="Weight" />
              </div>
              <div className="space-y-1 border-l-4 border-violet-400 pl-3">
                <Label htmlFor="height">Height</Label>
                <Input id="height" placeholder="170 cm" value={vitalsForm.height}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                  onBlur={() => setVitalsForm((c) => ({ ...c, height: c.height ? fmtCm(c.height) : "" }))}
                  className="focus-visible:ring-violet-400" aria-label="Height" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="vitalsNotes">Notes</Label>
                <Textarea id="vitalsNotes" placeholder="Any observations or notes..." rows={3}
                  value={vitalsForm.notes} onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
                  className="focus-visible:ring-violet-400" />
              </div>
            </div>

            <Button type="submit" className="w-full bg-violet-700 hover:bg-violet-800" disabled={savingVitals}>
              {savingVitals ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : <><Activity className="mr-2 h-4 w-4" />Record Vital Signs</>}
            </Button>
            <p className="text-center text-xs text-slate-400">Tip: Press Ctrl+Enter to submit</p>
          </form>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <form
            onSubmit={(e: React.FormEvent) => { e.preventDefault(); void commitNote() }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Category *</Label>
              <div className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.map(({ value, label, cls, activeCls }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setNoteForm((f) => ({ ...f, category: value }))}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      noteForm.category === value ? activeCls : cls
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="note">Nursing Note *</Label>
              <Textarea
                id="note"
                placeholder="Enter detailed nursing note..."
                value={noteForm.note}
                onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })}
                rows={6}
                required
                className="focus-visible:ring-violet-400 min-h-[120px]"
              />
              <p className="text-right text-xs text-slate-400">{noteForm.note.length} chars</p>
            </div>
            <Button
              type="submit"
              className="w-full bg-violet-700 hover:bg-violet-800"
              disabled={savingNote || !noteForm.note.trim()}
            >
              {savingNote ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</> : <><FileText className="mr-2 h-4 w-4" />Add Nursing Note</>}
            </Button>
            <p className="text-center text-xs text-slate-400">Tip: Press Ctrl+Enter to submit</p>
          </form>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              <span className="ml-2 text-slate-500">Loading history...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500">Vitals History</p>
              {vitalHistory.length === 0 ? (
                <p className="text-center text-sm text-slate-400">No vital signs recorded</p>
              ) : (
                vitalHistory.slice().reverse().map((v) => (
                  <div key={v.id} className="rounded-xl border-l-4 border-cyan-400 bg-cyan-50/30 p-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>{v.date} {v.time}</span>
                      <span>By {v.nurseName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {v.bloodPressure && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">BP {fmtBP(String(v.bloodPressure))}</span>}
                      {v.temperature && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtTemp(String(v.temperature))}</span>}
                      {v.heartRate && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtBpm(String(v.heartRate))}</span>}
                      {v.respiratoryRate && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtRR(String(v.respiratoryRate))}</span>}
                      {v.oxygenSaturation && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtSpO2(String(v.oxygenSaturation))}</span>}
                      {v.weight && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtKg(String(v.weight))}</span>}
                      {v.height && <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">{fmtCm(String(v.height))}</span>}
                    </div>
                    {v.notes && <p className="mt-2 text-xs text-slate-600">{v.notes}</p>}
                  </div>
                ))
              )}

              <Separator className="my-4" />

              <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Notes History</p>
              {noteHistory.length === 0 ? (
                <p className="text-center text-sm text-slate-400">No nursing notes</p>
              ) : (
                noteHistory.slice().reverse().map((n) => (
                  <div key={n.id} className={`rounded-xl p-4 ${NOTE_BORDER[n.category as NoteCategory] ?? "border-l-4 border-slate-300"}`}>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span className="font-medium capitalize text-slate-700">{n.category}</span>
                      <span>{n.date} {n.time}</span>
                    </div>
                    <p className="text-sm text-slate-700">{n.note}</p>
                  </div>
                ))
              )}
            </div>
          )
        )}

        {/* TRIAGE TAB */}
        {activeTab === "triage" && (
          <div className="rounded-2xl bg-violet-50 p-4">
            <div className="[&_button[type='submit']]:w-full [&_button[type='submit']]:bg-violet-700 [&_button[type='submit']]:text-white [&_button[type='submit']]:hover:bg-violet-800">
              <TriageForm
                patientId={patientId}
                onSaved={(category) => {
                  refreshPatient(patientId).catch(() => {})
                  notifyUpdate("triage", category)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
