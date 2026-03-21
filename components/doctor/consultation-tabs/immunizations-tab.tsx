"use client"
import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Plus, Syringe, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

export function ImmunizationsTab({ patient, user }: Props) {
  const { getPatientImmunizations, addImmunization } = useMedical()
  const immunizations = getPatientImmunizations(patient.id)
  const today = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vaccineName: "", dateAdministered: today, nextDueDate: "",
    administeredBy: "", batchNumber: "", notes: "",
  })

  function resetForm() {
    setForm({ vaccineName: "", dateAdministered: today, nextDueDate: "", administeredBy: "", batchNumber: "", notes: "" })
  }

  async function handleSave() {
    if (!form.vaccineName.trim() || !form.dateAdministered) {
      toast.error("Vaccine name and date administered are required")
      return
    }
    setSaving(true)
    try {
      await addImmunization({
        patientId: patient.id,
        vaccineName: form.vaccineName.trim(),
        dateAdministered: form.dateAdministered,
        nextDueDate: form.nextDueDate || undefined,
        administeredBy: form.administeredBy.trim() || user.name,
        batchNumber: form.batchNumber.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      toast.success("Immunization recorded")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save immunization")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-teal-800">
          <Syringe className="h-4 w-4" />
          Immunizations
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-teal-700 hover:bg-teal-800 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Immunization
        </Button>
      </div>

      {immunizations.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No immunization records on file.</p>
      ) : (
        <div className="rounded-xl border border-teal-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-teal-50">
                <TableHead className="text-teal-700">Vaccine</TableHead>
                <TableHead className="text-teal-700">Administered</TableHead>
                <TableHead className="text-teal-700">Next Due</TableHead>
                <TableHead className="text-teal-700">Administered By</TableHead>
                <TableHead className="text-teal-700">Batch #</TableHead>
                <TableHead className="text-teal-700">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {immunizations.map((imm) => {
                const overdue = !!imm.nextDueDate && String(imm.nextDueDate).slice(0, 10) < today
                return (
                  <TableRow key={imm.id} className={cn("hover:bg-teal-50/40", overdue && "bg-amber-50/50")}>
                    <TableCell className="font-medium">{imm.vaccineName}</TableCell>
                    <TableCell className="text-sm">{String(imm.dateAdministered).slice(0, 10)}</TableCell>
                    <TableCell className="text-sm">
                      {imm.nextDueDate ? (
                        <span className={cn("flex items-center gap-1", overdue && "text-amber-700 font-medium")}>
                          {overdue && <AlertTriangle className="h-3 w-3" />}
                          {String(imm.nextDueDate).slice(0, 10)}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{imm.administeredBy || "—"}</TableCell>
                    <TableCell className="text-slate-500 text-sm font-mono text-xs">{imm.batchNumber || "—"}</TableCell>
                    <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{imm.notes || "—"}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Immunization</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="vax">Vaccine Name *</Label>
              <Input id="vax" value={form.vaccineName} onChange={(e) => setForm((p) => ({ ...p, vaccineName: e.target.value }))} placeholder="e.g. Hepatitis B" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dateAdm">Date Administered *</Label>
                <Input id="dateAdm" type="date" value={form.dateAdministered} onChange={(e) => setForm((p) => ({ ...p, dateAdministered: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nextDue">Next Due Date</Label>
                <Input id="nextDue" type="date" value={form.nextDueDate} onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="admBy">Administered By</Label>
              <Input id="admBy" value={form.administeredBy} onChange={(e) => setForm((p) => ({ ...p, administeredBy: e.target.value }))} placeholder={user.name} />
            </div>
            <div>
              <Label htmlFor="batch">Batch Number</Label>
              <Input id="batch" value={form.batchNumber} onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="immNotes">Notes</Label>
              <Textarea id="immNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-teal-700 hover:bg-teal-800 text-white">
              {saving ? "Saving…" : "Save Immunization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
