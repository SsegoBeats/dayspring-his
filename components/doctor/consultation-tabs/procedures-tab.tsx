"use client"

import { useEffect, useMemo, useState } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Stethoscope } from "lucide-react"
import { toast } from "sonner"

interface ProceduresTabProps {
  patient: Patient
  user: User
}

interface ProcedureRecord {
  id: string
  procedure_name: string
  procedure_type: string
  status: string
  ordered_at: string
  completed_at?: string | null
  performer_name?: string | null
  performed_by_name?: string | null
  procedure_date?: string | null
  procedure_time?: string | null
  reason_indication?: string | null
  findings?: string | null
  procedure_notes?: string | null
  outcome?: string | null
  follow_up_instructions?: string | null
  is_other_procedure?: boolean | null
  other_procedure_name?: string | null
  ordered_by_name?: string | null
}

const PROCEDURE_OPTIONS = [
  "Wound Dressing",
  "Suturing",
  "Incision and Drainage",
  "Catheterization",
  "Nebulization",
  "IV Cannulation",
  "Blood Transfusion",
  "Biopsy",
  "Minor Surgery",
  "Other Procedure",
] as const

const OTHER_PROCEDURE_VALUE = "Other Procedure"

function getNowDefaults() {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  return { date, time: `${hh}:${mm}` }
}

