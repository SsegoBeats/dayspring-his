"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"

interface Visit {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  visit_date: string
  gravida: number | null
  parity: number | null
  gestational_age_weeks: number | null
  edd: string | null
  fundal_height_cm: number | null
  fetal_heart_rate: number | null
  presentation: string | null
  notes: string | null
  recorded_by: string | null
}

interface FormState {
  patientId: string
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

const EMPTY_FORM: FormState = {
  patientId: "", visitDate: new Date().toISOString().slice(0, 10),
  gravida: "", parity: "", gestationalAgeWeeks: "", edd: "",
  fundalHeightCm: "", fetalHeartRate: "", presentation: "", notes: "",
}

interface PatientOption { id: string; patientNumber: string; firstName: string; lastName: string }

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient name or number…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => { onChange(null); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-rose-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-rose-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => {
            const fn = (p as { firstName?: string; first_name?: string }).firstName || (p as { first_name?: string }).first_name || ""
            const ln = (p as { lastName?: string; last_name?: string }).lastName || (p as { last_name?: string }).last_name || ""
            const pn = (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patient_number?: string }).patient_number || ""
            return (
              <button key={p.id} type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange({ id: p.id, patientNumber: pn, firstName: fn, lastName: ln })
                  setOpen(false); setQuery("")
                }}>
                <span className="font-medium">{fn} {ln}</span>
                <span className="ml-2 text-xs text-slate-400">{pn}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface MidwifeANCVisitsProps { openNewOnMount?: boolean }

export function MidwifeANCVisits({ openNewOnMount = false }: MidwifeANCVisitsProps) {
  const { user } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Visit | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => {
    if (openNewOnMount) { setSheetOpen(true); setEditingVisit(null); setForm(EMPTY_FORM); setSelectedPatient(null) }
  }, [openNewOnMount])

