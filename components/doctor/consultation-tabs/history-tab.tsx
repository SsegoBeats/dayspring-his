"use client"
import { useState, useEffect } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface HistoryTabProps {
  patient: Patient
  user: User
}

interface ObstetricFormState {
  visitDate: string
  gravida: string
  parity: string
  gestationalAgeWeeks: string
  edd: string
  fundalHeightCm: string
  fetalHeartRate: string
  presentation: string
  notes: string
}

// Shape of obstetric assessment rows returned by API
interface ObstetricRecord {
  id: string
  visit_date?: string | null
  gravida?: number | null
  parity?: number | null
  gestational_age_weeks?: number | null
  edd?: string | null
  fundal_height_cm?: number | null
  fetal_heart_rate?: number | null
  presentation?: string | null
  notes?: string | null
}

const EMPTY_OB_FORM: ObstetricFormState = {
  visitDate: "", gravida: "", parity: "", gestationalAgeWeeks: "",
  edd: "", fundalHeightCm: "", fetalHeartRate: "", presentation: "", notes: "",
}

// Fix 2: moved to module scope — static array, no deps on props/state
const obFields: Array<{ key: keyof ObstetricFormState; label: string; type?: string; placeholder?: string }> = [
  { key: "visitDate", label: "Visit Date", type: "date" },
  { key: "gravida", label: "Gravida", placeholder: "e.g. 2" },
  { key: "parity", label: "Parity", placeholder: "e.g. 1" },
  { key: "gestationalAgeWeeks", label: "Gestational Age (weeks)", placeholder: "e.g. 28" },
  { key: "edd", label: "EDD", type: "date" },
  { key: "fundalHeightCm", label: "Fundal Height (cm)", placeholder: "e.g. 28" },
  { key: "fetalHeartRate", label: "Fetal Heart Rate (bpm)", placeholder: "e.g. 140" },
  { key: "presentation", label: "Presentation", placeholder: "Cephalic, Breech…" },
]

function validateObstetricForm(form: ObstetricFormState): string | null {
  const ga = form.gestationalAgeWeeks ? Number(form.gestationalAgeWeeks) : null
  if (ga != null && (ga < 0 || ga > 44)) return "Gestational age should be between 0 and 44 weeks"
  const fhr = form.fetalHeartRate ? Number(form.fetalHeartRate) : null
  if (fhr != null && (fhr < 80 || fhr > 220)) return "Fetal heart rate should be between 80 and 220 bpm"
  if (form.edd) {
    const edd = new Date(form.edd)
    const now = new Date()
    const diff = (edd.getFullYear() - now.getFullYear()) * 12 + (edd.getMonth() - now.getMonth())
    if (diff < -12 || diff > 6) return "EDD should be within 12 months past or 6 months future"
  }
  return null
}

