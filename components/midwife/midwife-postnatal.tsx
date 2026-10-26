"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, Pencil, Trash2, Loader2, HeartPulse, FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"

interface PatientOption {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
}

interface LaborOption {
  id: string
  admission_date: string
  delivery_date: string | null
  delivery_type: string | null
}

interface LabCatalogItem {
  loincCode: string | null
  name: string
  class?: string
}

interface LabInvestigation {
  name: string
  loincCode: string | null
  testType: string
  specimenType: string
}

interface PostnatalVisit {
  id: string
  patient_id: string
  patient_name: string
  patient_number: string | null
  labor_delivery_id: string | null
  visit_date: string
  days_postpartum: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  temperature_c: number | null
  pulse_rate: number | null
  respiratory_rate: number | null
  weight_kg: number | null
  general_assessment: string | null
  other_observations: string | null
  lochia: string | null
  wound_healing: string | null
  breastfeeding_status: string | null
  baby_weight_g: number | null
  baby_condition: string | null
  nutrition_assessment: string | null
  mother_nutrition_status: string | null
  nutrition_intake: string | null
  nutrition_food_access: string | null
  nutrition_supplements: string | null
  nutrition_counselling: string | null
  newborn_id: string | null
  newborn_patient_number: string | null
  newborn_patient_name: string | null
  newborn_feeding_status: string | null
  cord_status: string | null
  cord_assessment: string | null
  cord_care_provided: string | null
  cord_advice: string | null
  cord_concerns: string | null
  cord_follow_up: string | null
  lab_investigations: Array<{
    id: string
    test_name: string
    status: string
    ordered_at: string
  }> | null
  maternal_danger_signs: unknown[] | null
  newborn_danger_signs: unknown[] | null
  notes: string | null
}

type FormState = {
  visitDate: string
  daysPostpartum: string
  bpSystolic: string
  bpDiastolic: string
  temperatureC: string
  pulseRate: string
  respiratoryRate: string
  weightKg: string
  generalAssessment: string
  otherObservations: string
  lochia: string
  woundHealing: string
  breastfeedingStatus: string
  babyWeightG: string
  babyCondition: string
  nutritionAssessment: string
  motherNutritionStatus: string
  nutritionIntake: string
  nutritionFoodAccess: string
  nutritionSupplements: string
  nutritionCounselling: string
  newbornFeedingStatus: string
  cordStatus: string
  cordAssessment: string
  cordCareProvided: string
  cordAdvice: string
  cordConcerns: string
  cordFollowUp: string
  maternalDangerSigns: string[]
  newbornDangerSigns: string[]
  maternalDangerOther: string
  newbornDangerOther: string
  notes: string
}

const EMPTY_FORM: FormState = {
  visitDate: new Date().toISOString().slice(0, 16),
  daysPostpartum: "",
  bpSystolic: "",
  bpDiastolic: "",
  temperatureC: "",
  pulseRate: "",
  respiratoryRate: "",
  weightKg: "",
  generalAssessment: "",
  otherObservations: "",
  lochia: "",
  woundHealing: "",
  breastfeedingStatus: "",
  babyWeightG: "",
  babyCondition: "",
  nutritionAssessment: "",
  motherNutritionStatus: "",
  nutritionIntake: "",
  nutritionFoodAccess: "",
  nutritionSupplements: "",
  nutritionCounselling: "",
  newbornFeedingStatus: "",
  cordStatus: "",
  cordAssessment: "",
  cordCareProvided: "",
  cordAdvice: "",
  cordConcerns: "",
  cordFollowUp: "",
  maternalDangerSigns: [],
  newbornDangerSigns: [],
  maternalDangerOther: "",
  newbornDangerOther: "",
  notes: "",
}

const MATERNAL_DANGER_SIGN_OPTIONS = [
  "Heavy vaginal bleeding",
  "Severe headache",
  "Blurred vision / visual disturbance",
  "Fever",
  "Foul-smelling lochia / discharge",
  "Severe abdominal pain",
  "Convulsions",
  "Shortness of breath",
]

const NEWBORN_DANGER_SIGN_OPTIONS = [
  "Poor feeding / poor suck",
  "Fever",
  "Hypothermia",
  "Fast breathing",
  "Chest indrawing",
  "Jaundice",
  "Convulsions",
  "Lethargy / reduced activity",
]

