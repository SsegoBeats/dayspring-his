"use client"
import { useCallback, useState } from "react"
import { Search, ChevronRight, Loader2, ClipboardList, Baby, HeartPulse } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { usePatients } from "@/lib/patient-context"

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
  lochia: string | null
  baby_weight_g: number | null
}

export function MidwifePatientRecords() {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [obsHistory, setObsHistory] = useState<ObsAssessment[]>([])
  const [laborHistory, setLaborHistory] = useState<LaborRecord[]>([])
  const [postnatalHistory, setPostnatalHistory] = useState<PostnatalVisit[]>([])
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
      const [obsRes, laborRes, postnatalRes] = await Promise.all([
        fetch(`/api/obstetrics/visits?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/labor?patientId=${p.id}`, { credentials: "include" }),
        fetch(`/api/postnatal?patientId=${p.id}`, { credentials: "include" }),
      ])
      const [obsData, laborData, postnatalData] = await Promise.all([
        obsRes.ok ? obsRes.json() : { visits: [] },
        laborRes.ok ? laborRes.json() : { records: [] },
        postnatalRes.ok ? postnatalRes.json() : { visits: [] },
      ])
      setObsHistory(Array.isArray(obsData.visits) ? obsData.visits : [])
      setLaborHistory(Array.isArray(laborData.records) ? laborData.records : [])
      setPostnatalHistory(Array.isArray(postnatalData.visits) ? postnatalData.visits : [])
    } catch { toast.error("Failed to load patient history") }
    finally { setLoadingHistory(false) }
  }

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
                          {pv.lochia ? ` · Lochia: ${pv.lochia}` : ""}
                          {pv.baby_weight_g ? ` · Baby ${pv.baby_weight_g}g` : ""}
                        </p>
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
