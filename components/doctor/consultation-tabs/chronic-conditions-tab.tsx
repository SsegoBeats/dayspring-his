"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Activity } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const statusVariant: Record<string, string> = {
  active: "bg-rose-100 text-rose-800 border-rose-200",
  managed: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export function ChronicConditionsTab({ patient, user }: Props) {
  const { getPatientChronicConditions, addChronicCondition, updateChronicCondition } = useMedical()
  const conditions = getPatientChronicConditions(patient.id)

  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    condition: "", diagnosedDate: "", status: "active" as "active" | "managed" | "resolved",
    medications: "", notes: "",
  })

  function resetForm() {
    setForm({ condition: "", diagnosedDate: "", status: "active", medications: "", notes: "" })
  }

  async function handleAdd() {
    if (!form.condition.trim()) { toast.error("Condition name is required"); return }
    setSaving(true)
    try {
      await addChronicCondition({
        patientId: patient.id,
        condition: form.condition.trim(),
        diagnosedDate: form.diagnosedDate || new Date().toISOString().slice(0, 10),
        status: form.status,
        medications: form.medications.trim() ? form.medications.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success("Condition recorded")
      setAddOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save condition")
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: "active" | "managed" | "resolved") {
    setUpdatingId(id)
    try {
      await updateChronicCondition(id, { status: newStatus })
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800">
          <Activity className="h-4 w-4" />
          Chronic Conditions
        </h3>
        <Button size="sm" onClick={() => setAddOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No chronic conditions on record.</p>
      ) : (
        <div className="rounded-xl border border-amber-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-50">
                <TableHead className="text-amber-700">Condition</TableHead>
                <TableHead className="text-amber-700">Status</TableHead>
                <TableHead className="text-amber-700">Diagnosed</TableHead>
                <TableHead className="text-amber-700">Medications</TableHead>
                <TableHead className="text-amber-700">Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conditions.map((c) => (
                <TableRow key={c.id} className="hover:bg-amber-50/40">
                  <TableCell className="font-medium">{c.condition}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusVariant[c.status] ?? ""}`}>
                      {c.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">{c.diagnosedDate ? String(c.diagnosedDate).slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">
                    {c.medications?.length ? c.medications.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{c.notes || "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={c.status}
                      disabled={updatingId === c.id}
                      onValueChange={(v) => handleStatusChange(c.id, v as typeof c.status)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="managed">Managed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Chronic Condition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cond">Condition *</Label>
              <Input id="cond" value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} placeholder="e.g. Type 2 Diabetes" />
            </div>
            <div>
              <Label htmlFor="condStatus">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as typeof form.status }))}>
                <SelectTrigger id="condStatus"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="managed">Managed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="condDiag">Diagnosed Date</Label>
              <Input id="condDiag" type="date" value={form.diagnosedDate} onChange={(e) => setForm((p) => ({ ...p, diagnosedDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="condMeds">Medications (comma-separated)</Label>
              <Input id="condMeds" value={form.medications} onChange={(e) => setForm((p) => ({ ...p, medications: e.target.value }))} placeholder="e.g. Metformin, Insulin" />
            </div>
            <div>
              <Label htmlFor="condNotes">Notes</Label>
              <Textarea id="condNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleAdd} className="bg-amber-600 hover:bg-amber-700 text-white">
              {saving ? "Saving…" : "Save Condition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
