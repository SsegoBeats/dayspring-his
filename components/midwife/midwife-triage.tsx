"use client"
import { useEffect, useMemo, useState } from "react"
import { Activity, ClipboardList, Users } from "lucide-react"
import { toast } from "sonner"
import { TriageForm } from "@/components/patient/triage-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { usePatients } from "@/lib/patient-context"

interface PatientOption {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
  triageCategory?: string | null
  status?: string | null
}

interface QueueEntry {
  id: string
  patient_id: string
  patient_number: string | null
  first_name: string
  last_name: string
  priority: number | null
  waiting_minutes: number | null
  in_service_minutes: number | null
}

interface CentralFlowState {
  waitingCount: number
  inServiceCount: number
  checkinsToday: number
  waiting: QueueEntry[]
  inService: QueueEntry[]
  restricted: boolean
}

function PatientSearch({ value, onChange }: { value: PatientOption | null; onChange: (p: PatientOption | null) => void }) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 10) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient for triage..."
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
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-rose-100 bg-white shadow-lg max-h-56 overflow-y-auto">
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
                  onChange({
                    id: p.id,
                    patientNumber: pn,
                    firstName: fn,
                    lastName: ln,
                    triageCategory: (p as { triageCategory?: string | null }).triageCategory ?? null,
                    status: (p as { status?: string | null }).status ?? null,
                  })
                  setOpen(false)
                  setQuery("")
                }}
              >
                <span className="font-medium text-slate-700">{fn} {ln}</span>
                <span className="ml-2 text-xs text-slate-400">{pn}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function triageVariant(category?: string | null): "destructive" | "default" | "secondary" {
  if (!category) return "secondary"
  if (category === "Emergency" || category === "Very Urgent") return "destructive"
  if (category === "Urgent") return "default"
  return "secondary"
}

