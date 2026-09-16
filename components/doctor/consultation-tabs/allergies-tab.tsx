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
import { Plus, ShieldAlert } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const severityVariant: Record<string, string> = {
  severe: "bg-rose-100 text-rose-800 border-rose-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  mild: "bg-emerald-100 text-emerald-800 border-emerald-200",
}

export function AllergiesTab({ patient, user }: Props) {
  const { getPatientAllergies, addAllergy } = useMedical()
  const allergies = getPatientAllergies(patient.id)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    allergen: "", reaction: "", severity: "mild" as "mild" | "moderate" | "severe",
    diagnosedDate: "", notes: "",
  })

  function resetForm() {
    setForm({ allergen: "", reaction: "", severity: "mild", diagnosedDate: "", notes: "" })
  }

  async function handleSave() {
    if (!form.allergen.trim() || !form.reaction.trim()) {
      toast.error("Allergen and reaction are required")
      return
    }
    setSaving(true)
    try {
      await addAllergy({
        patientId: patient.id,
        allergen: form.allergen.trim(),
        reaction: form.reaction.trim(),
        severity: form.severity,
        diagnosedDate: form.diagnosedDate || new Date().toISOString().slice(0, 10),
        notes: form.notes.trim() || undefined,
      })
      toast.success("Allergy recorded")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to save allergy")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-rose-800">
          <ShieldAlert className="h-4 w-4" />
          Allergies
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Allergy
        </Button>
      </div>

      {allergies.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No allergies on record.</p>
      ) : (
        <div className="rounded-xl border border-rose-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-rose-50">
                <TableHead className="text-rose-700">Allergen</TableHead>
                <TableHead className="text-rose-700">Severity</TableHead>
                <TableHead className="text-rose-700">Reaction</TableHead>
                <TableHead className="text-rose-700">Diagnosed</TableHead>
                <TableHead className="text-rose-700">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allergies.map((a) => (
                <TableRow key={a.id} className="hover:bg-rose-50/40">
                  <TableCell className="font-medium">{a.allergen}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${severityVariant[a.severity] ?? ""}`}>
                      {a.severity}
                    </span>
                  </TableCell>
                  <TableCell>{a.reaction}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{a.diagnosedDate ? String(a.diagnosedDate).slice(0, 10) : "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Allergy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="allergen">Allergen *</Label>
              <Input id="allergen" value={form.allergen} onChange={(e) => setForm((p) => ({ ...p, allergen: e.target.value }))} placeholder="e.g. Penicillin" />
            </div>
            <div>
              <Label htmlFor="reaction">Reaction *</Label>
              <Input id="reaction" value={form.reaction} onChange={(e) => setForm((p) => ({ ...p, reaction: e.target.value }))} placeholder="e.g. Hives, Anaphylaxis" />
            </div>
            <div>
              <Label htmlFor="sev">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((p) => ({ ...p, severity: v as typeof form.severity }))}>
                <SelectTrigger id="sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="diagDate">Diagnosed Date</Label>
              <Input id="diagDate" type="date" value={form.diagnosedDate} onChange={(e) => setForm((p) => ({ ...p, diagnosedDate: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="algNotes">Notes</Label>
              <Textarea id="algNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-rose-600 hover:bg-rose-700 text-white">
              {saving ? "Saving…" : "Save Allergy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
