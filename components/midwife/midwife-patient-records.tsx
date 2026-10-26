"use client"
import { useCallback, useEffect, useState } from "react"
import { Search, ChevronRight, Loader2, ClipboardList, Baby, HeartPulse, Syringe, ArrowUpRight, FlaskConical, Pill, Activity } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { usePatients } from "@/lib/patient-context"
import { useAuth } from "@/lib/auth-context"

interface PatientRow {
  id: string
  first_name: string
  last_name: string
  patient_number: string
}

interface ObsAssessment {
  id: string
  visit_date: string
  gravida: number | null
  parity: number | null
  gestational_age_weeks: number | null
  edd: string | null
  fetal_heart_rate: number | null
  fundal_height_cm: number | null
  presentation: string | null
  notes: string | null
}

interface LaborRecord {
  id: string
  admission_date: string
  delivery_date: string | null
  delivery_type: string | null
  baby_birth_weight_g: number | null
  baby_apgar_1min: number | null
  baby_apgar_5min: number | null
  baby_condition: string | null
}

interface PostnatalVisit {
  id: string
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
  nutrition_assessment: string | null
  mother_nutrition_status: string | null
  nutrition_intake: string | null
  nutrition_food_access: string | null
  nutrition_supplements: string | null
  nutrition_counselling: string | null
  newborn_patient_number: string | null
  newborn_patient_name: string | null
  newborn_feeding_status: string | null
  cord_status: string | null
  cord_assessment: string | null
  cord_care_provided: string | null
  cord_advice: string | null
  cord_concerns: string | null
  cord_follow_up: string | null
  baby_weight_g: number | null
}

interface LaborVitalEvent {
  id: string
  measured_at: string
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse_rate: number | null
  respiratory_rate: number | null
  temperature_c: number | null
  fetal_heart_rate: number | null
}

interface FamilyPlanningEvent {
  id: string
  encounter_date: string
  event_type: string
  method: string | null
  status: string | null
  reason: string | null
  removal_reason: string | null
  replacement_method: string | null
  is_postpartum: boolean
  postpartum_weeks: number | null
}

interface ImmunizationRow {
  id: string
  vaccine_name: string
  date_administered: string
  status: string | null
  dose: string | null
  next_due_date: string | null
}

interface ReferralRow {
  id: string
  type: string
  receiving_user_id?: string | null
  receiving_department: string | null
  reason: string
  urgency: string
  created_at: string
  status: string | null
  handoff_snapshot?: ReferralHandoffSnapshot | string | null
}

interface ReferralHandoffSnapshot {
  latestClinicalRecord?: {
    chief_complaint?: string | null
    history?: string | null
    impression?: string | null
    diagnosis?: string | null
    treatment_plan?: string | null
    notes?: string | null
  } | null
  latestVitals?: {
    blood_pressure_systolic?: number | null
    blood_pressure_diastolic?: number | null
    heart_rate?: number | null
    temperature?: number | null
    respiratory_rate?: number | null
    oxygen_saturation?: number | null
  } | null
  recentPrescriptions?: Array<{ medication_name?: string | null; dosage?: string | null; frequency?: string | null; status?: string | null }>
  recentLabResults?: Array<{ test_name?: string | null; results?: string | null; status?: string | null }>
  requestedProcedures?: Array<{ name?: string | null; status?: string | null; reason?: string | null; notes?: string | null; followUpInstructions?: string | null }>
  instructions?: string | null
  followUpRequirements?: string | null
}

function getReferralSnapshot(value: ReferralRow["handoff_snapshot"]): ReferralHandoffSnapshot | null {
  if (!value) return null
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as ReferralHandoffSnapshot
  } catch {
    return null
  }
}

interface LabRow {
  id: string
  testName: string
  status: string
  priority: string
  orderedAt: string
}

interface PrescriptionRow {
  id: string
  medication_name: string
  dosage: string
  frequency: string
  status: string
  created_at: string
}

