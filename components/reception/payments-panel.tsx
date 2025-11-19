"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

type CompactPatient = { id: string; patient_number: string; first_name: string; last_name: string }
type PaymentRow = { id: string; receipt_no: string; amount: number; method: string; created_at: string; first_name: string; last_name: string; patient_number: string }

export function PaymentsPanel() {
  const { user } = useAuth()
  const role = (user?.role || '').toLowerCase()
  const canManagePayments = role === 'cashier' || role === 'hospital admin'
  const [q, setQ] = useState("")
  const [patients, setPatients] = useState<CompactPatient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [method, setMethod] = useState<'cash'|'card'|'mobile_money'|'bank'>('cash')
  const [reference, setReference] = useState<string>("")
  const [creating, setCreating] = useState(false)
  const [recent, setRecent] = useState<PaymentRow[]>([])
  const [from, setFrom] = useState<string>(new Date(Date.now()-7*24*60*60*1000).toISOString().slice(0,10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10))
  const [items, setItems] = useState<{ description: string; amount: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>("")
  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  // Search patients (debounced)
  useEffect(() => {
    const h = setTimeout(async () => {
      if (!q || q.length < 2) { setPatients([]); return }
      try {
        setSearching(true)
        const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}&limit=25&compact=1`, { credentials: 'include' })
        if (res.ok) setPatients((await res.json()).patients || [])
      } catch {}
      finally { setSearching(false) }
    }, 250)
    return () => clearTimeout(h)
  }, [q])

  async function loadRecent(pid?: string) {
    try {
      const url = new URL('/api/payments', window.location.origin)
      if (pid) url.searchParams.set('patientId', pid)
      const res = await fetch(url.toString(), { credentials: 'include' })
      if (res.ok) setRecent((await res.json()).payments || [])
    } catch {}
  }

  useEffect(() => { loadRecent(selectedPatientId || undefined) }, [selectedPatientId])

  const create = async () => {
    const hasItems = items.length > 0
    const amt = hasItems ? items.reduce((a, b) => a + (Number(b.amount)||0), 0) : Number(amount)
    if (!selectedPatientId || !amt || isNaN(amt)) { toast.error('Select patient and enter amount'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatientId, amount: hasItems ? undefined : amt, method, reference: reference || null, items: hasItems ? items.map(i => ({ description: i.description, amount: Number(i.amount||0) })) : undefined })
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        const msg = e.error || 'Failed to record payment'
        toast.error(msg)
        setErrorMsg(String(msg))
      } else {
        const data = await res.json()
        toast.success('Payment recorded')
        setAmount(""); setReference(""); setItems([])
        await loadRecent(selectedPatientId)
        // open receipt in new tab
        try { window.open(`/api/receipts/${data.id}`, '_blank') } catch {}
        setErrorMsg("")
      }
    } catch { toast.error('Failed to record payment') }
    finally { setCreating(false) }
  }

  if (!canManagePayments) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Payments are handled by the Cashier.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">If you need a payment recorded or exported, please contact the Cashier.</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Collect co-pays, export registers, and print receipts.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const payload = {
                dataset: 'payments',
                format: 'xlsx',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  method,
                  patientId: selectedPatientId || undefined,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `payments-${from}-${to}.xlsx`; a.click(); URL.revokeObjectURL(url)
            }}
          >Export XLSX</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const payload = {
                dataset: 'payments',
                format: 'pdf',
                filters: {
                  from: new Date(from+'T00:00:00Z').toISOString(),
                  to: new Date(to+'T23:59:59Z').toISOString(),
                  method,
                  patientId: selectedPatientId || undefined,
                },
              }
              const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              if (!res.ok) return
              const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `payments-${from}-${to}.pdf`; a.click(); URL.revokeObjectURL(url)
            }}
          >Export PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 space-y-2">
            <Input placeholder="Search patient" value={q} onChange={(e) => setQ(e.target.value)} />
            {selectedPatientId && (
              <div className="text-xs text-muted-foreground">
                Selected: {selectedPatient ? `${selectedPatient.patient_number} - ${selectedPatient.first_name} ${selectedPatient.last_name}` : selectedPatientId}
                <button type="button" className="ml-2 text-blue-600 hover:underline" onClick={() => setSelectedPatientId("")}>Clear</button>
              </div>
            )}
            {searching && (<div className="p-2 text-sm text-muted-foreground">Searching...</div>)}
            <div className="max-h-40 overflow-auto border rounded">
              {(patients || []).map((p) => (
                <button key={p.id} type="button" onClick={() => setSelectedPatientId(p.id)} className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedPatientId===p.id?'bg-muted':''}`}>
                  {p.patient_number} Ã¢â‚¬â€ {p.first_name} {p.last_name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="grid gap-2">
              <Input placeholder="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g,''))} />
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
              {errorMsg && (<div className="text-xs text-red-600">{errorMsg}</div>)}
              <Button onClick={create} disabled={creating}>
                {creating ? (
                  <span className="inline-flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</span>
                ) : (
                  'Record Payment'
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">From</label>
            <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">To</label>
            <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Method</label>
            <Select value={method} onValueChange={(v:any)=>setMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => loadRecent(selectedPatientId || undefined)}>Filter</Button>
            <Button
              variant="outline"
              onClick={async () => {
                const payload = {
                  dataset: 'payments',
                  format: 'xlsx',
                  filters: {
                    from: new Date(from+'T00:00:00Z').toISOString(),
                    to: new Date(to+'T23:59:59Z').toISOString(),
                    method,
                    patientId: selectedPatientId || undefined,
                  },
                }
                const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (!res.ok) return
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `payments-${from}-${to}.xlsx`; a.click(); URL.revokeObjectURL(url)
              }}
            >Export XLSX</Button>
            <Button
              variant="outline"
              onClick={async () => {
                const payload = {
                  dataset: 'payments',
                  format: 'pdf',
                  filters: {
                    from: new Date(from+'T00:00:00Z').toISOString(),
                    to: new Date(to+'T23:59:59Z').toISOString(),
                    method,
                    patientId: selectedPatientId || undefined,
                  },
                }
                const res = await fetch('/api/exports/direct', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (!res.ok) return
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `payments-${from}-${to}.pdf`; a.click(); URL.revokeObjectURL(url)
              }}
            >Export PDF</Button>
          </div>
        </div>
        <div className="rounded border p-3 space-y-2">
          <div className="text-sm font-medium">Line Items (optional)</div>
          {items.map((it, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-6 items-center">
              <Input className="md:col-span-4" placeholder="Description" value={it.description} onChange={(e)=>{ const next=[...items]; next[i].description=e.target.value; setItems(next) }} />
              <Input className="md:col-span-1" placeholder="Amount" inputMode="decimal" value={it.amount} onChange={(e)=>{ const next=[...items]; next[i].amount=e.target.value.replace(/[^0-9.]/g,''); setItems(next) }} />
              <Button variant="outline" onClick={()=>{ const next=[...items]; next.splice(i,1); setItems(next) }}>Remove</Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={()=>setItems([...items,{ description:'', amount:'' }])}>Add Item</Button>
            {items.length>0 && (
              <div className="text-sm text-muted-foreground">Total: {items.reduce((a,b)=>a+(Number(b.amount)||0),0).toLocaleString()}</div>
            )}
          </div>
        </div>

        <div className="rounded border divide-y">
          {recent.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No recent payments</div>
          ) : recent.map((r) => (
            <div key={r.id} className="p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{r.receipt_no} Ã¢â‚¬â€ {r.first_name} {r.last_name} ({r.patient_number})</div>
                <div className="text-muted-foreground">{r.method} Ã¢â‚¬Â¢ {new Date(r.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <div className="font-semibold">{r.amount.toLocaleString()}</div>
                <Button variant="outline" size="sm" onClick={() => { try { window.open(`/api/receipts/${r.id}`, '_blank') } catch {} }}>Receipt</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