export function HistoryTab({ patient, user: _user }: HistoryTabProps) {
  const { getPatientMedicalRecords } = useMedical()
  const medicalHistory = getPatientMedicalRecords(patient.id)

  const [obstetricHistory, setObstetricHistory] = useState<ObstetricRecord[]>([])
  const [obsForm, setObsForm] = useState<ObstetricFormState>(EMPTY_OB_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ObstetricFormState>(EMPTY_OB_FORM)
  const [savingEdit, setSavingEdit] = useState(false)
  // Fix 1: saving guard for new assessment
  const [savingNew, setSavingNew] = useState(false)

  // Fix 5: DRY refetch helper
  const refreshObstetricHistory = async () => {
    const refetch = await fetch(
      `/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`,
      { credentials: "include" },
    )
    if (refetch.ok) {
      const data = await refetch.json().catch(() => ({}))
      setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
    }
  }

  // Fetch obstetric history on mount
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(
          `/api/obstetrics/assessments?patientId=${encodeURIComponent(patient.id)}`,
          { credentials: "include" },
        )
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setObstetricHistory(Array.isArray(data.assessments) ? data.assessments : [])
        }
      } catch {
        // Fix 3: error toast in fetch catch
        toast.error("Failed to load obstetric history")
        setObstetricHistory([])
      }
    })()
  }, [patient.id])

  const handleSaveObstetric = async () => {
    const err = validateObstetricForm(obsForm)
    if (err) { toast.error(err); return }
    // Fix 1: set saving guard
    setSavingNew(true)
    try {
      const payload: Record<string, unknown> = {
        patientId: patient.id,
        notes: obsForm.notes || null,
        presentation: obsForm.presentation || null,
      }
      if (obsForm.visitDate) payload.visitDate = obsForm.visitDate
      if (obsForm.gravida) payload.gravida = Number(obsForm.gravida)
      if (obsForm.parity) payload.parity = Number(obsForm.parity)
      if (obsForm.gestationalAgeWeeks) payload.gestationalAgeWeeks = Number(obsForm.gestationalAgeWeeks)
      if (obsForm.edd) payload.edd = obsForm.edd
      if (obsForm.fundalHeightCm) payload.fundalHeightCm = Number(obsForm.fundalHeightCm)
      if (obsForm.fetalHeartRate) payload.fetalHeartRate = Number(obsForm.fetalHeartRate)
      const res = await fetch("/api/obstetrics/assessments", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Obstetric assessment saved.")
      setObsForm(EMPTY_OB_FORM)
      // Fix 5: use shared refetch helper
      await refreshObstetricHistory()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save obstetric assessment")
    } finally {
      // Fix 1: clear saving guard
      setSavingNew(false)
    }
  }

  const openEdit = (a: ObstetricRecord) => {
    setEditingId(a.id)
    setEditForm({
      visitDate: a.visit_date ? String(a.visit_date).slice(0, 10) : "",
      gravida: a.gravida != null ? String(a.gravida) : "",
      parity: a.parity != null ? String(a.parity) : "",
      gestationalAgeWeeks: a.gestational_age_weeks != null ? String(a.gestational_age_weeks) : "",
      edd: a.edd ? String(a.edd).slice(0, 10) : "",
      fundalHeightCm: a.fundal_height_cm != null ? String(a.fundal_height_cm) : "",
      fetalHeartRate: a.fetal_heart_rate != null ? String(a.fetal_heart_rate) : "",
      presentation: a.presentation || "",
      notes: a.notes || "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const err = validateObstetricForm(editForm)
    if (err) { toast.error(err); return }
    setSavingEdit(true)
    try {
      const payload: Record<string, unknown> = {
        presentation: editForm.presentation || null,
        notes: editForm.notes || null,
      }
      if (editForm.visitDate) payload.visitDate = editForm.visitDate
      if (editForm.gravida) payload.gravida = Number(editForm.gravida)
      if (editForm.parity) payload.parity = Number(editForm.parity)
      if (editForm.gestationalAgeWeeks) payload.gestationalAgeWeeks = Number(editForm.gestationalAgeWeeks)
      if (editForm.edd) payload.edd = editForm.edd
      if (editForm.fundalHeightCm) payload.fundalHeightCm = Number(editForm.fundalHeightCm)
      if (editForm.fetalHeartRate) payload.fetalHeartRate = Number(editForm.fetalHeartRate)
      const res = await fetch(`/api/obstetrics/assessments/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      toast.success("Obstetric assessment updated.")
      setEditingId(null)
      // Fix 5: use shared refetch helper
      await refreshObstetricHistory()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally { setSavingEdit(false) }
  }

  return (
    <div className="space-y-8">
      {/* Obstetric Assessments Section */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-500">
          Obstetric Assessments
        </p>

        {/* History cards */}
        {obstetricHistory.length > 0 && (
          <div className="mb-4 space-y-3">
            {obstetricHistory.map((a) => (
              <div key={a.id} className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm space-y-0.5">
                    {a.visit_date && <div className="font-medium">{String(a.visit_date).slice(0, 10)}</div>}
                    <div className="text-slate-600">
                      {[
                        a.gravida != null && `G${a.gravida}`,
                        a.parity != null && `P${a.parity}`,
                        a.gestational_age_weeks != null && `GA: ${a.gestational_age_weeks}wks`,
                        a.fetal_heart_rate != null && `FHR: ${a.fetal_heart_rate} bpm`,
                        a.presentation && `Presentation: ${a.presentation}`,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    {a.notes && <div className="text-slate-500 italic">{a.notes}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New assessment form */}
        <div className="rounded-xl border border-emerald-100 p-4 space-y-3">
          <p className="text-sm font-medium text-emerald-700">New Assessment</p>
          {obstetricHistory.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const last = obstetricHistory[0]
                setObsForm({
                  visitDate: last.visit_date ? String(last.visit_date).slice(0, 10) : "",
                  gravida: last.gravida != null ? String(last.gravida) : "",
                  parity: last.parity != null ? String(last.parity) : "",
                  gestationalAgeWeeks: last.gestational_age_weeks != null ? String(last.gestational_age_weeks) : "",
                  edd: last.edd ? String(last.edd).slice(0, 10) : "",
                  fundalHeightCm: last.fundal_height_cm != null ? String(last.fundal_height_cm) : "",
                  fetalHeartRate: last.fetal_heart_rate != null ? String(last.fetal_heart_rate) : "",
                  presentation: last.presentation || "",
                  notes: last.notes || "",
                })
                toast.success("Form filled from last assessment")
              }}
            >
              Copy from last assessment
            </Button>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Fix 4: htmlFor/id on Label+Input pairs */}
            {obFields.map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type || "text"}
                  placeholder={placeholder}
                  value={obsForm[key]}
                  onChange={(e) => setObsForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="focus-visible:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {/* Fix 4: htmlFor/id on Notes Label+Textarea */}
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={obsForm.notes}
              onChange={(e) => setObsForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[60px] focus-visible:ring-emerald-400"
            />
          </div>
          {/* Fix 1: disabled state + loading label */}
          <Button
            onClick={handleSaveObstetric}
            disabled={savingNew}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {savingNew ? "Saving…" : "Save Assessment"}
          </Button>
        </div>
      </div>

      {/* Medical Records History */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-teal-500">
          Recent Medical Records
        </p>
        {medicalHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No medical records yet.</p>
        ) : (
          <div className="space-y-3">
            {[...medicalHistory].reverse().slice(0, 10).map((record) => (
              <div key={record.id} className="rounded-xl border-l-4 border-teal-400 bg-teal-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium text-slate-900">{record.date}</div>
                    <div className="text-slate-700">{record.diagnosis}</div>
                    {record.symptoms && <div className="text-slate-500">Symptoms: {record.symptoms}</div>}
                  </div>
                  <div className="text-xs text-slate-400">{record.doctorName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit obstetric dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Obstetric Assessment</DialogTitle>
            <DialogDescription>Update this obstetric visit record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Fix 4: htmlFor/id on Label+Input pairs in edit dialog */}
            {obFields.map(({ key, label, type, placeholder }) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type={type || "text"}
                  placeholder={placeholder}
                  value={editForm[key]}
                  onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="focus-visible:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {/* Fix 4: htmlFor/id on Notes Label+Textarea in edit dialog */}
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              className="focus-visible:ring-emerald-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
