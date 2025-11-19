"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type Doc = { id: string; type: 'ID'|'INSURANCE'|'CONSENT'|'OTHER'; file_url: string; uploaded_at: string }

export function DocumentsList({ patientId }: { patientId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [type, setType] = useState<'ID'|'INSURANCE'|'CONSENT'|'OTHER'>('ID')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    try { setLoading(true)
      const res = await fetch(`/api/documents?patientId=${patientId}`, { credentials: 'include' })
      if (res.ok) setDocs((await res.json()).documents || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [patientId])

  const add = async () => {
    if (!file) { toast.error('Choose a file to upload'); return }
    setAdding(true)
    try {
      // 1) Upload file to server
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'include' })
      if (!up.ok) {
        const e = await up.json().catch(()=>({}))
        toast.error(e.error || 'Upload failed')
        return
      }
      const { url } = await up.json()
      if (!url) { toast.error('Upload failed'); return }

      // 2) Save document record
      const res = await fetch('/api/documents', { method: 'POST', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ patientId, type, fileUrl: url }) })
      if (!res.ok) { const e = await res.json().catch(()=>({})); toast.error(e.error || 'Failed to add document') }
      else { toast.success('Document added'); setFile(null); await load() }
    } catch { toast.error('Failed to add document') } finally { setAdding(false) }
  }

  const deleteDocument = async (id: string) => {
    if (!window.confirm("Remove this document from the patient record?")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to remove document')
      } else {
        toast.success('Document removed')
        await load()
      }
    } catch {
      toast.error('Failed to remove document')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>Attach identification, insurance cards, and consents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 grid-cols-1 md:grid-cols-[120px_1fr_auto] items-center">
            <div>
              <Select value={type} onValueChange={(v:any)=>setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ID">ID</SelectItem>
                  <SelectItem value="INSURANCE">INSURANCE</SelectItem>
                  <SelectItem value="CONSENT">CONSENT</SelectItem>
                  <SelectItem value="OTHER">OTHER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label
              className="flex-1 rounded-md border border-input bg-white px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 cursor-pointer"
              role="button"
            >
              {file ? file.name : "Choose a file"}
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e)=> setFile(e.target.files && e.target.files[0] ? e.target.files![0] : null)}
                className="sr-only"
              />
            </label>
            <Button onClick={add} disabled={adding || !file}>{adding ? 'Adding...':'Add Document'}</Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Upload scans or PDFs to keep identification, insurance cards, and consents next to this patient.
        </div>
        <div className="rounded border divide-y mt-2">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : docs.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No documents</div>
          ) : docs.map((d) => (
            <div key={d.id} className="p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{d.type}</div>
                <div className="text-muted-foreground">{new Date(d.uploaded_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <a className="text-blue-600 underline" href={d.file_url} target="_blank" rel="noreferrer">Open</a>
                <Button size="sm" variant="ghost" onClick={() => deleteDocument(d.id)} disabled={deletingId === d.id}>
                  {deletingId === d.id ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


