"use client"

import { useEffect, useMemo, useState } from "react"
import { Syringe, Printer, Download, Pencil } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"
import { useMedical, type Immunization } from "@/lib/medical-context"
import {
  computeDueDateFromDob,
  computeDueDateFromDobWithOffset,
  TIMING_BUCKETS,
  VACCINES_BY_TIMING,
  type ImmunizationStatus,
} from "@/lib/immunization-schedule"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PatientOption {
  id: string
  patientNumber?: string
  firstName: string
  lastName: string
  dateOfBirth?: string | null
}

type RuntimeSchedule = {
  buckets: string[]
  vaccinesByTiming: Record<string, string[]>
  dayOffsets: Record<string, number | null>
}

const STATUSES: ImmunizationStatus[] = [
  "Due",
  "Given",
  "Overdue",
  "Not Given",
  "Contraindicated",
  "Refused",
]

function PatientSearch({
  value,
  onChange,
}: {
  value: PatientOption | null
  onChange: (p: PatientOption | null) => void
}) {
  const { searchPatients } = usePatients()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const results = query.length >= 2 ? searchPatients(query).slice(0, 8) : []

  return (
    <div className="relative">
      <Input
        placeholder="Search patient by name or number"
        value={value ? `${value.firstName} ${value.lastName} (${value.patientNumber || "N/A"})` : query}
        onChange={(e) => {
          onChange(null)
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="focus-visible:ring-rose-400"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl border border-rose-100 bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-rose-50"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange({
                  id: p.id,
                  patientNumber: p.patientNumber,
                  firstName: p.firstName,
                  lastName: p.lastName,
                    dateOfBirth: p.dateOfBirth,
                })
                setOpen(false)
                setQuery("")
              }}
            >
              <span className="font-medium text-slate-700">{p.firstName} {p.lastName}</span>
              <span className="ml-2 text-xs text-slate-400">{p.patientNumber || "N/A"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function getStatusBadgeVariant(status: ImmunizationStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "Overdue") return "destructive"
  if (status === "Given") return "default"
  if (status === "Due") return "secondary"
  return "outline"
}

