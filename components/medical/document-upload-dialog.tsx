"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Upload } from "lucide-react"
import { toast } from "sonner"

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  patientId: string
  patientName: string
}

const DOCUMENT_TYPES = [
  { value: "ID", label: "Identification Document" },
  { value: "INSURANCE", label: "Insurance Card / Policy" },
  { value: "GUARANTEE", label: "Guarantee Letter" },
  { value: "REFERRAL", label: "Referral Letter" },
  { value: "PREAUTH", label: "Pre-Authorization" },
  { value: "CLAIM_FORM", label: "Claim Form" },
  { value: "CONSENT", label: "Consent Form" },
  { value: "OTHER", label: "Other" },
]

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

export function DocumentUploadDialog({ open, onOpenChange, patientId, patientName }: DocumentUploadDialogProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    documentType: "",
    notes: "",
  })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const MAX_FILE_BYTES = 3 * 1024 * 1024 // 3 MB — base64 overhead keeps us under Vercel's 4.5 MB body limit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !formData.documentType) return

    if (file.size > MAX_FILE_BYTES) {
      toast.error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is 3 MB.`)
      return
    }

    setUploading(true)
    try {
      const fileUrl = await fileToDataUrl(file)

      const res = await fetch("/api/medical/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          type: formData.documentType,
          fileName: file.name,
          fileUrl,
          notes: formData.notes,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed")
      }

      toast.success("Document uploaded successfully")
      setFormData({ documentType: "", notes: "" })
      setFile(null)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
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
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
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
            <p className="text-xs text-muted-foreground">Accepted formats: PDF, JPG, PNG, DOC, DOCX (max 3 MB)</p>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || !formData.documentType || uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
