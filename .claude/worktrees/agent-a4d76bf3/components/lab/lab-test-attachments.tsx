"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Paperclip, Upload, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface LabTestAttachmentsProps {
  patientId: string
  patientName: string
  testId: string
  testName: string
  accessionNumber?: string | null
}

type StoredDocument = {
  id: string
  file_url: string
  notes?: string | null
  original_name?: string | null
  mime_type?: string | null
  uploaded_at?: string | null
}

export function LabTestAttachments({
  patientId,
  patientName,
  testId,
  testName,
  accessionNumber,
}: LabTestAttachmentsProps) {
  const [documents, setDocuments] = useState<StoredDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState("")
  const tag = useMemo(() => accessionNumber || testId, [accessionNumber, testId])
  const notePrefix = useMemo(() => `Lab attachment [${tag}]`, [tag])

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/documents?patientId=${patientId}`, { credentials: "include" })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to load attachments")
      }
      const data = await response.json()
      const items = Array.isArray(data.documents) ? data.documents : []
      setDocuments(
        items.filter((item: StoredDocument) => String(item.notes || "").includes(notePrefix)),
      )
    } catch (error: any) {
      toast.error(error?.message || "Failed to load attachments")
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [notePrefix, patientId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const handleUpload = async () => {
    if (!file) {
      toast.error("Select a file to upload")
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("kind", "lab")
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      })
      if (!uploadResponse.ok) {
        const data = await uploadResponse.json().catch(() => ({}))
        throw new Error(data.error || "Failed to upload file")
      }
      const uploadData = await uploadResponse.json()

      const documentResponse = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          type: "OTHER",
          fileUrl: uploadData.url,
          fileName: uploadData.originalName || file.name,
          mimeType: uploadData.mimeType || file.type || null,
          notes: notes.trim()
            ? `${notePrefix} - ${testName} for ${patientName}. ${notes.trim()}`
            : `${notePrefix} - ${testName} for ${patientName}.`,
        }),
      })
      if (!documentResponse.ok) {
        const data = await documentResponse.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save attachment")
      }

      setFile(null)
      setNotes("")
      const input = document.getElementById(`lab-attachment-${tag}`) as HTMLInputElement | null
      if (input) input.value = ""
      await loadDocuments()
      toast.success("Attachment uploaded")
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload attachment")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-cyan-600" />
        <div>
          <div className="font-medium text-foreground">Analyzer Attachments</div>
          <div className="text-xs text-muted-foreground">
            Upload analyzer output, scans, or supplementary lab artifacts for this order only.
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`lab-attachment-${tag}`}>Attachment File</Label>
          <Input
            id={`lab-attachment-${tag}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt,.csv,.xls,.xlsx"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`lab-attachment-notes-${tag}`}>Attachment Notes</Label>
          <Textarea
            id={`lab-attachment-notes-${tag}`}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional context, analyzer run, or specimen note"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleUpload} disabled={uploading || !file} className="w-full">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Upload
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">Linked Files</div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attachments...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No attachments linked to this lab order yet.
          </div>
        ) : (
          documents.map((document) => (
            <div key={document.id} className="flex flex-col gap-2 rounded-xl border bg-white px-3 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-foreground">{document.original_name || document.file_url.split("/").pop() || "Attachment"}</div>
                <div className="text-xs text-muted-foreground">
                  {document.uploaded_at ? new Date(document.uploaded_at).toLocaleString() : "Uploaded"}
                  {document.mime_type ? ` • ${document.mime_type}` : ""}
                </div>
                {document.notes ? (
                  <div className="mt-1 text-sm text-muted-foreground">{document.notes}</div>
                ) : null}
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
