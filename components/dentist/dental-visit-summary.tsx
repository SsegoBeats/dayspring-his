"use client"
import { useState } from "react"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { FdiToothChart, type ToothChartData } from "@/components/dentist/fdi-tooth-chart"

export interface DentalRecord {
  id: string
  patient_id: string
  visit_date: string | null
  diagnosis: string | null
  procedure_performed: string | null
  tooth_chart: ToothChartData | null
  notes: string | null
  patient_number?: string | null
  first_name?: string | null
  last_name?: string | null
}

interface DentalVisitSummaryProps {
  record: DentalRecord
  canEdit: boolean
  onUpdated: (updated: DentalRecord) => void
  onDeleted: (id: string) => void
}

export function DentalVisitSummary({ record, canEdit, onUpdated, onDeleted }: DentalVisitSummaryProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const rawChart = record.tooth_chart ?? {}
  const toothNotes = typeof rawChart.notes === "string" ? rawChart.notes : (record.notes ?? "")

  const [form, setForm] = useState({
    diagnosis: record.diagnosis ?? "",
    procedurePerformed: record.procedure_performed ?? "",
    toothNotes,
    toothChart: rawChart as ToothChartData,
    visitDate: record.visit_date ? String(record.visit_date).slice(0, 16) : "",
  })

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/dental/records/${record.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis: form.diagnosis || null,
          procedurePerformed: form.procedurePerformed || null,
          toothNotes: form.toothNotes || null,
          toothChart: Object.keys(form.toothChart).filter(k => k !== "notes").length > 0
            ? form.toothChart : null,
          visitDate: form.visitDate ? new Date(form.visitDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Update failed")
      }
      const data = await res.json()
      toast.success("Record updated")
      setEditing(false)
      onUpdated(data.record)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/dental/records/${record.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || "Delete failed")
      }
      toast.success("Record deleted")
      onDeleted(record.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm" variant="outline"
            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {editing ? "Cancel" : "Edit"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete dental record?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the dental record from{" "}
                  {record.visit_date ? String(record.visit_date).slice(0, 10) : "this visit"}.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-rose-600 hover:bg-rose-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Tooth chart */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-2">Tooth Chart</p>
        <FdiToothChart
          value={editing ? form.toothChart : (record.tooth_chart ?? {})}
          onChange={(data) => setForm((f) => ({ ...f, toothChart: data }))}
          readOnly={!editing}
        />
      </div>

      {/* Fields */}
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Visit Date</Label>
            <Input type="datetime-local" value={form.visitDate}
              onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Diagnosis</Label>
            <Textarea value={form.diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Procedure Performed</Label>
            <Textarea value={form.procedurePerformed}
              onChange={(e) => setForm((f) => ({ ...f, procedurePerformed: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="space-y-1">
            <Label>Tooth / Chart Notes</Label>
            <Textarea value={form.toothNotes}
              onChange={(e) => setForm((f) => ({ ...f, toothNotes: e.target.value }))}
              className="focus-visible:ring-cyan-400" />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-700 text-white">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {record.visit_date && (
            <p><span className="font-medium text-slate-600">Date:</span>{" "}
              <span className="text-slate-800">{String(record.visit_date).slice(0, 10)}</span>
            </p>
          )}
          {record.diagnosis && (
            <p><span className="font-medium text-slate-600">Diagnosis:</span>{" "}
              <span className="text-slate-800">{record.diagnosis}</span>
            </p>
          )}
          {record.procedure_performed && (
            <p><span className="font-medium text-slate-600">Procedure:</span>{" "}
              <span className="text-slate-800">{record.procedure_performed}</span>
            </p>
          )}
          {toothNotes && (
            <p><span className="font-medium text-slate-600">Notes:</span>{" "}
              <span className="text-slate-600 italic">{toothNotes}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
