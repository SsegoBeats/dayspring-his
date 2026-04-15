"use client"

import { useState } from "react"
import { usePatients } from "@/lib/patient-context"
import { useNursing } from "@/lib/nursing-context"
import { useAuth } from "@/lib/auth-context"
import { formatPatientNumber } from "@/lib/patients"
import { hasCriticalVitals, parseBloodPressure } from "@/lib/vital-signs-validation"
import { fmtBP, fmtTemp, fmtBpm, fmtRR, fmtSpO2 } from "@/lib/vital-formatting"
import { NurseNotificationBell } from "@/components/nursing/nurse-notification-bell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Stethoscope, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface PatientCareListProps {
  onSelectPatient: (patientId: string, tab?: "vitals" | "notes" | "history" | "triage") => void
}

const TRIAGE_BORDER: Record<string, string> = {
  Emergency: "border-l-[3px] border-red-500",
  "Very Urgent": "border-l-[3px] border-orange-500",
  Urgent: "border-l-[3px] border-amber-500",
  Routine: "border-l-[3px] border-emerald-500",
}

export function PatientCareList({ onSelectPatient }: PatientCareListProps) {
  const { patients, searchPatients, loadingPatients } = usePatients()
  const { getLatestVitals, refreshPatient } = useNursing()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkVitals, setBulkVitals] = useState({
    bloodPressure: "",
    temperature: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    notes: "",
  })
  const [bulkSaving, setBulkSaving] = useState(false)

  const hasAnyBulkField = !!(
    bulkVitals.bloodPressure ||
    bulkVitals.temperature ||
    bulkVitals.heartRate ||
    bulkVitals.respiratoryRate ||
    bulkVitals.oxygenSaturation ||
    bulkVitals.notes
  )

  const displayedPatients = searchQuery ? searchPatients(searchQuery) : patients

  const getPatientAge = (patient: (typeof patients)[number]): number | null => {
    try {
      if (patient.ageYears) return patient.ageYears
      if (!patient.dateOfBirth) return null
      const dob = new Date(patient.dateOfBirth)
      const now = new Date()
      return (
        now.getFullYear() -
        dob.getFullYear() -
        (now.getMonth() < dob.getMonth() ||
        (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
          ? 1
          : 0)
      )
    } catch {
      return null
    }
  }

  if (loadingPatients) {
    return (
      <Card className="rounded-2xl border-l-4 border-violet-600 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">Patient Care</CardTitle>
        </CardHeader>
        <CardContent className="py-10">
          <div className="flex items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-500" />
            Loading patients...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-l-4 border-violet-600 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">Patient Care</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">
            Select a patient to record vitals, add notes, or complete triage.
          </p>
        </div>
        <NurseNotificationBell />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
          <Input
            id="patient-care-search"
            name="patientCareSearch"
            aria-label="Search patients"
            placeholder="Search patients by name, ID, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 focus-visible:ring-violet-400"
          />
        </div>

        {/* Bulk vitals panel */}
        {selectedIds.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="text-sm font-semibold text-violet-700">
              Recording for {selectedIds.length} selected patient{selectedIds.length !== 1 ? "s" : ""}
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <Input
                id="bulk-vitals-bp"
                name="bulkVitalsBloodPressure"
                aria-label="Bulk blood pressure"
                placeholder="BP (e.g., 120/80)"
                value={bulkVitals.bloodPressure}
                onChange={(e) => setBulkVitals({ ...bulkVitals, bloodPressure: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, bloodPressure: fmtBP(v.bloodPressure) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-temp"
                name="bulkVitalsTemperature"
                aria-label="Bulk temperature"
                placeholder="Temp (C)"
                value={bulkVitals.temperature}
                onChange={(e) => setBulkVitals({ ...bulkVitals, temperature: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, temperature: fmtTemp(v.temperature) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-hr"
                name="bulkVitalsHeartRate"
                aria-label="Bulk heart rate"
                placeholder="HR (bpm)"
                value={bulkVitals.heartRate}
                onChange={(e) => setBulkVitals({ ...bulkVitals, heartRate: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, heartRate: fmtBpm(v.heartRate) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-rr"
                name="bulkVitalsRespiratoryRate"
                aria-label="Bulk respiratory rate"
                placeholder="RR (/min)"
                value={bulkVitals.respiratoryRate}
                onChange={(e) => setBulkVitals({ ...bulkVitals, respiratoryRate: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, respiratoryRate: fmtRR(v.respiratoryRate) }))}
                className="focus-visible:ring-violet-400"
              />
              <Input
                id="bulk-vitals-spo2"
                name="bulkVitalsOxygenSaturation"
                aria-label="Bulk oxygen saturation"
                placeholder="SpO2 (%)"
                value={bulkVitals.oxygenSaturation}
                onChange={(e) => setBulkVitals({ ...bulkVitals, oxygenSaturation: e.target.value })}
                onBlur={() => setBulkVitals((v) => ({ ...v, oxygenSaturation: fmtSpO2(v.oxygenSaturation) }))}
                className="focus-visible:ring-violet-400"
              />
            </div>
            <Input
              id="bulk-vitals-notes"
              name="bulkVitalsNotes"
              placeholder="Notes (optional)"
              value={bulkVitals.notes}
              onChange={(e) => setBulkVitals({ ...bulkVitals, notes: e.target.value })}
              className="focus-visible:ring-violet-400"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedIds([])} disabled={bulkSaving}>
                Clear Selection
              </Button>
              <Button
                className="bg-violet-700 hover:bg-violet-800 text-white"
                onClick={async () => {
                  if (!user) { toast.error("Not authenticated"); return }
                  if (!hasAnyBulkField) { toast.error("Enter at least one vital sign"); return }
                  setBulkSaving(true)
                  let ok = 0
                  let fail = 0
                  const refreshPromises: Promise<void>[] = []
                  try {
                    for (const id of selectedIds) {
                      const patient = patients.find((x) => x.id === id)
                      if (!patient) { fail++; continue }
                      try {
                        const res = await fetch("/api/vitals", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            patientId: id,
                            bloodPressure: bulkVitals.bloodPressure,
                            temperature: bulkVitals.temperature,
                            heartRate: bulkVitals.heartRate,
                            respiratoryRate: bulkVitals.respiratoryRate,
                            oxygenSaturation: bulkVitals.oxygenSaturation,
                            notes: bulkVitals.notes || undefined,
                          }),
                        })
                        if (!res.ok) {
                          const errorData = await res.json().catch(() => ({}))
                          throw new Error(errorData.error || "Failed to record vitals")
                        }
                        ok++
                        refreshPromises.push(refreshPatient(id).catch(() => {}))
                      } catch (error: unknown) {
                        fail++
                        const msg = error instanceof Error ? error.message : "Error"
                        toast.error(`Failed for ${patient.firstName} ${patient.lastName}`, {
                          description: msg,
                        })
                      }
                    }
                    await Promise.all(refreshPromises)
                    if (ok) toast.success(`Recorded vitals for ${ok} patient(s)`)
                    if (fail && !ok) toast.error("Failed to record vitals for selected patients")
                    setSelectedIds([])
                    setBulkVitals({ bloodPressure: "", temperature: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", notes: "" })
                  } finally {
                    setBulkSaving(false)
                  }
                }}
                disabled={selectedIds.length === 0 || bulkSaving || !hasAnyBulkField}
              >
                {bulkSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Recording...</> : "Record Vitals"}
              </Button>
            </div>
          </div>
        )}

        {/* Patient table */}
        {displayedPatients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Search className="mb-3 h-8 w-8 text-violet-300" />
            {searchQuery ? (
              <>
                <p className="text-violet-400">No results for &quot;{searchQuery}&quot;</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              </>
            ) : (
              <p className="text-violet-400">No patients found</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <input
                      id="select-all-care"
                      name="selectAllCare"
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === displayedPatients.length}
                      aria-label="Select all"
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? displayedPatients.map((p) => p.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">P.ID</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Age</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Sex</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Blood</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Latest Vitals</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-violet-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedPatients.map((patient) => {
                  const lv = getLatestVitals(patient.id)
                  const pid = formatPatientNumber(patient.patientNumber)
                  const age = getPatientAge(patient)
                  const triage = String(patient.triageCategory || "").trim()
                  const triageBorderCls = TRIAGE_BORDER[triage] ?? "border-l-[3px] border-slate-200"

                  // Critical vitals detection
                  const bp = lv ? parseBloodPressure(String(lv.bloodPressure ?? "")) : { systolic: null, diastolic: null }
                  const isCritical = lv
                    ? hasCriticalVitals(
                        {
                          temperature: lv.temperature != null ? Number(lv.temperature) : null,
                          systolicBP: bp.systolic,
                          diastolicBP: bp.diastolic,
                          heartRate: lv.heartRate != null ? Number(lv.heartRate) : null,
                          respiratoryRate: lv.respiratoryRate != null ? Number(lv.respiratoryRate) : null,
                          oxygenSaturation: lv.oxygenSaturation != null ? Number(lv.oxygenSaturation) : null,
                        },
                        age
                      )
                    : false

                  const checked = selectedIds.includes(patient.id)

                  return (
                    <TableRow
                      key={patient.id}
                      className={`${triageBorderCls} ${isCritical ? "bg-fuchsia-50" : "hover:bg-violet-50"}`}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          id={`sel-${patient.id}`}
                          name={`select-${patient.id}`}
                          aria-label={`Select patient ${patient.firstName} ${patient.lastName}`}
                          checked={checked}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, patient.id] : prev.filter((x) => x !== patient.id)
                            )
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{pid}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isCritical && (
                            <span
                              className="inline-block h-2 w-2 animate-pulse rounded-full bg-fuchsia-500"
                              aria-label="Critical vitals"
                            />
                          )}
                          <span className="font-medium text-slate-900">
                            {patient.firstName} {patient.lastName}
                          </span>
                          {patient.allergies &&
                            typeof patient.allergies === "string" &&
                            patient.allergies.trim().toLowerCase() !== "none" && (
                              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                                Allergies
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">{age ?? "-"}</TableCell>
                      <TableCell className="text-sm text-slate-700">{patient.gender}</TableCell>
                      <TableCell className="text-sm text-slate-700">{patient.bloodGroup || "-"}</TableCell>
                      <TableCell>
                        {lv ? (
                          <div className="flex flex-wrap gap-1">
                            {lv.bloodPressure && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                BP {fmtBP(String(lv.bloodPressure))}
                              </span>
                            )}
                            {lv.temperature && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                {fmtTemp(String(lv.temperature))}
                              </span>
                            )}
                            {lv.heartRate && (
                              <span className="rounded bg-cyan-50 px-1.5 py-0.5 font-mono text-xs text-cyan-700">
                                {fmtBpm(String(lv.heartRate))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-violet-700 hover:bg-violet-800 text-white"
                            onClick={() => onSelectPatient(patient.id, "vitals")}
                          >
                            <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
                            Vitals
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-cyan-400 text-cyan-700 hover:bg-cyan-50"
                            onClick={() => onSelectPatient(patient.id, "notes")}
                          >
                            Note
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-400 text-orange-700 hover:bg-orange-50"
                            onClick={() => onSelectPatient(patient.id, "triage")}
                          >
                            Triage
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