export function MidwifeTriage() {
  const { patients, refreshPatients, loadingPatients } = usePatients()
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [lastSavedCategory, setLastSavedCategory] = useState<string | null>(null)
  const [centralFlow, setCentralFlow] = useState<CentralFlowState>({
    waitingCount: 0,
    inServiceCount: 0,
    checkinsToday: 0,
    waiting: [],
    inService: [],
    restricted: false,
  })

  const flow = useMemo(() => {
    const summary = {
      totalVisible: patients.length,
      emergency: 0,
      veryUrgent: 0,
      urgent: 0,
      routine: 0,
    }

    for (const p of patients) {
      const triage = (p.triageCategory || "").trim()
      if (triage === "Emergency") summary.emergency += 1
      else if (triage === "Very Urgent") summary.veryUrgent += 1
      else if (triage === "Urgent") summary.urgent += 1
      else if (triage) summary.routine += 1
    }

    return summary
  }, [patients])

  const latestHighRisk = useMemo(() => {
    return patients
      .filter((p) => p.triageCategory === "Emergency" || p.triageCategory === "Very Urgent" || p.triageCategory === "Urgent")
      .slice(0, 8)
  }, [patients])

  const lanePreview = useMemo(() => {
    return [...centralFlow.waiting, ...centralFlow.inService]
      .sort((a, b) => {
        const prioA = a.priority ?? 0
        const prioB = b.priority ?? 0
        if (prioA !== prioB) return prioB - prioA
        const waitA = a.waiting_minutes ?? a.in_service_minutes ?? 0
        const waitB = b.waiting_minutes ?? b.in_service_minutes ?? 0
        return waitB - waitA
      })
      .slice(0, 8)
  }, [centralFlow.waiting, centralFlow.inService])

  async function loadCentralFlow(showErrorToast = false) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [waitingRes, inServiceRes, checkinsRes] = await Promise.all([
        fetch("/api/queues?status=waiting", { credentials: "include" }),
        fetch("/api/queues?status=in_service", { credentials: "include" }),
        fetch(`/api/checkins?date=${today}`, { credentials: "include" }),
      ])

      const restricted = [waitingRes, inServiceRes, checkinsRes].some((r) => r.status === 401 || r.status === 403)

      const waitingData = waitingRes.ok ? await waitingRes.json().catch(() => ({ queue: [] })) : { queue: [] }
      const inServiceData = inServiceRes.ok ? await inServiceRes.json().catch(() => ({ queue: [] })) : { queue: [] }
      const checkinsData = checkinsRes.ok ? await checkinsRes.json().catch(() => ({ checkins: [] })) : { checkins: [] }

      setCentralFlow({
        waitingCount: Array.isArray(waitingData.queue) ? waitingData.queue.length : 0,
        inServiceCount: Array.isArray(inServiceData.queue) ? inServiceData.queue.length : 0,
        checkinsToday: Array.isArray(checkinsData.checkins) ? checkinsData.checkins.length : 0,
        waiting: Array.isArray(waitingData.queue) ? waitingData.queue : [],
        inService: Array.isArray(inServiceData.queue) ? inServiceData.queue : [],
        restricted,
      })
    } catch {
      if (showErrorToast) toast.error("Failed to refresh central flow status")
      setCentralFlow((prev) => ({ ...prev, restricted: true }))
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadCentralFlow(false)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  async function refreshFlow() {
    try {
      await Promise.all([refreshPatients(), loadCentralFlow(false)])
    } catch {
      toast.error("Failed to refresh flow status")
    }
  }

  return (
    <div className="space-y-4 p-1">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-700">Midwife Triage</CardTitle>
              <CardDescription className="text-xs">Run standardized triage and view in-context patient flow pressure.</CardDescription>
            </div>
            <button
              type="button"
              onClick={() => void refreshFlow()}
              className="text-xs rounded-lg border border-rose-200 px-2 py-1 text-rose-700 hover:bg-rose-50"
            >
              Refresh Flow
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-rose-700">Emergency</p>
              <p className="text-xl font-semibold text-slate-800">{flow.emergency}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-rose-700">Very Urgent</p>
              <p className="text-xl font-semibold text-slate-800">{flow.veryUrgent}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-rose-700">Urgent</p>
              <p className="text-xl font-semibold text-slate-800">{flow.urgent}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
              <p className="text-[11px] uppercase tracking-wide text-rose-700">Routine</p>
              <p className="text-xl font-semibold text-slate-800">{flow.routine}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total Visible</p>
              <p className="text-lg font-semibold text-slate-800">{flow.totalVisible}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Waiting Lane</p>
              <p className="text-lg font-semibold text-slate-800">{centralFlow.waitingCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">In Service</p>
              <p className="text-lg font-semibold text-slate-800">{centralFlow.inServiceCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Check-ins Today</p>
              <p className="text-lg font-semibold text-slate-800">{centralFlow.checkinsToday}</p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/20 p-3">
            <p className="text-xs font-medium text-rose-700 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Select Patient for Triage</p>
            <div className="mt-2">
              <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
            </div>
            {selectedPatient && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-600">Current category:</span>
                <Badge variant={triageVariant(selectedPatient.triageCategory)}>{selectedPatient.triageCategory || "Not triaged"}</Badge>
                {lastSavedCategory && <span className="text-rose-700">Latest saved: {lastSavedCategory}</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {selectedPatient ? (
            <TriageForm
              patientId={selectedPatient.id}
              onSaved={(category) => {
                setLastSavedCategory(category)
                toast.success(`Saved triage as ${category}`)
                void refreshFlow()
              }}
            />
          ) : (
            <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
              <CardContent className="py-16 text-center text-sm text-slate-500">
                Choose a patient above to begin triage assessment.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-rose-600" /> Priority Queue Snapshot</CardTitle>
              <CardDescription className="text-xs">Patients currently flagged by high triage urgency.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingPatients ? (
                <p className="text-xs text-muted-foreground">Loading flow data...</p>
              ) : latestHighRisk.length === 0 ? (
                <p className="text-xs text-muted-foreground">No urgent triage flags in current visible list.</p>
              ) : (
                latestHighRisk.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatient({
                        id: p.id,
                        patientNumber: p.patientNumber || "",
                        firstName: p.firstName,
                        lastName: p.lastName,
                        triageCategory: p.triageCategory,
                        status: p.status,
                      })
                    }}
                    className="w-full rounded-lg border border-rose-100 bg-rose-50/30 px-3 py-2 text-left hover:bg-rose-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-700">{p.firstName} {p.lastName}</p>
                      <Badge variant={triageVariant(p.triageCategory)}>{p.triageCategory || "N/A"}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{p.patientNumber || "-"} · {p.status || "unknown status"}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Activity className="h-4 w-4 text-rose-600" /> Central Flow Lane</CardTitle>
              <CardDescription className="text-xs">Recent queue lane entries from central flow APIs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {centralFlow.restricted && lanePreview.length === 0 ? (
                <p className="text-xs text-muted-foreground">Queue lane metrics are restricted for your role in this environment.</p>
              ) : lanePreview.length === 0 ? (
                <p className="text-xs text-muted-foreground">No waiting or in-service queue entries right now.</p>
              ) : (
                lanePreview.map((entry) => {
                  const lane = entry.in_service_minutes != null ? "In service" : "Waiting"
                  const mins = entry.in_service_minutes != null ? entry.in_service_minutes : entry.waiting_minutes
                  return (
                    <div key={entry.id} className="rounded-lg border border-rose-100 bg-rose-50/20 px-3 py-2">
                      <p className="text-xs font-medium text-slate-700">{entry.first_name} {entry.last_name}</p>
                      <p className="text-[11px] text-slate-500">
                        {entry.patient_number || "-"} · {lane}
                        {typeof mins === "number" ? ` · ${Math.round(mins)} min` : ""}
                        {entry.priority != null ? ` · P${entry.priority}` : ""}
                      </p>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