function toggleSign(current: string[], sign: string): string[] {
  return current.includes(sign) ? current.filter((s) => s !== sign) : [...current, sign]
}

function splitKnownAndCustom(values: string[], options: string[]) {
  const known: string[] = []
  const custom: string[] = []
  for (const value of values) {
    if (options.includes(value)) known.push(value)
    else if (value.trim()) custom.push(value.trim())
  }
  return { known, custom: custom.join(", ") }
}

function mergeKnownAndCustom(known: string[], customRaw: string): string[] {
  const extras = customRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return Array.from(new Set([...known, ...extras]))
}

function PatientSearch({ value, onChange, placeholder = "Search patient..." }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void; placeholder?: string }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
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

interface MidwifePostnatalProps { openNewOnMount?: boolean }

export function MidwifePostnatal({ openNewOnMount = false }: MidwifePostnatalProps) {
  const { user } = useAuth()
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [visits, setVisits] = useState<PostnatalVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState<PostnatalVisit | null>(null)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [selectedNewborn, setSelectedNewborn] = useState<PatientOption | null>(null)
  const [laborOptions, setLaborOptions] = useState<LaborOption[]>([])
  const [selectedLaborId, setSelectedLaborId] = useState<string>("")
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [labSearch, setLabSearch] = useState("")
  const [labMatches, setLabMatches] = useState<LabCatalogItem[]>([])
  const [labSearchError, setLabSearchError] = useState("")
  const [labSearchLoading, setLabSearchLoading] = useState(false)
  const [manualLabTest, setManualLabTest] = useState("")
  const [labOrderNotes, setLabOrderNotes] = useState("")
  const [labPriority, setLabPriority] = useState("Routine")
  const [selectedInvestigations, setSelectedInvestigations] = useState<LabInvestigation[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PostnatalVisit | null>(null)
  const [deleting, setDeleting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    if (labSearch.trim().length < 2) {
      setLabMatches([])
      setLabSearchError("")
      setLabSearchLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLabSearchLoading(true)
      setLabSearchError("")
      try {
        const response = await fetch(`/api/lab-catalog?q=${encodeURIComponent(labSearch.trim())}`, {
          credentials: "include",
          signal: controller.signal,
        })
        if (!response.ok) throw new Error("Lab catalog search failed")
        const data = await response.json()
        setLabMatches(Array.isArray(data.items) ? data.items : [])
      } catch (error) {
        if (controller.signal.aborted) return
        setLabMatches([])
        setLabSearchError(error instanceof Error ? error.message : "Lab catalog search failed")
      } finally {
        if (!controller.signal.aborted) setLabSearchLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [labSearch])

  const canEdit = user?.role === "Midwife" || user?.role === "Hospital Admin" || user?.role === "Clinician"

  const loadVisits = useCallback(async () => {
    setLoading(true)
    try {
      const f = encodeURIComponent(new Date(from + "T00:00:00Z").toISOString())
      const t = encodeURIComponent(new Date(to + "T23:59:59Z").toISOString())
      const res = await fetch(`/api/postnatal?from=${f}&to=${t}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load postnatal visits")
      const data = await res.json().catch(() => ({ visits: [] }))
      if (mountedRef.current) setVisits(Array.isArray(data.visits) ? data.visits : [])
    } catch {
      toast.error("Failed to load postnatal visits")
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void loadVisits() }, [loadVisits])

  async function loadLaborOptions(patientId: string) {
    try {
      const res = await fetch(`/api/labor?patientId=${patientId}`, { credentials: "include" })
      const data = await res.json().catch(() => ({ records: [] }))
      setLaborOptions(Array.isArray(data.records) ? data.records : [])
    } catch {
      setLaborOptions([])
    }
  }

  useEffect(() => {
    if (!sheetOpen) return
    if (!editingVisit && selectedPatient?.id) {
      void loadLaborOptions(selectedPatient.id)
    }
  }, [sheetOpen, editingVisit, selectedPatient?.id])

  useEffect(() => {
    if (!openNewOnMount) return
    setEditingVisit(null)
    setSelectedPatient(null)
    setSelectedNewborn(null)
    setLaborOptions([])
    setSelectedLaborId("")
    setForm(EMPTY_FORM)
    setLabSearch("")
    setManualLabTest("")
    setLabOrderNotes("")
    setLabPriority("Routine")
    setSelectedInvestigations([])
    setSheetOpen(true)
  }, [openNewOnMount])

  function openNew() {
    setEditingVisit(null)
    setSelectedPatient(null)
    setSelectedNewborn(null)
    setLaborOptions([])
    setSelectedLaborId("")
    setForm(EMPTY_FORM)
    setLabSearch("")
    setManualLabTest("")
    setLabOrderNotes("")
    setLabPriority("Routine")
    setSelectedInvestigations([])
    setSheetOpen(true)
  }

  function openEdit(v: PostnatalVisit) {
    setEditingVisit(v)
    setSelectedPatient(null)
    setSelectedLaborId(v.labor_delivery_id || "")
    setForm({
      visitDate: String(v.visit_date).slice(0, 16),
      daysPostpartum: v.days_postpartum != null ? String(v.days_postpartum) : "",
      bpSystolic: v.bp_systolic != null ? String(v.bp_systolic) : "",
      bpDiastolic: v.bp_diastolic != null ? String(v.bp_diastolic) : "",
      temperatureC: v.temperature_c != null ? String(v.temperature_c) : "",
      pulseRate: v.pulse_rate != null ? String(v.pulse_rate) : "",
      respiratoryRate: v.respiratory_rate != null ? String(v.respiratory_rate) : "",
      weightKg: v.weight_kg != null ? String(v.weight_kg) : "",
      generalAssessment: v.general_assessment || "",
      otherObservations: v.other_observations || "",
      lochia: v.lochia || "",
      woundHealing: v.wound_healing || "",
      breastfeedingStatus: v.breastfeeding_status || "",
      babyWeightG: v.baby_weight_g != null ? String(v.baby_weight_g) : "",
      babyCondition: v.baby_condition || "",
      nutritionAssessment: v.nutrition_assessment || "",
      motherNutritionStatus: v.mother_nutrition_status || "",
      nutritionIntake: v.nutrition_intake || "",
      nutritionFoodAccess: v.nutrition_food_access || "",
      nutritionSupplements: v.nutrition_supplements || "",
      nutritionCounselling: v.nutrition_counselling || "",
      newbornFeedingStatus: v.newborn_feeding_status || "",
      cordStatus: v.cord_status || "",
      cordAssessment: v.cord_assessment || "",
      cordCareProvided: v.cord_care_provided || "",
      cordAdvice: v.cord_advice || "",
      cordConcerns: v.cord_concerns || "",
      cordFollowUp: v.cord_follow_up || "",
      maternalDangerSigns: splitKnownAndCustom(
        Array.isArray(v.maternal_danger_signs) ? v.maternal_danger_signs.map((s) => String(s)) : [],
        MATERNAL_DANGER_SIGN_OPTIONS,
      ).known,
      newbornDangerSigns: splitKnownAndCustom(
        Array.isArray(v.newborn_danger_signs) ? v.newborn_danger_signs.map((s) => String(s)) : [],
        NEWBORN_DANGER_SIGN_OPTIONS,
      ).known,
      maternalDangerOther: splitKnownAndCustom(
        Array.isArray(v.maternal_danger_signs) ? v.maternal_danger_signs.map((s) => String(s)) : [],
        MATERNAL_DANGER_SIGN_OPTIONS,
      ).custom,
      newbornDangerOther: splitKnownAndCustom(
        Array.isArray(v.newborn_danger_signs) ? v.newborn_danger_signs.map((s) => String(s)) : [],
        NEWBORN_DANGER_SIGN_OPTIONS,
      ).custom,
      notes: v.notes || "",
    })
    setLabSearch("")
    setManualLabTest("")
    setLabOrderNotes("")
    setLabPriority("Routine")
    setSelectedInvestigations([])
    if (v.newborn_id && v.newborn_patient_number && v.newborn_patient_name) {
      const names = v.newborn_patient_name.split(" ")
      setSelectedNewborn({
        id: v.newborn_id,
        patientNumber: v.newborn_patient_number,
        firstName: names[0] || "",
        lastName: names.slice(1).join(" ") || "",
      })
    } else {
      setSelectedNewborn(null)
    }
    setSheetOpen(true)
  }

  function addInvestigation(item: LabCatalogItem) {
    const key = item.loincCode || item.name.trim().toLowerCase()
    if (selectedInvestigations.some((test) => (test.loincCode || test.name.trim().toLowerCase()) === key)) return
    setSelectedInvestigations((current) => [
      ...current,
      {
        name: item.name,
        loincCode: item.loincCode,
        testType: item.class || "Postnatal",
        specimenType: "",
      },
    ])
  }

  function addCustomInvestigation() {
    const name = manualLabTest.trim()
    if (!name) return
    addInvestigation({ name, loincCode: null, class: "Postnatal" })
    setManualLabTest("")
  }

  async function saveVisit() {
    const patientId = editingVisit ? editingVisit.patient_id : selectedPatient?.id || ""
    if (!patientId) {
      toast.error("Please select a patient")
      return
    }

    setSaving(true)
    try {
      const payload = {
        patientId,
        laborDeliveryId: selectedLaborId || null,
        visitDate: form.visitDate ? new Date(form.visitDate).toISOString() : new Date().toISOString(),
        daysPostpartum: form.daysPostpartum ? Number.parseInt(form.daysPostpartum, 10) : null,
        bpSystolic: form.bpSystolic ? Number.parseInt(form.bpSystolic, 10) : null,
        bpDiastolic: form.bpDiastolic ? Number.parseInt(form.bpDiastolic, 10) : null,
        temperatureC: form.temperatureC ? Number.parseFloat(form.temperatureC) : null,
        pulseRate: form.pulseRate ? Number.parseInt(form.pulseRate, 10) : null,
        respiratoryRate: form.respiratoryRate ? Number.parseInt(form.respiratoryRate, 10) : null,
        weightKg: form.weightKg ? Number.parseFloat(form.weightKg) : null,
        generalAssessment: form.generalAssessment || null,
        otherObservations: form.otherObservations || null,
        lochia: form.lochia || null,
        woundHealing: form.woundHealing || null,
        breastfeedingStatus: form.breastfeedingStatus || null,
        babyWeightG: form.babyWeightG ? Number.parseInt(form.babyWeightG, 10) : null,
        babyCondition: form.babyCondition || null,
        nutritionAssessment: form.nutritionAssessment || null,
        motherNutritionStatus: form.motherNutritionStatus || null,
        nutritionIntake: form.nutritionIntake || null,
        nutritionFoodAccess: form.nutritionFoodAccess || null,
        nutritionSupplements: form.nutritionSupplements || null,
        nutritionCounselling: form.nutritionCounselling || null,
        newbornId: selectedNewborn?.id || null,
        newbornFeedingStatus: form.newbornFeedingStatus || null,
        cordStatus: form.cordStatus || null,
        cordAssessment: form.cordAssessment || null,
        cordCareProvided: form.cordCareProvided || null,
        cordAdvice: form.cordAdvice || null,
        cordConcerns: form.cordConcerns || null,
        cordFollowUp: form.cordFollowUp || null,
        maternalDangerSigns: mergeKnownAndCustom(form.maternalDangerSigns, form.maternalDangerOther),
        newbornDangerSigns: mergeKnownAndCustom(form.newbornDangerSigns, form.newbornDangerOther),
        notes: form.notes || null,
      }

      const res = editingVisit
        ? await fetch(`/api/postnatal/${editingVisit.id}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/postnatal", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Failed to save postnatal visit")
        return
      }

      const savedVisit = await res.json().catch(() => ({}))
      const visitId = editingVisit?.id || savedVisit.id
      toast.success(editingVisit ? "Postnatal visit updated" : "Postnatal visit recorded")
      if (selectedInvestigations.length > 0) {
        if (!visitId) {
          toast.error("Visit saved, but lab orders could not be linked to the postnatal record")
        } else {
          try {
            const labResponse = await fetch("/api/lab-tests", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientId,
                postnatalVisitId: visitId,
                priority: labPriority,
                notes: labOrderNotes.trim() || "Ordered during postnatal follow-up",
                tests: selectedInvestigations.map((test) => ({
                  testName: test.name,
                  testType: test.testType,
                  loincCode: test.loincCode,
                  specimenType: test.specimenType || null,
                  priority: labPriority,
                })),
              }),
            })
            const labData = await labResponse.json().catch(() => ({}))
            if (!labResponse.ok) {
              toast.error(`Visit saved, but laboratory orders failed: ${labData.error || "check the lab queue"}`)
            } else {
              toast.success(`${selectedInvestigations.length} laboratory investigation(s) ordered`)
            }
          } catch {
            toast.error("Visit saved, but laboratory orders could not be submitted. Check the lab queue.")
          }
        }
      }
      setSheetOpen(false)
      await loadVisits()
    } catch {
      toast.error("Failed to save postnatal visit")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/postnatal/${deleteTarget.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Delete failed")
        return
      }
      setVisits((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      toast.success("Postnatal visit deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4 p-1">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600"><HeartPulse className="h-4 w-4" /></div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-700">Postnatal Visits</CardTitle>
                <CardDescription className="text-xs">Record and update postpartum care, nutrition, and newborn linkage.</CardDescription>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl" onClick={openNew}>
                <Plus className="h-4 w-4" /> New Postnatal Visit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="postnatal-filter-from" className="text-xs text-slate-500">From</Label>
              <Input id="postnatal-filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postnatal-filter-to" className="text-xs text-slate-500">To</Label>
              <Input id="postnatal-filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading...
        </div>
      ) : visits.length === 0 ? (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No postnatal visits in this range.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <Card key={v.id} className="rounded-2xl border border-rose-100 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-700">{v.patient_name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {v.patient_number ? `#${v.patient_number} · ` : ""}
                      {String(v.visit_date).slice(0, 16).replace("T", " ")}
                      {v.days_postpartum != null ? ` · Day ${v.days_postpartum}` : ""}
                    </CardDescription>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteTarget(v)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-slate-600 space-y-1">
                <p>
                  {v.bp_systolic && v.bp_diastolic ? `BP ${v.bp_systolic}/${v.bp_diastolic}` : "BP not recorded"}
                  {v.temperature_c != null ? ` · Temp ${v.temperature_c}C` : ""}
                  {v.pulse_rate != null ? ` · Pulse ${v.pulse_rate}/min` : ""}
                  {v.respiratory_rate != null ? ` · RR ${v.respiratory_rate}/min` : ""}
                  {v.weight_kg != null ? ` · Weight ${v.weight_kg} kg` : ""}
                  {v.lochia ? ` · Lochia ${v.lochia}` : ""}
                </p>
                {v.general_assessment && <p>General assessment: {v.general_assessment}</p>}
                {v.other_observations && <p>Other observations: {v.other_observations}</p>}
                {v.nutrition_assessment && <p>Nutrition: {v.nutrition_assessment}</p>}
                {v.mother_nutrition_status && <p>Maternal nutrition status: {v.mother_nutrition_status}</p>}
                {v.nutrition_intake && <p>Diet/appetite: {v.nutrition_intake}</p>}
                {v.nutrition_food_access && <p>Food access: {v.nutrition_food_access}</p>}
                {v.nutrition_supplements && <p>Supplements: {v.nutrition_supplements}</p>}
                {v.nutrition_counselling && <p>Nutrition counselling/action: {v.nutrition_counselling}</p>}
                {(v.newborn_patient_number || v.newborn_patient_name) && (
                  <p>
                    Newborn link: {v.newborn_patient_number ? `#${v.newborn_patient_number}` : "Linked"}
                    {v.newborn_patient_name ? ` (${v.newborn_patient_name})` : ""}
                  </p>
                )}
                {(v.newborn_feeding_status || v.cord_status) && (
                  <p>
                    {v.newborn_feeding_status ? `Feeding ${v.newborn_feeding_status}` : ""}
                    {v.newborn_feeding_status && v.cord_status ? " · " : ""}
                    {v.cord_status ? `Cord ${v.cord_status}` : ""}
                  </p>
                )}
                {v.cord_assessment && <p>Cord findings: {v.cord_assessment}</p>}
                {v.cord_care_provided && <p>Cord care provided: {v.cord_care_provided}</p>}
                {v.cord_advice && <p>Cord-care advice: {v.cord_advice}</p>}
                {v.cord_concerns && <p>Cord concerns: {v.cord_concerns}</p>}
                {v.cord_follow_up && <p>Cord follow-up: {v.cord_follow_up}</p>}
                {Array.isArray(v.lab_investigations) && v.lab_investigations.length > 0 && (
                  <div>
                    <p className="font-medium">Laboratory investigations</p>
                    {v.lab_investigations.map((test) => (
                      <p key={test.id}>{test.test_name} · {test.status}</p>
                    ))}
                  </div>
                )}
                {Array.isArray(v.maternal_danger_signs) && v.maternal_danger_signs.length > 0 && (
                  <p>Maternal danger signs: {v.maternal_danger_signs.join(", ")}</p>
                )}
                {Array.isArray(v.newborn_danger_signs) && v.newborn_danger_signs.length > 0 && (
                  <p>Newborn danger signs: {v.newborn_danger_signs.join(", ")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">{editingVisit ? "Edit Postnatal Visit" : "New Postnatal Visit"}</SheetTitle>
            <SheetDescription className="text-xs">Capture postpartum review, nutrition, and newborn continuity details.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 text-sm">
            {!editingVisit && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Mother (Patient) *</Label>
                <PatientSearch value={selectedPatient} onChange={setSelectedPatient} placeholder="Search mother..." />
              </div>
            )}

            {editingVisit && (
              <div className="rounded-lg bg-rose-50/50 border border-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
                {editingVisit.patient_name}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-medium">Linked Labor Record (optional)</Label>
              <Select value={selectedLaborId || "none"} onValueChange={(v) => setSelectedLaborId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select linked labor record" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {laborOptions.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {String(record.admission_date).slice(0, 10)} {record.delivery_type ? `· ${record.delivery_type}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <section className="space-y-2 rounded-xl border border-rose-100 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Mother assessment</h3>
              <div className="space-y-1">
                <Label className="text-xs font-medium">General assessment</Label>
                <Textarea
                  rows={3}
                  value={form.generalAssessment}
                  onChange={(e) => setForm((s) => ({ ...s, generalAssessment: e.target.value }))}
                  placeholder="Overall appearance, concerns, examination findings, and assessment"
                  className="resize-none"
                />
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Visit Date/Time</Label>
                <Input type="datetime-local" value={form.visitDate} onChange={(e) => setForm((s) => ({ ...s, visitDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Days Postpartum</Label>
                <Input type="number" min={0} value={form.daysPostpartum} onChange={(e) => setForm((s) => ({ ...s, daysPostpartum: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Temperature (C)</Label>
                <Input type="number" min={30} max={43} step="0.1" value={form.temperatureC} onChange={(e) => setForm((s) => ({ ...s, temperatureC: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">BP Systolic</Label>
                <Input type="number" min={50} max={260} value={form.bpSystolic} onChange={(e) => setForm((s) => ({ ...s, bpSystolic: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">BP Diastolic</Label>
                <Input type="number" min={30} max={160} value={form.bpDiastolic} onChange={(e) => setForm((s) => ({ ...s, bpDiastolic: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Pulse (beats/min)</Label>
                <Input type="number" min={1} value={form.pulseRate} onChange={(e) => setForm((s) => ({ ...s, pulseRate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Respiratory rate (/min)</Label>
                <Input type="number" min={1} value={form.respiratoryRate} onChange={(e) => setForm((s) => ({ ...s, respiratoryRate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Mother weight (kg)</Label>
                <Input type="number" min={0.1} step="0.1" value={form.weightKg} onChange={(e) => setForm((s) => ({ ...s, weightKg: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Lochia</Label>
                <Select value={form.lochia || "none"} onValueChange={(v) => setForm((s) => ({ ...s, lochia: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not recorded</SelectItem>
                    <SelectItem value="rubra">Rubra</SelectItem>
                    <SelectItem value="serosa">Serosa</SelectItem>
                    <SelectItem value="alba">Alba</SelectItem>
                    <SelectItem value="abnormal">Abnormal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Baby Weight (g)</Label>
                <Input type="number" min={0} value={form.babyWeightG} onChange={(e) => setForm((s) => ({ ...s, babyWeightG: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Baby Condition</Label>
                <Input value={form.babyCondition} onChange={(e) => setForm((s) => ({ ...s, babyCondition: e.target.value }))} placeholder="General newborn condition" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Breastfeeding Status</Label>
                <Input value={form.breastfeedingStatus} onChange={(e) => setForm((s) => ({ ...s, breastfeedingStatus: e.target.value }))} placeholder="Exclusive, mixed, challenges..." />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Other relevant observations</Label>
              <Textarea rows={2} value={form.otherObservations} onChange={(e) => setForm((s) => ({ ...s, otherObservations: e.target.value }))} className="resize-none" />
            </div>

            <section className="space-y-3 rounded-xl border border-rose-100 p-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Nutrition assessment</h3>
                <p className="mt-1 text-xs text-slate-500">Record locally relevant dietary and nutrition information; do not assume a universal screening score.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Diet, appetite, and intake</Label>
                <Textarea rows={2} value={form.nutritionIntake} onChange={(e) => setForm((s) => ({ ...s, nutritionIntake: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Food access or dietary concerns</Label>
                <Textarea rows={2} value={form.nutritionFoodAccess} onChange={(e) => setForm((s) => ({ ...s, nutritionFoodAccess: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Supplements and adherence</Label>
                <Input value={form.nutritionSupplements} onChange={(e) => setForm((s) => ({ ...s, nutritionSupplements: e.target.value }))} placeholder="Record prescribed supplements and reported adherence, if relevant" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Nutrition assessment and status</Label>
                <Textarea rows={2} value={form.nutritionAssessment} onChange={(e) => setForm((s) => ({ ...s, nutritionAssessment: e.target.value }))} className="resize-none" />
                <Input value={form.motherNutritionStatus} onChange={(e) => setForm((s) => ({ ...s, motherNutritionStatus: e.target.value }))} placeholder="Facility-defined status or assessment" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Counselling, action, or referral</Label>
                <Textarea rows={2} value={form.nutritionCounselling} onChange={(e) => setForm((s) => ({ ...s, nutritionCounselling: e.target.value }))} className="resize-none" />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-rose-100 p-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-rose-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Laboratory investigations</h3>
              </div>
              <p className="text-xs text-slate-500">Select tests from the catalog or add a facility-approved custom test. Choose HIV testing and other investigations according to current local protocol, obtain consent as required, and follow the approved diagnostic algorithm. Enter results in the confidential laboratory workflow.</p>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Search laboratory catalog</Label>
                <div className="flex gap-2">
                  <Input value={labSearch} onChange={(e) => setLabSearch(e.target.value)} placeholder="Search test name or LOINC code" />
                  <Button type="button" variant="outline" onClick={() => setLabSearch("HIV")}>Find HIV tests</Button>
                </div>
              </div>
              {labSearchLoading && <p className="text-xs text-slate-500">Searching catalog…</p>}
              {labSearchError && <p role="alert" className="text-xs text-red-600">{labSearchError}</p>}
              {labMatches.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-rose-100 p-2">
                  {labMatches.map((item, index) => (
                    <div key={`${item.loincCode || item.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                      <span>{item.name}{item.loincCode ? ` · LOINC ${item.loincCode}` : ""}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => addInvestigation(item)}>Add</Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={manualLabTest} onChange={(e) => setManualLabTest(e.target.value)} placeholder="Add a custom facility test" />
                <Button type="button" variant="outline" onClick={addCustomInvestigation} disabled={!manualLabTest.trim()}>Add</Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Clinical indication or local consent documentation</Label>
                <Textarea rows={2} value={labOrderNotes} onChange={(e) => setLabOrderNotes(e.target.value)} className="resize-none" />
              </div>
              {selectedInvestigations.map((test, index) => (
                <div key={`${test.loincCode || test.name}-${index}`} className="space-y-2 rounded-lg bg-rose-50/50 p-2">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium">
                    <span>{test.name}{test.loincCode ? ` · ${test.loincCode}` : ""}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${test.name}`}
                      onClick={() => setSelectedInvestigations((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={test.specimenType}
                    onChange={(e) => setSelectedInvestigations((current) => current.map((item, i) => i === index ? { ...item, specimenType: e.target.value } : item))}
                    placeholder="Specimen (optional)"
                  />
                </div>
              ))}
              {selectedInvestigations.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Order priority</Label>
                  <Select value={labPriority} onValueChange={setLabPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Routine">Routine</SelectItem>
                      <SelectItem value="Urgent">Urgent</SelectItem>
                      <SelectItem value="Stat">STAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Linked Newborn (optional)</Label>
              <PatientSearch value={selectedNewborn} onChange={setSelectedNewborn} placeholder="Search newborn patient record..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Newborn Feeding Status</Label>
                <Input value={form.newbornFeedingStatus} onChange={(e) => setForm((s) => ({ ...s, newbornFeedingStatus: e.target.value }))} placeholder="Feeding well, poor latch..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Cord condition</Label>
                <Input value={form.cordStatus} onChange={(e) => setForm((s) => ({ ...s, cordStatus: e.target.value }))} placeholder="Clean, dry, infected..." />
              </div>
            </div>

            <section className="space-y-3 rounded-xl border border-rose-100 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Cord care</h3>
              <p className="text-xs text-slate-500">Record what was observed and done, including any concern and the agreed follow-up.</p>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Assessment findings</Label>
                <Textarea rows={2} value={form.cordAssessment} onChange={(e) => setForm((s) => ({ ...s, cordAssessment: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Care provided</Label>
                <Textarea rows={2} value={form.cordCareProvided} onChange={(e) => setForm((s) => ({ ...s, cordCareProvided: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Advice given to the mother</Label>
                <Textarea rows={2} value={form.cordAdvice} onChange={(e) => setForm((s) => ({ ...s, cordAdvice: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Concerns or abnormal findings</Label>
                <Textarea rows={2} value={form.cordConcerns} onChange={(e) => setForm((s) => ({ ...s, cordConcerns: e.target.value }))} className="resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Follow-up instructions</Label>
                <Textarea rows={2} value={form.cordFollowUp} onChange={(e) => setForm((s) => ({ ...s, cordFollowUp: e.target.value }))} className="resize-none" />
              </div>
            </section>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Maternal Danger Signs</Label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-rose-100 p-2">
                {MATERNAL_DANGER_SIGN_OPTIONS.map((sign) => {
                  const selected = form.maternalDangerSigns.includes(sign)
                  return (
                    <button
                      key={sign}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, maternalDangerSigns: toggleSign(s.maternalDangerSigns, sign) }))}
                      className={selected
                        ? "rounded-full border border-rose-300 bg-rose-600 px-3 py-1 text-xs text-white"
                        : "rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      }
                    >
                      {sign}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (form.maternalDangerOther.trim()) {
                      setForm((s) => ({ ...s, maternalDangerOther: "" }))
                    }
                  }}
                  className={form.maternalDangerOther.trim()
                    ? "rounded-full border border-rose-300 bg-rose-600 px-3 py-1 text-xs text-white"
                    : "rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700"
                  }
                >
                  Other (specify)
                </button>
              </div>
              <Input
                value={form.maternalDangerOther}
                onChange={(e) => setForm((s) => ({ ...s, maternalDangerOther: e.target.value }))}
                placeholder="Other maternal danger signs (comma-separated)"
                className="mt-2"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Newborn Danger Signs</Label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-rose-100 p-2">
                {NEWBORN_DANGER_SIGN_OPTIONS.map((sign) => {
                  const selected = form.newbornDangerSigns.includes(sign)
                  return (
                    <button
                      key={sign}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, newbornDangerSigns: toggleSign(s.newbornDangerSigns, sign) }))}
                      className={selected
                        ? "rounded-full border border-rose-300 bg-rose-600 px-3 py-1 text-xs text-white"
                        : "rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      }
                    >
                      {sign}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    if (form.newbornDangerOther.trim()) {
                      setForm((s) => ({ ...s, newbornDangerOther: "" }))
                    }
                  }}
                  className={form.newbornDangerOther.trim()
                    ? "rounded-full border border-rose-300 bg-rose-600 px-3 py-1 text-xs text-white"
                    : "rounded-full border border-rose-200 bg-white px-3 py-1 text-xs text-rose-700"
                  }
                >
                  Other (specify)
                </button>
              </div>
              <Input
                value={form.newbornDangerOther}
                onChange={(e) => setForm((s) => ({ ...s, newbornDangerOther: e.target.value }))}
                placeholder="Other newborn danger signs (comma-separated)"
                className="mt-2"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Wound Healing</Label>
              <Textarea rows={2} value={form.woundHealing} onChange={(e) => setForm((s) => ({ ...s, woundHealing: e.target.value }))} className="resize-none" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} className="resize-none" />
            </div>

            <Button className="w-full bg-rose-600 hover:bg-rose-700 text-white" onClick={saveVisit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : editingVisit ? "Save Changes" : "Record Postnatal Visit"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete postnatal visit?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete postnatal visit for <strong>{deleteTarget?.patient_name}</strong>? This cannot be undone.
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
