"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { getPatientDocumentTypeLabel, PATIENT_DOCUMENT_TYPES, type PatientDocumentType } from "@/lib/insurance"

type Doc = {
  id: string
  type: PatientDocumentType
  file_url: string
  uploaded_at: string
  original_name?: string | null
  mime_type?: string | null
  notes?: string | null
}

export function DocumentsList({ patientId }: { patientId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [type, setType] = useState<PatientDocumentType>("ID")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/documents?patientId=${patientId}`, { credentials: "include" })
      if (res.ok) setDocs((await res.json()).documents || [])
    } catch {
      // Silent load failure; the UI keeps the last known state.
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!file) {
      toast.error("Choose a file to upload")
      return
    }
    setAdding(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", "lab")

      const up = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" })
      if (!up.ok) {
        const error = await up.json().catch(() => ({}))
        toast.error(error.error || "Upload failed")
        return
      }

      const { url, originalName, mimeType } = await up.json()
      if (!url) {
        toast.error("Upload failed")
        return
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          type,
          fileUrl: url,
          notes: notes.trim() || undefined,
          fileName: originalName || file.name,
          mimeType: mimeType || file.type || undefined,
        }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        toast.error(error.error || "Failed to add document")
      } else {
        toast.success("Document added")
        setFile(null)
        setNotes("")
        await load()
      }
    } catch {
      toast.error("Failed to add document")
    } finally {
      setAdding(false)
    }
  }

  const deleteDocument = async (id: string) => {
    if (!window.confirm("Remove this document from the patient record?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "Failed to remove document")
      } else {
        toast.success("Document removed")
        await load()
      }
    } catch {
      toast.error("Failed to remove document")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Documents</CardTitle>
        <CardDescription>Attach identification, insurance cards, and signed consents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        <div className="rounded-lg border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient-document-type">Document type</Label>
              <Select value={type} onValueChange={(value: PatientDocumentType) => setType(value)}>
                <SelectTrigger id="patient-document-type" aria-label="Document type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PATIENT_DOCUMENT_TYPES.map((documentType) => (
                    <SelectItem key={documentType} value={documentType}>
                      {getPatientDocumentTypeLabel(documentType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-document-file">Select document file</Label>
              <label
                htmlFor="patient-document-file"
                className="flex min-h-9 cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm text-muted-foreground shadow-xs transition hover:bg-muted"
              >
                {file ? file.name : "Choose a PDF or image"}
              </label>
              <Input
                id="patient-document-file"
                name="patientDocumentFile"
                type="file"
                accept="image/*,.pdf"
                onChange={(event) =>
                  setFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)
                }
                className="sr-only"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="patient-document-notes">Document notes</Label>
            <Input
              id="patient-document-notes"
              name="patientDocumentNotes"
              placeholder="Example: Insurance card front, national ID, signed consent."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Upload scans or PDFs so reception, billing, and clinical teams can retrieve cover documents quickly.
            </p>
            <Button onClick={add} disabled={adding || !file}>
              {adding ? "Adding..." : "Add Document"}
            </Button>
          </div>
        </div>

        <div className="rounded border divide-y" data-testid="patient-documents-list">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : docs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No documents</div>
          ) : (
            docs.map((document) => (
              <div
                key={document.id}
                data-document-name={document.original_name || ""}
                className="flex flex-col gap-2 p-3 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">{getPatientDocumentTypeLabel(document.type)}</div>
                  {document.original_name ? (
                    <div className="text-muted-foreground">{document.original_name}</div>
                  ) : null}
                  {document.notes ? <div className="text-muted-foreground">{document.notes}</div> : null}
                  <div className="text-muted-foreground">{new Date(document.uploaded_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a className="text-primary underline" href={document.file_url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteDocument(document.id)}
                    disabled={deletingId === document.id}
                  >
                    {deletingId === document.id ? "Removing..." : "Remove"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
