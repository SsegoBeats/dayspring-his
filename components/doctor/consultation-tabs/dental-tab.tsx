"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { FdiToothChart, type ToothChartData } from "@/components/dentist/fdi-tooth-chart"
import { buildPatchPayload } from "@/lib/patch-payload"

interface DentalTabProps {
  patient: Patient
  user: User
  /** Called after any add/edit/delete so shell can refresh dental summary for print. */
  onRecordsChange?: (records: DentalRecord[]) => void
}

interface DentalRecord {
  id: string
  diagnosis?: string | null
  procedure_performed?: string | null
  visit_date?: string | null
  notes?: string | null
  tooth_chart?: ToothChartData | null
}

interface DentalFormState {
  diagnosis: string
  procedurePerformed: string
  toothNotes: string
  toothChart: ToothChartData
  visitDate: string
}

const EMPTY_DENTAL: DentalFormState = {
  diagnosis: "", procedurePerformed: "", toothNotes: "", toothChart: {}, visitDate: "",
}

export function DentalTab({ patient, user, onRecordsChange }: DentalTabProps) {
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [form, setForm] = useState<DentalFormState>(EMPTY_DENTAL)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<DentalFormState>(EMPTY_DENTAL)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onRecordsChangeRef = useRef(onRecordsChange)
  useEffect(() => { onRecordsChangeRef.current = onRecordsChange }, [onRecordsChange])

  const loadRecords = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/dental/records?patientId=${encodeURIComponent(pid)}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const recs = Array.isArray(data.records) ? data.records : []
        setRecords(recs)
        onRecordsChangeRef.current?.(recs)
      } else {
        toast.error("Failed to load dental records")
      }
    } catch { toast.error("Failed to load dental records") }
  }, []) // no external deps — stable reference

  useEffect(() => { void loadRecords(patient.id) }, [patient.id, loadRecords])

  const handleSave = async () => {
    if (!form.diagnosis.trim() && !form.procedurePerformed.trim()) {
      toast.error("Enter diagnosis or procedure before saving."); return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        patientId: patient.id,
        diagnosis: form.diagnosis || null,
        procedurePerformed: form.procedurePerformed || null,
        toothNotes: form.toothNotes || null,
        toothChart: Object.keys(form.toothChart).length > 0 ? form.toothChart : null,
      }
      if (form.visitDate) payload.visitDate = form.visitDate
      const res = await fetch("/api/dental/records", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Dental record saved.")
      setForm(EMPTY_DENTAL)
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save dental record")
    } finally { setSaving(false) }
  }

  const openEdit = (r: DentalRecord) => {
    setEditingId(r.id)
    const rawChart: ToothChartData = r.tooth_chart ?? {}
    const toothNotes = typeof rawChart.notes === "string" ? rawChart.notes : (r.notes || "")
    setEditForm({
      diagnosis: r.diagnosis || "",
      procedurePerformed: r.procedure_performed || "",
      toothNotes,
      toothChart: rawChart,
      visitDate: r.visit_date ? String(r.visit_date).slice(0, 16) : "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    setSavingEdit(true)
    try {
      const payload: Record<string, unknown> = {
        diagnosis: editForm.diagnosis || null,
        procedurePerformed: editForm.procedurePerformed || null,
        toothNotes: editForm.toothNotes || null,
        toothChart: Object.keys(editForm.toothChart).length > 0 ? editForm.toothChart : null,
      }
      if (editForm.visitDate) payload.visitDate = editForm.visitDate
      const normalizedPayload = buildPatchPayload(payload)
      const res = await fetch(`/api/dental/records/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update")
      }
      toast.success("Dental record updated.")
      setEditingId(null)
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally { setSavingEdit(false) }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/dental/records/${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete")
      }
      toast.success("Dental record deleted.")
      await loadRecords(patient.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete")
    } finally { setDeletingId(null) }
  }

  const canEdit = user.role === "Dentist" || user.role === "Hospital Admin"

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500">Dental Records</p>

      {/* Existing records */}
      {records.length > 0 && (
        <div className="space-y-3">
          {records.map((r) => {
            const chart = r.tooth_chart ?? {}
            const toothNotes = typeof chart.notes === "string" ? chart.notes : r.notes
            const hasChartData = Object.keys(chart).some((k) => k !== "notes")
            return (
              <div key={r.id} className="rounded-xl border-l-4 border-cyan-400 bg-cyan-50/30 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 text-sm flex-1 min-w-0">
                    {r.visit_date && (
                      <div className="font-semibold text-cyan-700">{String(r.visit_date).slice(0, 10)}</div>
                    )}
                    {hasChartData && (
                      <div className="mb-2">
                        <FdiToothChart value={chart} onChange={() => {}} readOnly />
                      </div>
                    )}
                    {r.diagnosis && (
                      <div className="text-slate-700">
                        <span className="font-medium text-slate-500">Dx:</span> {r.diagnosis}
                      </div>
                    )}
                    {r.procedure_performed && (
                      <div className="text-slate-700">
                        <span className="font-medium text-slate-500">Procedure:</span> {r.procedure_performed}
                      </div>
                    )}
                    {toothNotes && <div className="text-slate-500 italic">{toothNotes}</div>}
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deletingId === r.id}
                        onClick={() => handleDelete(r.id)}
                        className="border-rose-300 text-rose-600 hover:bg-rose-50"
                      >
                        {deletingId === r.id ? "…" : "Delete"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {records.length === 0 && (
        <p className="text-sm text-slate-500">No dental records on file.</p>
      )}

      {/* New record form (Dentist only) */}
      {user.role === "Dentist" && (
        <div className="rounded-xl border border-cyan-100 p-4 space-y-3">
          <p className="text-sm font-medium text-cyan-700">New Dental Record</p>
          <div className="space-y-1">
            <Label htmlFor="dental-visit-date">Visit Date</Label>
            <Input
              id="dental-visit-date"
              type="datetime-local"
              value={form.visitDate}
              onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
              className="focus-visible:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-widest text-cyan-500">
              Tooth Chart
            </Label>
            <FdiToothChart
              value={form.toothChart}
              onChange={(data) => setForm((f) => ({ ...f, toothChart: data }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dental-diagnosis">Dental Diagnosis</Label>
            <Textarea
              id="dental-diagnosis"
              value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Caries, pulpitis, periodontal disease…"
              className="min-h-[60px] focus-visible:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dental-procedure">Procedure Performed</Label>
            <Textarea
              id="dental-procedure"
              value={form.procedurePerformed}
              onChange={(e) => setForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
              placeholder="Extraction, filling, root canal, scaling…"
              className="min-h-[60px] focus-visible:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dental-tooth-notes">Tooth / Chart Notes</Label>
            <Textarea
              id="dental-tooth-notes"
              value={form.toothNotes}
              onChange={(e) => setForm((f) => ({ ...f, toothNotes: e.target.value }))}
              placeholder="Tooth numbers and specific findings…"
              className="focus-visible:ring-cyan-400"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 text-white hover:bg-cyan-700">
            {saving ? "Saving…" : "Save Dental Record"}
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) setEditingId(null) }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Dental Record</DialogTitle>
            <DialogDescription>Update visit date, diagnosis, procedure, and tooth chart.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-dental-visit-date">Visit Date</Label>
              <Input
                id="edit-dental-visit-date"
                type="datetime-local"
                value={editForm.visitDate}
                onChange={(e) => setEditForm((f) => ({ ...f, visitDate: e.target.value }))}
                className="focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-widest text-cyan-500">
                Tooth Chart
              </Label>
              <FdiToothChart
                value={editForm.toothChart}
                onChange={(data) => setEditForm((f) => ({ ...f, toothChart: data }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dental-diagnosis">Dental Diagnosis</Label>
              <Textarea
                id="edit-dental-diagnosis"
                value={editForm.diagnosis}
                onChange={(e) => setEditForm((f) => ({ ...f, diagnosis: e.target.value }))}
                className="focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dental-procedure">Procedure Performed</Label>
              <Textarea
                id="edit-dental-procedure"
                value={editForm.procedurePerformed}
                onChange={(e) => setEditForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
                className="focus-visible:ring-cyan-400"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dental-tooth-notes">Tooth / Chart Notes</Label>
              <Textarea
                id="edit-dental-tooth-notes"
                value={editForm.toothNotes}
                onChange={(e) => setEditForm((f) => ({ ...f, toothNotes: e.target.value }))}
                className="focus-visible:ring-cyan-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="bg-cyan-600 text-white hover:bg-cyan-700">
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
