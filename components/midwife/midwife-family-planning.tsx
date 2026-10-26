"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Loader2, ShieldPlus } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { usePatients } from "@/lib/patient-context"

interface PatientOption {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
}

interface FamilyPlanningEvent {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  encounter_date: string
  event_type: "initiation" | "continuation" | "method_change" | "discontinuation" | "method_removal" | "follow_up" | "adverse_event"
  method: string | null
  status: "active" | "discontinued" | "completed" | null
  reason: string | null
  removal_reason: string | null
  replacement_method: string | null
  next_review_date: string | null
  is_postpartum: boolean
  postpartum_weeks: number | null
  notes: string | null
  recorded_by_name: string | null
}

type FormState = {
  encounterDate: string
  eventType: FamilyPlanningEvent["event_type"]
  method: string
  status: "active" | "discontinued" | "completed"
  reason: string
  removalReason: string
  replacementMethod: string
  nextReviewDate: string
  isPostpartum: boolean
  postpartumWeeks: string
  notes: string
}

const EMPTY_FORM: FormState = {
  encounterDate: new Date().toISOString().slice(0, 16),
  eventType: "initiation",
  method: "",
  status: "active",
  reason: "",
  removalReason: "",
  replacementMethod: "",
  nextReviewDate: "",
  isPostpartum: false,
  postpartumWeeks: "",
  notes: "",
}

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient..."
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber})` : query}
        onChange={(e) => {
          onChange(null)
          setQuery(e.target.value)
          setOpen(true)
        }}
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
              <button
                key={p.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange({ id: p.id, patientNumber: pn, firstName: fn, lastName: ln })
                  setOpen(false)
                  setQuery("")
                }}
              >
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

function needsMethod(eventType: FamilyPlanningEvent["event_type"]) {
  return eventType === "initiation" || eventType === "continuation" || eventType === "method_change" || eventType === "method_removal"
}

function isRemovalEvent(eventType: FamilyPlanningEvent["event_type"]) {
  return eventType === "method_removal"
}

export function MidwifeFamilyPlanning() {
  const [events, setEvents] = useState<FamilyPlanningEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/family-planning", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load family planning events")
      const data = await res.json().catch(() => ({ events: [] }))
      if (mountedRef.current) {
        setEvents(Array.isArray(data.events) ? data.events : [])
      }
    } catch {
      toast.error("Failed to load family planning events")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (form.eventType !== "method_removal") return
    setForm((prev) => ({ ...prev, status: "discontinued" }))
  }, [form.eventType])

  function openNew() {
    setSelectedPatient(null)
    setForm(EMPTY_FORM)
    setSheetOpen(true)
  }

  async function saveEvent() {
    if (!selectedPatient?.id) {
      toast.error("Please select a patient")
      return
    }
    if (needsMethod(form.eventType) && !form.method.trim()) {
      toast.error("Method is required for this event type")
      return
    }
    if (isRemovalEvent(form.eventType) && !form.removalReason.trim()) {
      toast.error("Removal reason is required")
      return
    }

    setSaving(true)
    try {
      const payload = {
        patientId: selectedPatient.id,
        encounterDate: form.encounterDate ? new Date(form.encounterDate).toISOString() : undefined,
        eventType: form.eventType,
        method: form.method.trim() || null,
        status: form.eventType === "method_removal" ? "discontinued" : form.status,
        reason: form.reason.trim() || null,
        removalReason: form.removalReason.trim() || null,
        replacementMethod: form.replacementMethod.trim() || null,
        nextReviewDate: form.nextReviewDate ? new Date(form.nextReviewDate).toISOString() : null,
        isPostpartum: form.isPostpartum,
        postpartumWeeks: form.postpartumWeeks ? Number.parseInt(form.postpartumWeeks, 10) : null,
        notes: form.notes.trim() || null,
      }

      const res = await fetch("/api/family-planning", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to save event")
        return
      }

      toast.success("Family planning event recorded")
      setSheetOpen(false)
      void loadEvents()
    } catch {
      toast.error("Failed to save event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><ShieldPlus className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Family Planning</h2>
            <p className="text-xs text-slate-400">Append-only event timeline for contraceptive care.</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add Event
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading...
        </div>
      ) : events.length === 0 ? (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No family planning events yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Card key={event.id} className="rounded-2xl border border-rose-100 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-700">{event.patient_name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {event.patient_number ? `#${event.patient_number} · ` : ""}
                      {String(event.encounter_date).slice(0, 10)}
                      {event.method ? ` · ${event.method}` : ""}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{event.event_type.replace("_", " ")}</p>
                    {event.status && <p className="text-[11px] text-slate-500 mt-0.5">{event.status}</p>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {event.reason && <p className="text-xs text-slate-600">Reason: {event.reason}</p>}
                {event.removal_reason && <p className="text-xs text-slate-600">Removal reason: {event.removal_reason}</p>}
                {event.replacement_method && <p className="text-xs text-slate-600">Replacement method: {event.replacement_method}</p>}
                {event.notes && <p className="text-xs text-slate-500 mt-1">{event.notes}</p>}
                <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-500">
                  {event.is_postpartum && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">Postpartum</span>}
                  {event.postpartum_weeks != null && <span>{event.postpartum_weeks} weeks</span>}
                  {event.next_review_date && <span>Next review {String(event.next_review_date).slice(0, 10)}</span>}
                  {event.recorded_by_name && <span>By {event.recorded_by_name}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">New Family Planning Event</SheetTitle>
            <SheetDescription className="text-xs">Each event is appended to preserve longitudinal history.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Patient *</Label>
              <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Event Type *</Label>
                <Select value={form.eventType} onValueChange={(value) => setForm((s) => ({ ...s, eventType: value as FormState["eventType"] }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initiation">Initiation</SelectItem>
                    <SelectItem value="continuation">Continuation</SelectItem>
                    <SelectItem value="method_change">Method Change</SelectItem>
                    <SelectItem value="discontinuation">Discontinuation</SelectItem>
                    <SelectItem value="method_removal">Method Removal</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="adverse_event">Adverse Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((s) => ({ ...s, status: value as FormState["status"] }))}>
                  <SelectTrigger disabled={isRemovalEvent(form.eventType)}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Encounter Date/Time</Label>
                <Input type="datetime-local" value={form.encounterDate} onChange={(e) => setForm((s) => ({ ...s, encounterDate: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">{isRemovalEvent(form.eventType) ? "Method Removed" : "Method"} {needsMethod(form.eventType) ? "*" : ""}</Label>
                <Input placeholder="e.g. Implant, DMPA, IUCD" value={form.method} onChange={(e) => setForm((s) => ({ ...s, method: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Reason</Label>
                <Input placeholder="Reason for initiation/change/discontinuation" value={form.reason} onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))} />
              </div>
              {isRemovalEvent(form.eventType) && (
                <>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-medium">Reason for Removal *</Label>
                    <Input placeholder="Client choice, side effects, expiry, complication..." value={form.removalReason} onChange={(e) => setForm((s) => ({ ...s, removalReason: e.target.value }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs font-medium">Follow-up / Replacement Method</Label>
                    <Input placeholder="e.g. Switch to oral method" value={form.replacementMethod} onChange={(e) => setForm((s) => ({ ...s, replacementMethod: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Next Review Date</Label>
                <Input type="date" value={form.nextReviewDate} onChange={(e) => setForm((s) => ({ ...s, nextReviewDate: e.target.value }))} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isPostpartum}
                onChange={(e) => setForm((s) => ({ ...s, isPostpartum: e.target.checked }))}
                className="rounded border-rose-300 text-rose-600"
              />
              <span className="text-slate-600">Postpartum family planning</span>
            </label>

            {form.isPostpartum && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Postpartum Weeks</Label>
                <Input
                  type="number"
                  min={0}
                  max={52}
                  value={form.postpartumWeeks}
                  onChange={(e) => setForm((s) => ({ ...s, postpartumWeeks: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Counselling provided, side effects, follow-up plan..."
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={saveEvent} disabled={saving}>
                {saving ? "Saving..." : "Save Event"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