export function MidwifeImmunizations() {
  const { user } = useAuth()
  const { immunizations, addImmunization, updateImmunization } = useMedical()

  const today = new Date().toISOString().slice(0, 10)
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [runtimeSchedule, setRuntimeSchedule] = useState<RuntimeSchedule>({
    buckets: [...TIMING_BUCKETS],
    vaccinesByTiming: { ...VACCINES_BY_TIMING },
    dayOffsets: {},
  })
  const [ageTime, setAgeTime] = useState<string>("At Birth")
  const [selectedVaccines, setSelectedVaccines] = useState<string[]>([])
  const [customVaccineName, setCustomVaccineName] = useState("")
  const [status, setStatus] = useState<ImmunizationStatus>("Given")
  const [dateGiven, setDateGiven] = useState(today)
  const [administeredAt, setAdministeredAt] = useState(`${today}T08:00`)
  const [nextDueDate, setNextDueDate] = useState("")
  const [dose, setDose] = useState("")
  const [batchNumber, setBatchNumber] = useState("")
  const [administrator, setAdministrator] = useState(user?.name || "")
  const [route, setRoute] = useState("")
  const [administrationSite, setAdministrationSite] = useState("")
  const [manufacturer, setManufacturer] = useState("")
  const [otherVaccineReason, setOtherVaccineReason] = useState("")
  const [statusReason, setStatusReason] = useState("")
  const [remarks, setRemarks] = useState("")
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<Immunization | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const vaccineOptions = runtimeSchedule.vaccinesByTiming[ageTime] || []
  const patientImmunizations = useMemo(() => {
    if (!selectedPatient) return []
    return immunizations
      .filter((i) => i.patientId === selectedPatient.id)
      .sort((a, b) => {
        const aDate = a.dateAdministered ?? ""
        const bDate = b.dateAdministered ?? ""
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0
      })
  }, [immunizations, selectedPatient])

  const computedBucketDueDate = useMemo(() => {
    if (!selectedPatient?.dateOfBirth) return ""
    const offset = runtimeSchedule.dayOffsets[ageTime]
    if (typeof offset !== "undefined") {
      return computeDueDateFromDobWithOffset(selectedPatient.dateOfBirth, offset) || ""
    }
    return computeDueDateFromDob(selectedPatient.dateOfBirth, ageTime) || ""
  }, [selectedPatient, ageTime, runtimeSchedule.dayOffsets])
  const selectedBucketRecordedNames = useMemo(() => {
    if (!selectedPatient) return new Set<string>()
    return new Set(
      patientImmunizations
        .filter((row) => row.ageTime === ageTime && row.status === "Given")
        .map((row) => row.vaccineName.toLowerCase()),
    )
  }, [patientImmunizations, selectedPatient, ageTime])

  const scheduleSnapshot = useMemo(() => {
    if (!selectedPatient?.dateOfBirth) return []

    return runtimeSchedule.buckets.filter((bucket) => bucket !== "Other Timing").map((bucket) => {
      const offset = runtimeSchedule.dayOffsets[bucket]
      const dueDate = typeof offset !== "undefined"
        ? computeDueDateFromDobWithOffset(selectedPatient.dateOfBirth || null, offset)
        : computeDueDateFromDob(selectedPatient.dateOfBirth || null, bucket)
      const bucketVaccines = runtimeSchedule.vaccinesByTiming[bucket] || []
      const givenCount = bucketVaccines.filter((name) =>
        patientImmunizations.some(
          (row) =>
            row.ageTime === bucket &&
            row.status === "Given" &&
            row.vaccineName.toLowerCase() === name.toLowerCase(),
        ),
      ).length
      const complete = bucketVaccines.length > 0 && givenCount === bucketVaccines.length
      const overdue = Boolean(dueDate && dueDate < today && !complete)
      const due = Boolean(dueDate && dueDate <= today && !complete && !overdue)

      return {
        bucket,
        dueDate,
        givenCount,
        totalCount: bucketVaccines.length,
        complete,
        overdue,
        due,
      }
    })
  }, [patientImmunizations, runtimeSchedule, selectedPatient, today])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/medical/immunizations/schedule", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!data || cancelled) return
        const buckets = Array.isArray(data.buckets) && data.buckets.length ? data.buckets : [...TIMING_BUCKETS]
        const vaccinesByTiming = data.vaccinesByTiming && typeof data.vaccinesByTiming === "object"
          ? data.vaccinesByTiming
          : { ...VACCINES_BY_TIMING }
        const dayOffsets = data.dayOffsets && typeof data.dayOffsets === "object" ? data.dayOffsets : {}
        setRuntimeSchedule({ buckets, vaccinesByTiming, dayOffsets })
        if (!buckets.includes(ageTime) && buckets.length) {
          setAgeTime(buckets[0])
        }
      } catch {
        // Keep static fallback
      }
    })()
    return () => { cancelled = true }
  }, [ageTime])

  const summary = useMemo(() => {
    let due = 0
    let given = 0
    let overdue = 0
    let missed = 0
    for (const imm of patientImmunizations) {
      const rowStatus = imm.status || (imm.dateAdministered ? "Given" : "Due")
      if (rowStatus === "Given") given += 1
      else if (rowStatus === "Due") due += 1
      else if (rowStatus === "Overdue") overdue += 1
      else if (rowStatus === "Not Given") missed += 1
      else if (imm.nextDueDate && imm.nextDueDate < today) overdue += 1
    }
    return { due, given, overdue, missed }
  }, [patientImmunizations, today])

  function toggleVaccine(name: string) {
    setSelectedVaccines((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name],
    )
  }

  function clearForm() {
    setSelectedVaccines([])
    setCustomVaccineName("")
    setOtherVaccineReason("")
    setStatus("Given")
    setDateGiven(today)
    setAdministeredAt(`${today}T08:00`)
    setNextDueDate("")
    setDose("")
    setBatchNumber("")
    setAdministrator(user?.name || "")
    setRoute("")
    setAdministrationSite("")
    setManufacturer("")
    setStatusReason("")
    setRemarks("")
  }

  useEffect(() => {
    if (!selectedPatient) return
    if (!computedBucketDueDate) return
    setNextDueDate((prev) => (prev ? prev : computedBucketDueDate))
  }, [computedBucketDueDate, selectedPatient])

  useEffect(() => {
    if (status !== "Given") {
      setDateGiven("")
      setAdministeredAt("")
      return
    }
    setDateGiven((prev) => prev || today)
    setAdministeredAt((prev) => prev || `${today}T08:00`)
  }, [status, today])

  async function handleSave() {
    if (!selectedPatient) {
      toast.error("Select a patient first")
      return
    }

    const names = [...selectedVaccines]
    if (customVaccineName.trim()) names.push(customVaccineName.trim())
    if (!names.length) {
      toast.error("Select at least one vaccine or enter an additional vaccine")
      return
    }
    if (customVaccineName.trim() && !otherVaccineReason.trim()) {
      toast.error("Reason / indication is required for an other vaccine")
      return
    }

    if (status === "Given" && !dateGiven) {
      toast.error("Date given is required for status Given")
      return
    }

    setSaving(true)
    try {
      for (const vaccineName of names) {
        await addImmunization({
          patientId: selectedPatient.id,
          vaccineName,
          dateAdministered: status === "Given" ? dateGiven : undefined,
          administeredAt: status === "Given" && administeredAt ? new Date(administeredAt).toISOString() : undefined,
          nextDueDate: nextDueDate || undefined,
          ageTime,
          scheduleCode: ageTime,
          dose: dose || undefined,
          status,
          statusReason: statusReason || undefined,
          administeredBy: administrator || user?.name || "",
          route: route || undefined,
          administrationSite: administrationSite || undefined,
          manufacturer: manufacturer || undefined,
          batchNumber: batchNumber || undefined,
          isOtherVaccine: vaccineName === customVaccineName.trim(),
          otherVaccineReason: vaccineName === customVaccineName.trim() ? otherVaccineReason.trim() : undefined,
          contraindicationReason: status === "Contraindicated" ? statusReason : undefined,
          refusalReason: status === "Refused" ? statusReason : undefined,
          notes: remarks || undefined,
        })
      }
      toast.success("Immunization record saved")
      clearForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save immunization record")
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row: Immunization) {
    setEditing({ ...row })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    try {
      await updateImmunization(editing.id, editing)
      toast.success("Immunization updated")
      setEditOpen(false)
      setEditing(null)
    } catch {
      toast.error("Failed to update immunization")
    }
  }

  async function exportHistory(format: "csv" | "xlsx" | "pdf") {
    if (!selectedPatient) {
      toast.error("Select a patient first")
      return
    }
    try {
      const payload = {
        dataset: "immunizations",
        format,
        filters: {
          from: new Date("2000-01-01T00:00:00Z").toISOString(),
          to: new Date(today + "T23:59:59Z").toISOString(),
          patientId: selectedPatient.id,
        },
      }
      const res = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `immunizations-${selectedPatient.patientNumber || selectedPatient.id}.${format}`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Immunization history downloaded")
    } catch {
      toast.error("Export failed")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Syringe className="h-4 w-4 text-rose-600" />
            Immunization Register
          </CardTitle>
          <CardDescription>
            Capture routine and catch-up immunizations with due, overdue, missed, and completion status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Patient</Label>
              <PatientSearch value={selectedPatient} onChange={setSelectedPatient} />
            </div>
            <div className="space-y-2">
              <Label>Age/Time Category</Label>
              <Select value={ageTime} onValueChange={setAgeTime}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose timing" />
                </SelectTrigger>
                <SelectContent>
                  {runtimeSchedule.buckets.map((bucket) => (
                    <SelectItem key={bucket} value={bucket}>{bucket}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedPatient?.dateOfBirth && scheduleSnapshot.length > 0 && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Immunization schedule snapshot</p>
                  <p className="text-xs text-slate-500">Due and overdue stages are derived from date of birth and current vaccine history.</p>
                </div>
                <Badge variant="outline" className="border-rose-200 text-rose-700">DOB {selectedPatient.dateOfBirth}</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {scheduleSnapshot.map((item) => (
                  <div key={item.bucket} className="rounded-lg border border-rose-100 bg-white px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{item.bucket}</span>
                      <Badge
                        variant={item.complete ? "default" : item.overdue ? "destructive" : item.due ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {item.complete ? "Completed" : item.overdue ? "Overdue" : item.due ? "Due" : "Upcoming"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-slate-500">
                      <span>{item.dueDate || "No due date"}</span>
                      <span>{item.givenCount}/{item.totalCount} given</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Vaccines (multi-select)</Label>
            {vaccineOptions.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {vaccineOptions.map((name) => (
                  <label key={name} className="flex items-center gap-2 rounded-lg border border-rose-100 px-2.5 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedVaccines.includes(name)}
                      disabled={selectedBucketRecordedNames.has(name.toLowerCase())}
                      onChange={() => toggleVaccine(name)}
                    />
                    <span className={selectedBucketRecordedNames.has(name.toLowerCase()) ? "text-slate-400" : ""}>{name}</span>
                    {selectedBucketRecordedNames.has(name.toLowerCase()) && (
                      <Badge variant="outline" className="ml-auto text-[10px]">Recorded</Badge>
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No preset vaccines for this timing. Use additional vaccine below.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Other/Additional Vaccine</Label>
              <Input
                value={customVaccineName}
                onChange={(e) => setCustomVaccineName(e.target.value)}
                placeholder="Enter custom vaccine name"
              />
              <Input
                value={otherVaccineReason}
                onChange={(e) => setOtherVaccineReason(e.target.value)}
                placeholder="Reason / indication"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ImmunizationStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Date Given</Label>
              <Input type="date" value={dateGiven} disabled={status !== "Given"} onChange={(e) => setDateGiven(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Time Administered</Label>
              <Input type="datetime-local" value={administeredAt} disabled={status !== "Given"} onChange={(e) => setAdministeredAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Next Due</Label>
              <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
              {computedBucketDueDate && (
                <p className="text-[11px] text-slate-500">Suggested for this stage: {computedBucketDueDate}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Dose</Label>
              <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. Dose 1" />
            </div>
            <div className="space-y-2">
              <Label>Batch/Lot</Label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="Lot number" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Administrator</Label>
              <Input value={administrator} onChange={(e) => setAdministrator(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-2">
              <Label>Route</Label>
              <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="IM, SC, Oral" />
            </div>
            <div className="space-y-2">
              <Label>Administration Site</Label>
              <Input value={administrationSite} onChange={(e) => setAdministrationSite(e.target.value)} placeholder="Left thigh, deltoid, gluteal" />
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="Manufacturer" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Status Reason</Label>
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason for contraindicated/refused/not given"
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white">
              {saving ? "Saving..." : "Save Immunization"}
            </Button>
            <Button type="button" variant="outline" onClick={clearForm}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-rose-100 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>History, Due, and Overdue</CardTitle>
              <CardDescription>
                {selectedPatient
                  ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                  : "Select a patient to view immunization history"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" />
                Print
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exportHistory("csv")}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => exportHistory("pdf")}>
                <Download className="mr-1.5 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Due/Upcoming</p>
              <p className="text-lg font-semibold text-slate-800">{summary.due}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Given</p>
              <p className="text-lg font-semibold text-emerald-700">{summary.given}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Overdue</p>
              <p className="text-lg font-semibold text-rose-700">{summary.overdue}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Missed/Not Given</p>
              <p className="text-lg font-semibold text-amber-700">{summary.missed}</p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-rose-50">
                  <TableHead>Age/Time</TableHead>
                  <TableHead>Vaccine</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Administrator</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientImmunizations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-slate-500 py-6">
                      No immunization records for this patient.
                    </TableCell>
                  </TableRow>
                )}
                {patientImmunizations.map((row) => {
                  const rowStatus = (row.status || "Given") as ImmunizationStatus
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.ageTime || "-"}</TableCell>
                      <TableCell className="font-medium">{row.vaccineName}</TableCell>
                      <TableCell>{row.dateAdministered || "-"}</TableCell>
                      <TableCell>{row.dose || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(rowStatus)}>{rowStatus}</Badge>
                      </TableCell>
                      <TableCell>{row.batchNumber || "-"}</TableCell>
                      <TableCell>{row.administrationSite || "-"}</TableCell>
                      <TableCell>{row.administeredBy || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.notes || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Immunization</DialogTitle>
            <DialogDescription>Authorized users can update recorded immunization details.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Vaccine</Label>
                  <Input
                    value={editing.vaccineName}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, vaccineName: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={(editing.status || "Given") as ImmunizationStatus}
                    onValueChange={(v) => setEditing((prev) => (prev ? { ...prev, status: v as ImmunizationStatus } : prev))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>Date Given</Label>
                  <Input
                    type="date"
                    value={editing.dateAdministered || ""}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, dateAdministered: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label>Next Due</Label>
                  <Input
                    type="date"
                    value={editing.nextDueDate || ""}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, nextDueDate: e.target.value || undefined } : prev))}
                  />
                </div>
                <div>
                  <Label>Dose</Label>
                  <Input
                    value={editing.dose || ""}
                    onChange={(e) => setEditing((prev) => (prev ? { ...prev, dose: e.target.value || undefined } : prev))}
                  />
                </div>
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea
                  value={editing.notes || ""}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, notes: e.target.value || undefined } : prev))}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-rose-600 hover:bg-rose-700 text-white">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-slate-500">
        Note: Statuses supported are Due, Given, Overdue, Not Given, Contraindicated, and Refused.
      </div>
    </div>
  )
}
