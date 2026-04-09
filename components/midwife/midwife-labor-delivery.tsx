"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, Baby, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"

interface LaborRecord {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  admission_date: string
  onset_of_labor: string | null
  delivery_date: string | null
  delivery_type: string | null
  duration_of_labor_hours: number | null
  presentation: string | null
  blood_loss_ml: number | null
  complications: string | null
  notes: string | null
  baby_sex: string | null
  baby_birth_weight_g: number | null
  baby_apgar_1min: number | null
  baby_apgar_5min: number | null
  baby_condition: string | null
  baby_notes: string | null
  midwife_name: string | null
}

interface PostnatalVisit {
  id: string
  visit_date: string
  days_postpartum: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  lochia: string | null
  breastfeeding_status: string | null
  baby_weight_g: number | null
}

interface PatientOption { id: string; patientNumber: string; firstName: string; lastName: string }

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []
  return (
    <div className="relative">
      <Input placeholder="Search patient…"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => { onChange(null); setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-rose-400" />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-rose-100 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => {
            const fn = (p as { firstName?: string; first_name?: string }).firstName || (p as { first_name?: string }).first_name || ""
            const ln = (p as { lastName?: string; last_name?: string }).lastName || (p as { last_name?: string }).last_name || ""
            const pn = (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patient_number?: string }).patient_number || ""
            return (
              <button key={p.id} type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50"
                onMouseDown={(e) => { e.preventDefault(); onChange({ id: p.id, patientNumber: pn, firstName: fn, lastName: ln }); setOpen(false); setQuery("") }}>
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

type LaborFormState = {
  admissionDate: string; onsetOfLabor: string; deliveryDate: string; deliveryType: string
  durationOfLaborHours: string; presentation: string; bloodLossMl: string
  complications: string; notes: string; babySex: string; babyBirthWeightG: string
  babyApgar1min: string; babyApgar5min: string; babyCondition: string; babyNotes: string
}

const EMPTY_LABOR: LaborFormState = {
  admissionDate: new Date().toISOString().slice(0, 16), onsetOfLabor: "", deliveryDate: "",
  deliveryType: "", durationOfLaborHours: "", presentation: "", bloodLossMl: "",
  complications: "", notes: "", babySex: "", babyBirthWeightG: "", babyApgar1min: "",
  babyApgar5min: "", babyCondition: "", babyNotes: "",
}

interface MidwifeLaborDeliveryProps { openNewOnMount?: boolean }

export function MidwifeLaborDelivery({ openNewOnMount = false }: MidwifeLaborDeliveryProps) {
  const { user } = useAuth()
  const [records, setRecords] = useState<LaborRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [postnatalMap, setPostnatalMap] = useState<Record<string, PostnatalVisit[]>>({})
  const [loadingPostnatal, setLoadingPostnatal] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<LaborRecord | null>(null)
  const [form, setForm] = useState<LaborFormState>(EMPTY_LABOR)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LaborRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  useEffect(() => { if (openNewOnMount) { setEditingRecord(null); setForm(EMPTY_LABOR); setSelectedPatient(null); setSheetOpen(true) } }, [openNewOnMount])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/labor", { credentials: "include" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json().catch(() => ({ records: [] }))
      if (mountedRef.current) setRecords(Array.isArray(data.records) ? data.records : [])
    } catch { toast.error("Failed to load labor records") }
    finally { if (mountedRef.current) setLoading(false) }
  }, [])

  useEffect(() => { void loadRecords() }, [loadRecords])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!postnatalMap[id]) {
      setLoadingPostnatal(id)
      try {
        const res = await fetch(`/api/postnatal?laborId=${id}`, { credentials: "include" })
        const data = await res.json().catch(() => ({ visits: [] }))
        setPostnatalMap((prev) => ({ ...prev, [id]: Array.isArray(data.visits) ? data.visits : [] }))
      } catch { setPostnatalMap((prev) => ({ ...prev, [id]: [] })) }
      finally { setLoadingPostnatal(null) }
    }
  }

  function openNew() { setEditingRecord(null); setForm(EMPTY_LABOR); setSelectedPatient(null); setSheetOpen(true) }

  function openEdit(r: LaborRecord) {
    setEditingRecord(r)
    setForm({
      admissionDate: String(r.admission_date).slice(0, 16),
      onsetOfLabor: r.onset_of_labor ?? "", deliveryDate: r.delivery_date ? String(r.delivery_date).slice(0, 16) : "",
      deliveryType: r.delivery_type ?? "", durationOfLaborHours: r.duration_of_labor_hours != null ? String(r.duration_of_labor_hours) : "",
      presentation: r.presentation ?? "", bloodLossMl: r.blood_loss_ml != null ? String(r.blood_loss_ml) : "",
      complications: r.complications ?? "", notes: r.notes ?? "",
      babySex: r.baby_sex ?? "", babyBirthWeightG: r.baby_birth_weight_g != null ? String(r.baby_birth_weight_g) : "",
      babyApgar1min: r.baby_apgar_1min != null ? String(r.baby_apgar_1min) : "",
      babyApgar5min: r.baby_apgar_5min != null ? String(r.baby_apgar_5min) : "",
      babyCondition: r.baby_condition ?? "", babyNotes: r.baby_notes ?? "",
    })
    setSelectedPatient(null); setSheetOpen(true)
  }

  async function saveRecord() {
    const patientId = editingRecord ? editingRecord.patient_id : selectedPatient?.id ?? ""
    if (!patientId) { toast.error("Please select a patient"); return }
    setSaving(true)
    try {
      const payload = {
        patientId, admissionDate: form.admissionDate || new Date().toISOString(),
        onsetOfLabor: form.onsetOfLabor || null, deliveryDate: form.deliveryDate || null,
        deliveryType: form.deliveryType || null,
        durationOfLaborHours: form.durationOfLaborHours ? parseFloat(form.durationOfLaborHours) : null,
        presentation: form.presentation || null, bloodLossMl: form.bloodLossMl ? parseInt(form.bloodLossMl) : null,
        complications: form.complications || null, notes: form.notes || null,
        babySex: form.babySex || null, babyBirthWeightG: form.babyBirthWeightG ? parseInt(form.babyBirthWeightG) : null,
        babyApgar1min: form.babyApgar1min ? parseInt(form.babyApgar1min) : null,
        babyApgar5min: form.babyApgar5min ? parseInt(form.babyApgar5min) : null,
        babyCondition: form.babyCondition || null, babyNotes: form.babyNotes || null,
      }
      const res = editingRecord
        ? await fetch(`/api/labor/${editingRecord.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/labor", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Save failed"); return }
      toast.success(editingRecord ? "Record updated" : "Delivery recorded")
      setSheetOpen(false); void loadRecords()
    } catch { toast.error("Save failed") } finally { setSaving(false) }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/labor/${deleteTarget.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) { const d = await res.json().catch(() => ({})); toast.error(d.error || "Delete failed"); return }
      setRecords((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success("Record deleted"); setDeleteTarget(null)
    } catch { toast.error("Delete failed") } finally { setDeleting(false) }
  }

  const canEdit = user?.role === "Midwife" || user?.role === "Hospital Admin" || user?.role === "Doctor"

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><Baby className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Labor & Delivery Records</h2>
            <p className="text-xs text-slate-400">Full intrapartum and baby outcome records.</p>
          </div>
        </div>
        {canEdit && (
          <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
            <Plus className="h-4 w-4" /> Record Delivery
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading…
        </div>
      ) : records.length === 0 ? (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No labor records yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id} className="rounded-2xl border border-rose-100 bg-white shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-700">{r.patient_name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Admitted {String(r.admission_date).slice(0, 10)}
                      {r.delivery_date ? ` · Delivered ${String(r.delivery_date).slice(0, 10)}` : " · Delivery pending"}
                      {r.delivery_type ? ` (${r.delivery_type})` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-rose-50" onClick={() => toggleExpand(r.id)}>
                      {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {(r.baby_birth_weight_g || r.baby_condition) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {r.baby_sex && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">{r.baby_sex}</span>}
                    {r.baby_birth_weight_g && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{r.baby_birth_weight_g}g</span>}
                    {r.baby_apgar_1min != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">APGAR 1′: {r.baby_apgar_1min}</span>}
                    {r.baby_apgar_5min != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">5′: {r.baby_apgar_5min}</span>}
                    {r.baby_condition && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-800">{r.baby_condition}</span>}
                  </div>
                )}
              </CardHeader>

              {expandedId === r.id && (
                <CardContent className="border-t border-rose-50 pt-3 space-y-3">
                  {r.complications && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-0.5">Complications</p><p className="text-xs text-slate-600">{r.complications}</p></div>}
                  {r.notes && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-0.5">Notes</p><p className="text-xs text-slate-600">{r.notes}</p></div>}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-2">Postnatal Visits</p>
                    {loadingPostnatal === r.id ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</p>
                    ) : (postnatalMap[r.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No postnatal visits linked to this delivery.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(postnatalMap[r.id] ?? []).map((pv) => (
                          <div key={pv.id} className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-xs">
                            <span className="font-medium">{String(pv.visit_date).slice(0, 10)}</span>
                            {pv.days_postpartum != null && <span className="ml-1 text-slate-400">Day {pv.days_postpartum}</span>}
                            {pv.bp_systolic && pv.bp_diastolic && <span className="ml-2">BP {pv.bp_systolic}/{pv.bp_diastolic}</span>}
                            {pv.lochia && <span className="ml-2 capitalize">Lochia: {pv.lochia}</span>}
                            {pv.baby_weight_g && <span className="ml-2">Baby {pv.baby_weight_g}g</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">{editingRecord ? "Edit Delivery Record" : "Record Delivery"}</SheetTitle>
            <SheetDescription className="text-xs">Record intrapartum details and baby outcome.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 text-sm">
            {!editingRecord && <div className="space-y-1"><Label className="text-xs font-medium">Patient *</Label><PatientSearch value={selectedPatient} onChange={setSelectedPatient} /></div>}
            {editingRecord && <div className="rounded-lg bg-rose-50/50 border border-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{editingRecord.patient_name}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2"><Label className="text-xs font-medium">Admission Date/Time</Label><Input type="datetime-local" value={form.admissionDate} onChange={(e) => setForm((f) => ({ ...f, admissionDate: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Onset of Labor</Label>
                <Select value={form.onsetOfLabor} onValueChange={(v) => setForm((f) => ({ ...f, onsetOfLabor: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spontaneous">Spontaneous</SelectItem>
                    <SelectItem value="induced">Induced</SelectItem>
                    <SelectItem value="augmented">Augmented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs font-medium">Presentation</Label><Input placeholder="e.g. Cephalic" value={form.presentation} onChange={(e) => setForm((f) => ({ ...f, presentation: e.target.value }))} /></div>
              <div className="space-y-1 col-span-2"><Label className="text-xs font-medium">Delivery Date/Time</Label><Input type="datetime-local" value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Delivery Type</Label>
                <Select value={form.deliveryType} onValueChange={(v) => setForm((f) => ({ ...f, deliveryType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SVD">SVD</SelectItem>
                    <SelectItem value="C-Section">C-Section</SelectItem>
                    <SelectItem value="Forceps">Forceps</SelectItem>
                    <SelectItem value="Vacuum">Vacuum</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="labor-duration" className="text-xs font-medium">Duration (hours)</Label><Input id="labor-duration" name="durationOfLaborHours" type="number" min={0} step="0.5" placeholder="e.g. 8.5" value={form.durationOfLaborHours} onChange={(e) => setForm((f) => ({ ...f, durationOfLaborHours: e.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="labor-blood-loss" className="text-xs font-medium">Blood Loss (ml)</Label><Input id="labor-blood-loss" name="bloodLossMl" type="number" min={0} placeholder="e.g. 300" value={form.bloodLossMl} onChange={(e) => setForm((f) => ({ ...f, bloodLossMl: e.target.value }))} /></div>
            </div>
            <hr className="border-rose-100" />
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Baby Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Sex</Label>
                <Select value={form.babySex} onValueChange={(v) => setForm((f) => ({ ...f, babySex: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Indeterminate">Indeterminate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="baby-birth-weight" className="text-xs font-medium">Birth Weight (g)</Label><Input id="baby-birth-weight" name="babyBirthWeightG" type="number" min={0} placeholder="e.g. 3200" value={form.babyBirthWeightG} onChange={(e) => setForm((f) => ({ ...f, babyBirthWeightG: e.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="baby-apgar-1" className="text-xs font-medium">APGAR 1 min</Label><Input id="baby-apgar-1" name="babyApgar1min" type="number" min={0} max={10} placeholder="0–10" value={form.babyApgar1min} onChange={(e) => setForm((f) => ({ ...f, babyApgar1min: e.target.value }))} /></div>
              <div className="space-y-1"><Label htmlFor="baby-apgar-5" className="text-xs font-medium">APGAR 5 min</Label><Input id="baby-apgar-5" name="babyApgar5min" type="number" min={0} max={10} placeholder="0–10" value={form.babyApgar5min} onChange={(e) => setForm((f) => ({ ...f, babyApgar5min: e.target.value }))} /></div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Baby Condition</Label>
                <Select value={form.babyCondition} onValueChange={(v) => setForm((f) => ({ ...f, babyCondition: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alive">Alive</SelectItem>
                    <SelectItem value="Stillbirth">Stillbirth</SelectItem>
                    <SelectItem value="Neonatal Death">Neonatal Death</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs font-medium">Complications</Label><Textarea rows={2} placeholder="Any complications…" value={form.complications} onChange={(e) => setForm((f) => ({ ...f, complications: e.target.value }))} className="resize-none" /></div>
            <div className="space-y-1"><Label className="text-xs font-medium">Notes</Label><Textarea rows={2} placeholder="Clinical notes…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="resize-none" /></div>
            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={saveRecord} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : editingRecord ? "Save Changes" : "Record Delivery"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete delivery record?</AlertDialogTitle>
            <AlertDialogDescription>Delete the labor record for <strong>{deleteTarget?.patient_name}</strong>? This cannot be undone and will unlink any postnatal visits.</AlertDialogDescription>
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
