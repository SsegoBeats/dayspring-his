"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function OrgSettings() {
  const [form, setForm] = useState({ name: "", logoUrl: "", email: "", phone: "", address: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/org', { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load org settings')
        const data = await res.json()
        const s = data.settings || {}
        setForm({ name: s.name || '', logoUrl: s.logoUrl || '', email: s.email || '', phone: s.phone || '', address: s.address || '' })
      } catch (e:any) {
        toast.error('Failed to load organization settings', { description: e?.message || 'Error' })
      } finally { setLoading(false) }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/org', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error((await res.json().catch(()=>({} as any)))?.error || 'Failed')
      toast.success('Organization settings saved')
    } catch (e:any) {
      toast.error('Failed to save organization settings', { description: e?.message || 'Error' })
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e)=> setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Logo URL</Label>
                <div className="text-[11px] text-muted-foreground">Upload a logo and we will fill the URL automatically.</div>
                <div className="flex items-center gap-2">
                  <input type="file" accept="image/*" onChange={async (e)=>{
                    const f = e.target.files?.[0]; if (!f) return;
                    try {
                      const fd = new FormData(); fd.append("file", f)
                      const r = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd })
                      const d = await r.json(); if ((r as any).ok && d?.url) { setForm(prev=> ({...prev, logoUrl: d.url})); (require("sonner") as any).toast.success("Logo uploaded") }
                      else (require("sonner") as any).toast.error("Upload failed", { description: d?.error || "Error" })
                    } catch (err:any) { (require("sonner") as any).toast.error("Upload failed", { description: err?.message || "Error" }) }
                  }} />
                  {form.logoUrl && (<img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 object-contain border rounded" onError={(e:any)=> { (e.currentTarget as any).style.display='none' }} />)}
                </div>
                <Input placeholder="/logo.png or https://…" value={form.logoUrl} onChange={(e)=> setForm({ ...form, logoUrl: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={form.email} onChange={(e)=> setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e)=> setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e)=> setForm({ ...form, address: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>{saving? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