  const loadVisits = useCallback(async () => {
    setLoading(true)
    try {
      const f = encodeURIComponent(new Date(from + "T00:00:00Z").toISOString())
      const t = encodeURIComponent(new Date(to + "T23:59:59Z").toISOString())
      const res = await fetch(`/api/obstetrics/visits?from=${f}&to=${t}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json().catch(() => ({ visits: [] }))
      if (mountedRef.current) setVisits(Array.isArray(data.visits) ? data.visits : [])
    } catch { toast.error("Failed to load ANC visits") }
    finally { if (mountedRef.current) setLoading(false) }
  }, [from, to])

  useEffect(() => { void loadVisits() }, [loadVisits])

  function openNew() { setEditingVisit(null); setForm(EMPTY_FORM); setSelectedPatient(null); setSheetOpen(true) }

  function openEdit(v: Visit) {
    setEditingVisit(v)
    setForm({
      patientId: v.patient_id,
      visitDate: String(v.visit_date).slice(0, 10),
      gravida: v.gravida != null ? String(v.gravida) : "",
      parity: v.parity != null ? String(v.parity) : "",
      gestationalAgeWeeks: v.gestational_age_weeks != null ? String(v.gestational_age_weeks) : "",
      edd: v.edd ? String(v.edd).slice(0, 10) : "",
      fundalHeightCm: v.fundal_height_cm != null ? String(v.fundal_height_cm) : "",
      fetalHeartRate: v.fetal_heart_rate != null ? String(v.fetal_heart_rate) : "",
      presentation: v.presentation ?? "",
      notes: v.notes ?? "",
    })
    setSelectedPatient(null); setSheetOpen(true)
  }

  async function saveVisit() {
    const patientId = editingVisit ? editingVisit.patient_id : selectedPatient?.id ?? ""
    if (!patientId) { toast.error("Please select a patient"); return }
    setSaving(true)
    try {
      const payload = {
        patientId,
        visitDate: form.visitDate ? new Date(form.visitDate + "T00:00:00Z").toISOString() : undefined,
        gravida: form.gravida ? parseInt(form.gravida) : null,
        parity: form.parity ? parseInt(form.parity) : null,
        gestationalAgeWeeks: form.gestationalAgeWeeks ? parseInt(form.gestationalAgeWeeks) : null,
        edd: form.edd || null,
        fundalHeightCm: form.fundalHeightCm ? parseFloat(form.fundalHeightCm) : null,
        fetalHeartRate: form.fetalHeartRate ? parseInt(form.fetalHeartRate) : null,
        presentation: form.presentation || null,
        notes: form.notes || null,
      }
      const res = editingVisit
        ? await fetch(`/api/obstetrics/assessments/${editingVisit.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/obstetrics/assessments", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Save failed"); return }
      toast.success(editingVisit ? "Assessment updated" : "Assessment recorded")
      setSheetOpen(false); void loadVisits()
    } catch { toast.error("Save failed") } finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/obstetrics/assessments/${deleteTarget.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Delete failed"); return }
      setVisits((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      toast.success("Assessment deleted"); setDeleteTarget(null)
    } catch { toast.error("Delete failed") } finally { setDeleting(false) }
  }

  const canEdit = user?.role === "Midwife" || user?.role === "Hospital Admin" || user?.role === "Clinician"

  return (
    <div className="space-y-4 p-1">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><ClipboardList className="h-4 w-4" /></div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">ANC / Obstetric Assessments</CardTitle>
                <CardDescription className="text-xs">View, record, and manage obstetric assessments by date range.</CardDescription>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
                <Plus className="h-4 w-4" /> New Assessment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="anc-filter-from" className="text-xs text-slate-500">From</Label>
              <Input id="anc-filter-from" name="filterFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="anc-filter-to" className="text-xs text-slate-500">To</Label>
              <Input id="anc-filter-to" name="filterTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="border-b border-rose-50 pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Visits ({visits.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading…
            </div>
          ) : visits.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No assessments in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-rose-50/50 text-left text-xs font-medium uppercase tracking-wide text-rose-800">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">G</th>
                    <th className="px-4 py-3">P</th>
                    <th className="px-4 py-3">GA (wks)</th>
                    <th className="px-4 py-3">EDD</th>
                    <th className="px-4 py-3">FH cm</th>
                    <th className="px-4 py-3">FHR</th>
                    <th className="px-4 py-3">Recorded by</th>
                    {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-rose-50/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{String(v.visit_date).slice(0, 10)}</td>
                      <td className="px-4 py-3 font-medium">
                        {v.patient_name}
                        {v.patient_number && <span className="ml-1 text-xs text-slate-400">#{v.patient_number}</span>}
                      </td>
                      <td className="px-4 py-3">{v.gravida ?? "—"}</td>
                      <td className="px-4 py-3">{v.parity ?? "—"}</td>
                      <td className="px-4 py-3">{v.gestational_age_weeks ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{v.edd ? String(v.edd).slice(0, 10) : "—"}</td>
                      <td className="px-4 py-3">{v.fundal_height_cm ?? "—"}</td>
                      <td className="px-4 py-3">{v.fetal_heart_rate ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{v.recorded_by ?? "—"}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">{editingVisit ? "Edit Assessment" : "New ANC Assessment"}</SheetTitle>
            <SheetDescription className="text-xs">Record obstetric findings for this visit.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4">
            {!editingVisit && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Patient *</Label>
                <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
              </div>
            )}
            {editingVisit && (
              <div className="rounded-lg bg-rose-50/50 border border-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{editingVisit.patient_name}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="anc-visit-date" className="text-xs font-medium">Visit Date</Label>
                <Input id="anc-visit-date" name="visitDate" type="date" value={form.visitDate} onChange={(e) => setForm((f) => ({ ...f, visitDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-edd" className="text-xs font-medium">EDD</Label>
                <Input id="anc-edd" name="edd" type="date" value={form.edd} onChange={(e) => setForm((f) => ({ ...f, edd: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-gravida" className="text-xs font-medium">Gravida (G)</Label>
                <Input id="anc-gravida" name="gravida" type="number" min={0} placeholder="e.g. 2" value={form.gravida} onChange={(e) => setForm((f) => ({ ...f, gravida: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-parity" className="text-xs font-medium">Parity (P)</Label>
                <Input id="anc-parity" name="parity" type="number" min={0} placeholder="e.g. 1" value={form.parity} onChange={(e) => setForm((f) => ({ ...f, parity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-gestational-age" className="text-xs font-medium">Gestational Age (wks)</Label>
                <Input id="anc-gestational-age" name="gestationalAgeWeeks" type="number" min={0} max={45} placeholder="e.g. 28" value={form.gestationalAgeWeeks} onChange={(e) => setForm((f) => ({ ...f, gestationalAgeWeeks: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-fundal-height" className="text-xs font-medium">Fundal Height (cm)</Label>
                <Input id="anc-fundal-height" name="fundalHeightCm" type="number" min={0} step="0.5" placeholder="e.g. 28.0" value={form.fundalHeightCm} onChange={(e) => setForm((f) => ({ ...f, fundalHeightCm: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-fetal-hr" className="text-xs font-medium">Fetal Heart Rate</Label>
                <Input id="anc-fetal-hr" name="fetalHeartRate" type="number" min={60} max={200} placeholder="e.g. 140" value={form.fetalHeartRate} onChange={(e) => setForm((f) => ({ ...f, fetalHeartRate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="anc-presentation" className="text-xs font-medium">Presentation</Label>
                <Input id="anc-presentation" name="presentation" placeholder="e.g. Cephalic" value={form.presentation} onChange={(e) => setForm((f) => ({ ...f, presentation: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea rows={3} placeholder="Clinical notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" />
            </div>
            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={saveVisit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : editingVisit ? "Save Changes" : "Record Assessment"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete the assessment for <strong>{deleteTarget?.patient_name}</strong> on {deleteTarget ? String(deleteTarget.visit_date).slice(0, 10) : ""}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
