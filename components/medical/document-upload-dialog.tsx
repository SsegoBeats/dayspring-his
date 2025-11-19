"use client"

import type React from "react"

import { useState } from "react"
import { useMedical } from "@/lib/medical-context"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Upload } from "lucide-react"

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
}

export function DocumentUploadDialog({ open, onOpenChange, patientId, patientName }: DocumentUploadDialogProps) {
  const { addMedicalDocument } = useMedical()
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    documentType: "",
    fileName: "",
    notes: "",
  })
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !formData.documentType) return

    // In this environment we use a temporary object URL.
    // In production you should upload the file to storage and persist its URL.
    const fileUrl = URL.createObjectURL(file)

    addMedicalDocument({
      patientId,
      patientName,
      documentType: formData.documentType as any,
      fileName: file.name,
      fileUrl,
      uploadedBy: user?.name || "Unknown",
      uploadedDate: new Date().toISOString().split("T")[0],
      notes: formData.notes,
    })

    // Reset form
    setFormData({ documentType: "", fileName: "", notes: "" })
    setFile(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Medical Document</DialogTitle>
          <DialogDescription>Upload a document for {patientName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type *</Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => setFormData({ ...formData, documentType: value })}
            >
              <SelectTrigger id="documentType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lab-report">Lab Report</SelectItem>
                <SelectItem value="xray">X-Ray</SelectItem>
                <SelectItem value="scan">CT/MRI Scan</SelectItem>
                <SelectItem value="prescription">Prescription</SelectItem>
                <SelectItem value="consent-form">Consent Form</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="text-xs text-muted-foreground">Accepted formats: PDF, JPG, PNG, DOC, DOCX</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about this document"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || !formData.documentType}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
