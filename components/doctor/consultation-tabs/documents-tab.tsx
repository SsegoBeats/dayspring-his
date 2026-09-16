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
import { Plus, FileText, ExternalLink } from "lucide-react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"

interface Props { patient: Patient; user: User }

const DOC_TYPES = [
  { value: "lab-report", label: "Lab Report" },
  { value: "xray", label: "X-Ray" },
  { value: "scan", label: "Scan" },
  { value: "prescription", label: "Prescription" },
  { value: "consent-form", label: "Consent Form" },
  { value: "other", label: "Other" },
] as const

export function DocumentsTab({ patient, user }: Props) {
  const { getPatientDocuments, addMedicalDocument } = useMedical()
  const documents = getPatientDocuments(patient.id)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    documentType: "other" as "lab-report" | "xray" | "scan" | "prescription" | "consent-form" | "other",
    fileName: "", fileUrl: "", notes: "",
  })

  function resetForm() {
    setForm({ documentType: "other", fileName: "", fileUrl: "", notes: "" })
  }

  async function handleSave() {
    if (!form.fileUrl.trim()) { toast.error("File URL is required"); return }
    setSaving(true)
    try {
      await addMedicalDocument({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        documentType: form.documentType,
        fileName: form.fileName.trim() || form.fileUrl.split("/").pop() || "document",
        fileUrl: form.fileUrl.trim(),
        uploadedBy: user.name,
        uploadedDate: new Date().toISOString().slice(0, 10),
        notes: form.notes.trim() || undefined,
      })
      toast.success("Document added")
      setOpen(false)
      resetForm()
    } catch {
      toast.error("Failed to add document")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-700">
          <FileText className="h-4 w-4" />
          Clinical Documents
        </h3>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-slate-700 hover:bg-slate-800 text-white">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No documents on file.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Type</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {DOC_TYPES.find((t) => t.value === doc.documentType)?.label ?? doc.documentType}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{doc.fileName}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{String(doc.uploadedDate).slice(0, 10)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{doc.uploadedBy || "—"}</TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-[160px] truncate">{doc.notes || "—"}</TableCell>
                  <TableCell>
                    {doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.fileName}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-teal-600 hover:text-teal-800">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Clinical Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="docType">Document Type</Label>
              <Select value={form.documentType} onValueChange={(v) => setForm((p) => ({ ...p, documentType: v as typeof form.documentType }))}>
                <SelectTrigger id="docType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fileUrl">File URL *</Label>
              <Input id="fileUrl" value={form.fileUrl} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label htmlFor="fileName">Display Name</Label>
              <Input id="fileName" value={form.fileName} onChange={(e) => setForm((p) => ({ ...p, fileName: e.target.value }))} placeholder="Optional — defaults to filename from URL" />
            </div>
            <div>
              <Label htmlFor="docNotes">Notes</Label>
              <Textarea id="docNotes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-slate-700 hover:bg-slate-800 text-white">
              {saving ? "Saving…" : "Add Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