export function MidwifePatientRecords() {
  const { searchPatients, getPatient } = usePatients()
  const { user } = useAuth()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [obsHistory, setObsHistory] = useState<ObsAssessment[]>([])
  const [laborHistory, setLaborHistory] = useState<LaborRecord[]>([])
  const [laborVitalsHistory, setLaborVitalsHistory] = useState<LaborVitalEvent[]>([])
  const [postnatalHistory, setPostnatalHistory] = useState<PostnatalVisit[]>([])
  const [familyPlanningHistory, setFamilyPlanningHistory] = useState<FamilyPlanningEvent[]>([])
  const [immunizationHistory, setImmunizationHistory] = useState<ImmunizationRow[]>([])
  const [referralHistory, setReferralHistory] = useState<ReferralRow[]>([])
  const [labHistory, setLabHistory] = useState<LabRow[]>([])
  const [prescriptionHistory, setPrescriptionHistory] = useState<PrescriptionRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const debounceRef = useCallback((val: string) => {
    setQuery(val)
    clearTimeout((debounceRef as unknown as { _t?: ReturnType<typeof setTimeout> })._t)
    ;(debounceRef as unknown as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedQuery(val), 300)
  }, [])

  const results = debouncedQuery.length >= 2 ? searchPatients(debouncedQuery).slice(0, 12) : []

  const openPatient = async (p: PatientRow) => {
    setSelectedPatient(p)
    setSheetOpen(true)
    setLoadingHistory(true)
    try {
      const [obsRes, laborRes, laborVitalsRes, postnatalRes, fpRes, immRes, refRes, labRes, rxRes] = await Promise.all([
        fetch(`/api/obstetrics/visits?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/labor?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/labor/vitals?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/postnatal?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/family-planning?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/medical/immunizations?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/referrals?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/lab-tests?patientId=${p.id}&limit=50`, { credentials: "include" }),
        fetch(`/api/medical/prescription-history?patientId=${p.id}&limit=50`, { credentials: "include" }),
      ])
      const [obsData, laborData, laborVitalsData, postnatalData, fpData, immData, refData, labData, rxData] = await Promise.all([
        obsRes.ok ? obsRes.json() : { visits: [] },
        laborRes.ok ? laborRes.json() : { records: [] },
        laborVitalsRes.ok ? laborVitalsRes.json() : { events: [] },
        postnatalRes.ok ? postnatalRes.json() : { visits: [] },
        fpRes.ok ? fpRes.json() : { events: [] },
        immRes.ok ? immRes.json() : { immunizations: [] },
        refRes.ok ? refRes.json() : { referrals: [] },
        labRes.ok ? labRes.json() : { tests: [] },
        rxRes.ok ? rxRes.json() : { prescriptions: [] },
      ])
      setObsHistory(Array.isArray(obsData.visits) ? obsData.visits : [])
      setLaborHistory(Array.isArray(laborData.records) ? laborData.records : [])
      setLaborVitalsHistory(Array.isArray(laborVitalsData.events) ? laborVitalsData.events : [])
      setPostnatalHistory(Array.isArray(postnatalData.visits) ? postnatalData.visits : [])
      setFamilyPlanningHistory(Array.isArray(fpData.events) ? fpData.events : [])
      setImmunizationHistory(Array.isArray(immData.immunizations) ? immData.immunizations : [])
      setReferralHistory(Array.isArray(refData.referrals) ? refData.referrals : [])
      setLabHistory(Array.isArray(labData.tests) ? labData.tests : [])
      setPrescriptionHistory(Array.isArray(rxData.prescriptions) ? rxData.prescriptions : [])
    } catch { toast.error("Failed to load patient history") }
    finally { setLoadingHistory(false) }
  }

  const updateReferralStatus = async (referralId: string, status: "accepted" | "completed") => {
    try {
      const res = await fetch(`/api/referrals/${encodeURIComponent(referralId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update handoff status")
      setReferralHistory((current) => current.map((referral) =>
        referral.id === referralId ? { ...referral, status } : referral
      ))
      toast.success(status === "accepted" ? "Handoff accepted" : "Handoff completed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update handoff status")
    }
  }

  useEffect(() => {
    const onOpenPatient = async (event: Event) => {
      const custom = event as CustomEvent<{ patientId?: string }>
      const patientId = custom.detail?.patientId
      if (!patientId) return

      const local = getPatient(patientId)
      if (local) {
        await openPatient({
          id: local.id,
          first_name: local.firstName || "",
          last_name: local.lastName || "",
          patient_number: local.patientNumber || "",
        })
        return
      }

      try {
        const res = await fetch(`/api/patients?id=${patientId}&limit=1`, { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        const row = Array.isArray(data?.patients) ? data.patients[0] : null
        if (!row) return
        await openPatient({
          id: row.id,
          first_name: row.first_name || "",
          last_name: row.last_name || "",
          patient_number: row.patient_number || "",
        })
      } catch {
        // Best-effort listener: avoid surfacing noisy toasts from background event handling.
      }
    }

    window.addEventListener("midwife:open-patient", onOpenPatient as EventListener)
    return () => {
      window.removeEventListener("midwife:open-patient", onOpenPatient as EventListener)
    }
  }, [getPatient])

  return (
    <div className="space-y-4 p-1">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Patient Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
            <Input
              className="pl-9 focus-visible:ring-rose-400"
              placeholder="Search by name or patient number…"
              value={query}
              onChange={(e) => debounceRef(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {debouncedQuery.length >= 2 && (
        <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
          <CardContent className="p-0">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No patients found.</p>
            ) : (
              <div className="divide-y divide-rose-50">
                {results.map((p) => {
                  const fn = (p as { firstName?: string; first_name?: string }).firstName || (p as { first_name?: string }).first_name || ""
                  const ln = (p as { lastName?: string; last_name?: string }).lastName || (p as { last_name?: string }).last_name || ""
                  const pn = (p as { patientNumber?: string; patient_number?: string }).patientNumber || (p as { patient_number?: string }).patient_number || ""
                  return (
                    <button key={p.id} type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-rose-50/30 transition-colors"
                      onClick={() => openPatient({ id: p.id, first_name: fn, last_name: ln, patient_number: pn })}>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{fn} {ln}</p>
                        <p className="text-xs text-slate-400">#{pn}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-rose-400" />
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto border-l border-rose-100">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-rose-800">
              {selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : ""}
            </SheetTitle>
            {selectedPatient?.patient_number && <p className="text-xs text-slate-400">Patient #{selectedPatient.patient_number}</p>}
          </SheetHeader>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> Loading history…
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> ANC Assessments ({obsHistory.length})
                </h3>
                {obsHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No assessments on record.</p> : (
                  <div className="space-y-2">
                    {obsHistory.map((a) => (
                      <div key={a.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{String(a.visit_date).slice(0, 10)}</p>
                        <p className="text-slate-500 mt-0.5">
                          G{a.gravida ?? "?"} P{a.parity ?? "?"} · {a.gestational_age_weeks != null ? `${a.gestational_age_weeks} wks` : "—"}
                          {a.edd ? ` · EDD ${String(a.edd).slice(0, 10)}` : ""}
                          {a.fetal_heart_rate ? ` · FHR ${a.fetal_heart_rate}` : ""}
                        </p>
                        {a.notes && <p className="text-slate-400 mt-0.5 italic truncate">{a.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <Baby className="h-3.5 w-3.5" /> Labor & Delivery ({laborHistory.length})
                </h3>
                {laborHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No delivery records.</p> : (
                  <div className="space-y-2">
                    {laborHistory.map((lr) => (
                      <div key={lr.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">Admitted {String(lr.admission_date).slice(0, 10)}</p>
                        <p className="text-slate-500 mt-0.5">
                          {lr.delivery_type ?? "Delivery type not recorded"}
                          {lr.delivery_date ? ` · ${String(lr.delivery_date).slice(0, 10)}` : ""}
                        </p>
                        {lr.baby_birth_weight_g && (
                          <p className="text-slate-400 mt-0.5">
                            Baby: {lr.baby_birth_weight_g}g
                            {lr.baby_apgar_1min != null ? ` · APGAR 1min: ${lr.baby_apgar_1min}` : ""}
                            {lr.baby_apgar_5min != null ? ` · 5min: ${lr.baby_apgar_5min}` : ""}
                            {lr.baby_condition ? ` · ${lr.baby_condition}` : ""}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> Labor Vitals ({laborVitalsHistory.length})
                </h3>
                {laborVitalsHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No repeated labor vitals on record.</p> : (
                  <div className="space-y-2">
                    {laborVitalsHistory.slice(0, 10).map((lv) => (
                      <div key={lv.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{String(lv.measured_at).slice(0, 16).replace("T", " ")}</p>
                        <p className="text-slate-500 mt-0.5">
                          {lv.bp_systolic && lv.bp_diastolic ? `BP ${lv.bp_systolic}/${lv.bp_diastolic}` : "BP not recorded"}
                          {lv.pulse_rate ? ` · PR ${lv.pulse_rate}` : ""}
                          {lv.respiratory_rate ? ` · RR ${lv.respiratory_rate}` : ""}
                          {lv.temperature_c != null ? ` · Temp ${lv.temperature_c}C` : ""}
                          {lv.fetal_heart_rate ? ` · FHR ${lv.fetal_heart_rate}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <HeartPulse className="h-3.5 w-3.5" /> Postnatal Visits ({postnatalHistory.length})
                </h3>
                {postnatalHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No postnatal visits on record.</p> : (
                  <div className="space-y-2">
                    {postnatalHistory.map((pv) => (
                      <div key={pv.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">
                          {String(pv.visit_date).slice(0, 10)}
                          {pv.days_postpartum != null ? ` (Day ${pv.days_postpartum})` : ""}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {pv.bp_systolic && pv.bp_diastolic ? `BP ${pv.bp_systolic}/${pv.bp_diastolic}` : "BP not recorded"}
                          {pv.temperature_c != null ? ` · Temp ${pv.temperature_c}C` : ""}
                          {pv.pulse_rate != null ? ` · PR ${pv.pulse_rate}/min` : ""}
                          {pv.respiratory_rate != null ? ` · RR ${pv.respiratory_rate}/min` : ""}
                          {pv.weight_kg != null ? ` · Weight ${pv.weight_kg}kg` : ""}
                          {pv.lochia ? ` · Lochia: ${pv.lochia}` : ""}
                          {pv.baby_weight_g ? ` · Baby ${pv.baby_weight_g}g` : ""}
                        </p>
                        {(pv.newborn_patient_number || pv.newborn_patient_name) && (
                          <p className="text-slate-500 mt-0.5">
                            Newborn: {pv.newborn_patient_number ? `#${pv.newborn_patient_number}` : "Linked"}
                            {pv.newborn_patient_name ? ` (${pv.newborn_patient_name})` : ""}
                          </p>
                        )}
                        {pv.nutrition_assessment && <p className="text-slate-400 mt-0.5">Nutrition: {pv.nutrition_assessment}</p>}
                        {pv.mother_nutrition_status && <p className="text-slate-400 mt-0.5">Maternal status: {pv.mother_nutrition_status}</p>}
                        {pv.nutrition_intake && <p className="text-slate-400 mt-0.5">Diet/appetite: {pv.nutrition_intake}</p>}
                        {pv.nutrition_food_access && <p className="text-slate-400 mt-0.5">Food access: {pv.nutrition_food_access}</p>}
                        {pv.nutrition_supplements && <p className="text-slate-400 mt-0.5">Supplements: {pv.nutrition_supplements}</p>}
                        {pv.nutrition_counselling && <p className="text-slate-400 mt-0.5">Nutrition action: {pv.nutrition_counselling}</p>}
                        {(pv.newborn_feeding_status || pv.cord_status) && (
                          <p className="text-slate-400 mt-0.5">
                            {pv.newborn_feeding_status ? `Feeding: ${pv.newborn_feeding_status}` : ""}
                            {pv.newborn_feeding_status && pv.cord_status ? " · " : ""}
                            {pv.cord_status ? `Cord: ${pv.cord_status}` : ""}
                          </p>
                        )}
                        {pv.general_assessment && <p className="text-slate-400 mt-0.5">Assessment: {pv.general_assessment}</p>}
                        {pv.other_observations && <p className="text-slate-400 mt-0.5">Other observations: {pv.other_observations}</p>}
                        {pv.cord_assessment && <p className="text-slate-400 mt-0.5">Cord findings: {pv.cord_assessment}</p>}
                        {pv.cord_care_provided && <p className="text-slate-400 mt-0.5">Cord care: {pv.cord_care_provided}</p>}
                        {pv.cord_advice && <p className="text-slate-400 mt-0.5">Cord advice: {pv.cord_advice}</p>}
                        {pv.cord_concerns && <p className="text-slate-400 mt-0.5">Cord concerns: {pv.cord_concerns}</p>}
                        {pv.cord_follow_up && <p className="text-slate-400 mt-0.5">Cord follow-up: {pv.cord_follow_up}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <HeartPulse className="h-3.5 w-3.5" /> Family Planning ({familyPlanningHistory.length})
                </h3>
                {familyPlanningHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No family planning events on record.</p> : (
                  <div className="space-y-2">
                    {familyPlanningHistory.slice(0, 10).map((fp) => (
                      <div key={fp.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">
                          {String(fp.encounter_date).slice(0, 10)} · {fp.event_type.replace("_", " ")}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {fp.method ?? "Method not recorded"}
                          {fp.status ? ` · ${fp.status}` : ""}
                          {fp.is_postpartum ? " · Postpartum" : ""}
                          {fp.postpartum_weeks != null ? ` · ${fp.postpartum_weeks} weeks` : ""}
                        </p>
                        {fp.reason && <p className="text-slate-400 mt-0.5 truncate">{fp.reason}</p>}
                        {fp.removal_reason && <p className="text-slate-400 mt-0.5 truncate">Removal reason: {fp.removal_reason}</p>}
                        {fp.replacement_method && <p className="text-slate-400 mt-0.5 truncate">Replacement: {fp.replacement_method}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <Syringe className="h-3.5 w-3.5" /> Immunizations ({immunizationHistory.length})
                </h3>
                {immunizationHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No immunizations on record.</p> : (
                  <div className="space-y-2">
                    {immunizationHistory.slice(0, 8).map((im) => (
                      <div key={im.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{im.vaccine_name}</p>
                        <p className="text-slate-500 mt-0.5">
                          {String(im.date_administered).slice(0, 10)}
                          {im.dose ? ` · ${im.dose}` : ""}
                          {im.status ? ` · ${im.status}` : ""}
                          {im.next_due_date ? ` · Next due ${String(im.next_due_date).slice(0, 10)}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Referrals ({referralHistory.length})
                </h3>
                {referralHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No referrals on record.</p> : (
                  <div className="space-y-2">
                    {referralHistory.slice(0, 8).map((rf) => (
                      <div key={rf.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{rf.type} · {rf.urgency}</p>
                        <p className="text-slate-500 mt-0.5">
                          {rf.receiving_department || "Department not specified"}
                          {rf.status ? ` · ${rf.status}` : ""}
                        </p>
                        <p className="text-slate-400 mt-0.5 truncate">{rf.reason}</p>
                        {rf.type === "internal" && (
                          <div className="mt-2">
                            {rf.status === "pending" && (rf.receiving_user_id === user?.id || (!rf.receiving_user_id && rf.receiving_department?.toLowerCase() === user?.role.toLowerCase())) && (
                              <Button size="sm" onClick={() => void updateReferralStatus(rf.id, "accepted")}>Accept Handoff</Button>
                            )}
                            {rf.status === "accepted" && (rf.receiving_user_id === user?.id || (!rf.receiving_user_id && rf.receiving_department?.toLowerCase() === user?.role.toLowerCase())) && (
                              <Button size="sm" variant="outline" onClick={() => void updateReferralStatus(rf.id, "completed")}>Complete Handoff</Button>
                            )}
                          </div>
                        )}
                        {(() => {
                          const snapshot = getReferralSnapshot(rf.handoff_snapshot)
                          if (!snapshot) return null
                          const clinical = snapshot.latestClinicalRecord
                          const vitals = snapshot.latestVitals
                          return (
                            <div className="mt-2 space-y-1 border-t border-rose-100 pt-2 text-slate-600">
                              {clinical?.chief_complaint && <p><strong>Complaint:</strong> {clinical.chief_complaint}</p>}
                              {clinical?.history && <p><strong>Relevant history:</strong> {clinical.history}</p>}
                              {clinical?.impression && <p><strong>Impression:</strong> {clinical.impression}</p>}
                              {clinical?.diagnosis && <p><strong>Diagnosis:</strong> {clinical.diagnosis}</p>}
                              {clinical?.treatment_plan && <p><strong>Plan:</strong> {clinical.treatment_plan}</p>}
                              {snapshot.instructions && <p><strong>Instructions:</strong> {snapshot.instructions}</p>}
                              {vitals && <p><strong>Latest vitals:</strong> {[
                                vitals.blood_pressure_systolic != null && vitals.blood_pressure_diastolic != null ? `BP ${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}` : "",
                                vitals.temperature != null ? `Temp ${vitals.temperature}` : "",
                                vitals.heart_rate != null ? `HR ${vitals.heart_rate}` : "",
                                vitals.respiratory_rate != null ? `RR ${vitals.respiratory_rate}` : "",
                                vitals.oxygen_saturation != null ? `SpO2 ${vitals.oxygen_saturation}%` : "",
                              ].filter(Boolean).join(" · ")}</p>}
                              {snapshot.recentPrescriptions?.length ? <p><strong>Medications:</strong> {snapshot.recentPrescriptions.slice(0, 5).map((rx) =>
                                [rx.medication_name, rx.dosage, rx.frequency, rx.status].filter(Boolean).join(" ")).join("; ")}</p> : null}
                              {snapshot.recentLabResults?.length ? <p><strong>Lab results:</strong> {snapshot.recentLabResults.slice(0, 5).map((lab) =>
                                [lab.test_name, lab.status, lab.results].filter(Boolean).join(" — ")).join("; ")}</p> : null}
                              {snapshot.requestedProcedures?.length ? <p><strong>Procedures:</strong> {snapshot.requestedProcedures.map((procedure) =>
                                [procedure.name, procedure.status, procedure.reason, procedure.notes, procedure.followUpInstructions].filter(Boolean).join(" — ")).join("; ")}</p> : null}
                              {snapshot.followUpRequirements && <p><strong>Follow-up:</strong> {snapshot.followUpRequirements}</p>}
                            </div>
                          )
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <FlaskConical className="h-3.5 w-3.5" /> Lab Orders ({labHistory.length})
                </h3>
                {labHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No lab orders on record.</p> : (
                  <div className="space-y-2">
                    {labHistory.slice(0, 8).map((lb) => (
                      <div key={lb.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{lb.testName}</p>
                        <p className="text-slate-500 mt-0.5">
                          {String(lb.orderedAt).slice(0, 10)} · {lb.priority} · {lb.status}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2 flex items-center gap-1">
                  <Pill className="h-3.5 w-3.5" /> Prescriptions ({prescriptionHistory.length})
                </h3>
                {prescriptionHistory.length === 0 ? <p className="text-xs text-muted-foreground pl-1">No prescriptions on record.</p> : (
                  <div className="space-y-2">
                    {prescriptionHistory.slice(0, 8).map((rx) => (
                      <div key={rx.id} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2 text-xs">
                        <p className="font-medium text-slate-700">{rx.medication_name}</p>
                        <p className="text-slate-500 mt-0.5">
                          {rx.dosage} · {rx.frequency} · {rx.status}
                        </p>
                        <p className="text-slate-400 mt-0.5">{String(rx.created_at).slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