export function ProceduresTab({ patient }: ProceduresTabProps) {
  const nowDefaults = useMemo(() => getNowDefaults(), [])
  const [records, setRecords] = useState<ProcedureRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [procedureMode, setProcedureMode] = useState<"ordered" | "completed">("completed")
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    procedureName: "",
    otherProcedureName: "",
    procedureDate: nowDefaults.date,
    procedureTime: nowDefaults.time,
    performedBy: "",
    reasonIndication: "",
    findings: "",
    procedureNotes: "",
    outcome: "",
    followUpInstructions: "",
  })

  const isOtherProcedure = form.procedureName === OTHER_PROCEDURE_VALUE

  const loadProcedures = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/procedures?patientId=${encodeURIComponent(patient.id)}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to load procedures")
      const data = await res.json().catch(() => ({}))
      setRecords(Array.isArray(data.procedures) ? data.procedures : [])
    } catch {
      toast.error("Failed to load procedure history")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProcedures()
  }, [patient.id])

  const resetForm = () => {
    const defaults = getNowDefaults()
    setForm({
      procedureName: "",
      otherProcedureName: "",
      procedureDate: defaults.date,
      procedureTime: defaults.time,
      performedBy: "",
      reasonIndication: "",
      findings: "",
      procedureNotes: "",
      outcome: "",
      followUpInstructions: "",
    })
  }

  const handleSave = async () => {
    if (!form.procedureName) {
      toast.error("Select a procedure")
      return
    }
    if (isOtherProcedure && !form.otherProcedureName.trim()) {
      toast.error("Enter the Other Procedure name")
      return
    }

    setSaving(true)
    try {
      const payload = {
        patientId: patient.id,
        procedureName: form.procedureName,
        status: procedureMode,
        isOtherProcedure,
        otherProcedureName: isOtherProcedure ? form.otherProcedureName.trim() : undefined,
        reasonIndication: form.reasonIndication.trim() || undefined,
        procedureNotes: form.procedureNotes.trim() || undefined,
        followUpInstructions: form.followUpInstructions.trim() || undefined,
        ...(procedureMode === "completed" ? {
          procedureDate: form.procedureDate || undefined,
          procedureTime: form.procedureTime || undefined,
          performedBy: form.performedBy.trim() || undefined,
          findings: form.findings.trim() || undefined,
          outcome: form.outcome.trim() || undefined,
        } : {}),
        procedureType: "Clinical Procedure",
      }

      const res = await fetch("/api/procedures", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save procedure")
      }

      toast.success(procedureMode === "ordered" ? "Procedure order sent to the care team" : "Procedure recorded")
      setOpen(false)
      resetForm()
      await loadProcedures()
    } catch (error: any) {
      toast.error(error?.message || "Failed to save procedure")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-teal-800">
          <Stethoscope className="h-4 w-4" />
          Procedures
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setProcedureMode("ordered"); setOpen(true) }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Order Procedure
          </Button>
          <Button size="sm" onClick={() => { setProcedureMode("completed"); setOpen(true) }} className="bg-teal-700 hover:bg-teal-800 text-white">
            <Plus className="mr-1.5 h-4 w-4" />
            Record Completed
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Loading procedures...</p>
      ) : records.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No procedures recorded for this patient.</p>
      ) : (
        <div className="rounded-xl border border-teal-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-teal-50">
                <TableHead className="text-teal-700">Procedure</TableHead>
                <TableHead className="text-teal-700">Status</TableHead>
                <TableHead className="text-teal-700">Date</TableHead>
                <TableHead className="text-teal-700">Time</TableHead>
                <TableHead className="text-teal-700">Performed By</TableHead>
                <TableHead className="text-teal-700">Outcome</TableHead>
                <TableHead className="text-teal-700">Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id} className="align-top hover:bg-teal-50/30">
                  <TableCell className="font-medium">
                    <div>{record.procedure_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {record.reason_indication ? `Reason: ${record.reason_indication}` : "Reason: —"}
                    </div>
                    {record.findings && (
                      <div className="mt-1 text-xs text-slate-500">Findings: {record.findings}</div>
                    )}
                    {record.procedure_notes && (
                      <div className="mt-1 text-xs text-slate-500">Notes: {record.procedure_notes}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm capitalize text-slate-600">{record.status.replace("_", " ")}</TableCell>
                  <TableCell className="text-sm text-slate-600">{record.procedure_date || "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{record.procedure_time || "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {record.performer_name || record.performed_by_name || record.ordered_by_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">{record.outcome || "—"}</TableCell>
                  <TableCell className="text-sm text-slate-600">{record.follow_up_instructions || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{procedureMode === "ordered" ? "Order Procedure" : "Record Completed Procedure"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="procedure-name">Procedure Name *</Label>
                <Select value={form.procedureName || "__none"} onValueChange={(value) => setForm((p) => ({ ...p, procedureName: value === "__none" ? "" : value }))}>
                  <SelectTrigger id="procedure-name">
                    <SelectValue placeholder="Select procedure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Select procedure</SelectItem>
                    {PROCEDURE_OPTIONS.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {procedureMode === "completed" && <div className="space-y-1">
                <Label htmlFor="performed-by">Person Who Performed It</Label>
                <Input
                  id="performed-by"
                  value={form.performedBy}
                  onChange={(e) => setForm((p) => ({ ...p, performedBy: e.target.value }))}
                  placeholder="e.g. Dr. Jane Doe"
                />
              </div>}

              {isOtherProcedure && (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="other-procedure">Other Procedure Name *</Label>
                  <Input
                    id="other-procedure"
                    value={form.otherProcedureName}
                    onChange={(e) => setForm((p) => ({ ...p, otherProcedureName: e.target.value }))}
                    placeholder="Enter the procedure name"
                  />
                </div>
              )}

              {procedureMode === "completed" && <div className="space-y-1">
                <Label htmlFor="procedure-date">Date</Label>
                <Input
                  id="procedure-date"
                  type="date"
                  value={form.procedureDate}
                  onChange={(e) => setForm((p) => ({ ...p, procedureDate: e.target.value }))}
                />
              </div>}

              {procedureMode === "completed" && <div className="space-y-1">
                <Label htmlFor="procedure-time">Time</Label>
                <Input
                  id="procedure-time"
                  type="time"
                  value={form.procedureTime}
                  onChange={(e) => setForm((p) => ({ ...p, procedureTime: e.target.value }))}
                />
              </div>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="reason-indication">Reason/Indication</Label>
              <Textarea
                id="reason-indication"
                rows={2}
                value={form.reasonIndication}
                onChange={(e) => setForm((p) => ({ ...p, reasonIndication: e.target.value }))}
                placeholder="Why the procedure was needed"
              />
            </div>

            {procedureMode === "completed" && <div className="space-y-1">
              <Label htmlFor="findings">Findings</Label>
              <Textarea
                id="findings"
                rows={2}
                value={form.findings}
                onChange={(e) => setForm((p) => ({ ...p, findings: e.target.value }))}
                placeholder="Clinical findings during/after procedure"
              />
            </div>}

            <div className="space-y-1">
              <Label htmlFor="procedure-notes">Procedure Notes</Label>
              <Textarea
                id="procedure-notes"
                rows={2}
                value={form.procedureNotes}
                onChange={(e) => setForm((p) => ({ ...p, procedureNotes: e.target.value }))}
                placeholder="Procedure details and technique"
              />
            </div>

            {procedureMode === "completed" && <div className="space-y-1">
              <Label htmlFor="outcome">Outcome</Label>
              <Textarea
                id="outcome"
                rows={2}
                value={form.outcome}
                onChange={(e) => setForm((p) => ({ ...p, outcome: e.target.value }))}
                placeholder="Immediate outcome/result"
              />
            </div>}

            <div className="space-y-1">
              <Label htmlFor="follow-up">Follow-up Instructions</Label>
              <Textarea
                id="follow-up"
                rows={2}
                value={form.followUpInstructions}
                onChange={(e) => setForm((p) => ({ ...p, followUpInstructions: e.target.value }))}
                placeholder="Follow-up plan and patient instructions"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-teal-700 hover:bg-teal-800 text-white">
              {saving ? "Saving..." : procedureMode === "ordered" ? "Send Procedure Order" : "Save Procedure Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
