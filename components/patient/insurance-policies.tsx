"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Payer = { id: string; name: string; payer_code?: string }
type Policy = { id: string; payer_id: string; payer_name: string; policy_no: string; coverage_notes?: string; active: boolean; payer_code?: string; updated_at?: string }

export function InsurancePolicies({ patientId }: { patientId: string }) {
  const [payers, setPayers] = useState<Payer[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [payerId, setPayerId] = useState<string>("")
  const [policyNo, setPolicyNo] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addingPayer, setAddingPayer] = useState(false)
  const [newPayerName, setNewPayerName] = useState("")
  const [newPayerCode, setNewPayerCode] = useState("")
  const [noteEdits, setNoteEdits] = useState<Record<string,string>>({})
  const [savingCoverageId, setSavingCoverageId] = useState<string | null>(null)
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      const [payersRes, policiesRes] = await Promise.all([
        fetch('/api/insurance/payers', { credentials: 'include' }),
        fetch(`/api/insurance/policies?patientId=${patientId}`, { credentials: 'include' })
      ])
      if (payersRes.ok) setPayers((await payersRes.json()).payers || [])
      else if (payersRes.status === 401 || payersRes.status === 403) {
        setPayers([])
      }
      if (policiesRes.ok) {
        const data = (await policiesRes.json()).policies || []
        setPolicies(data)
        const edits: Record<string,string> = {}
        data.forEach((pol: Policy) => {
          if (pol.coverage_notes) edits[pol.id] = pol.coverage_notes
        })
        setNoteEdits(edits)
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [patientId])

  const addPolicy = async () => {
    if (!payerId || !policyNo) { toast.error('Select payer and enter policy number'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/insurance/policies', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, payerId, policyNo, coverageNotes: notes || null })
      })
      if (!res.ok) { const e = await res.json().catch(()=>({})); toast.error(e.error || 'Failed to add policy') }
      else { toast.success('Policy added'); setPolicyNo(''); setNotes(''); await load() }
    } catch { toast.error('Failed to add policy') } finally { setCreating(false) }
  }

  const toggleActive = async (id: string, active: boolean) => {
    try {
      const res = await fetch(`/api/insurance/policies?id=${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ active }) })
      if (!res.ok) { toast.error('Failed to update policy') } else { await load() }
    } catch { toast.error('Failed to update policy') }
  }

  const saveCoverageNotes = async (id: string, coverage: string) => {
    setSavingCoverageId(id)
    try {
      const res = await fetch(`/api/insurance/policies?id=${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ coverageNotes: coverage || null }),
      })
      if (!res.ok) {
        toast.error('Failed to save coverage notes')
      } else {
        toast.success('Coverage notes saved')
        await load()
      }
    } catch {
      toast.error('Failed to save coverage notes')
    } finally {
      setSavingCoverageId(null)
    }
  }

  const deletePolicy = async (id: string) => {
    if (!window.confirm("Remove this policy from the patient?")) return
    setDeletingPolicyId(id)
    try {
      const res = await fetch(`/api/insurance/policies?id=${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to delete policy')
      } else {
        toast.success('Policy deleted')
        await load()
      }
    } catch {
      toast.error('Failed to delete policy')
    } finally {
      setDeletingPolicyId(null)
    }
  }

  const addPayer = async () => {
    if (!newPayerName) { toast.error('Enter payer name'); return }
    setAddingPayer(true)
    try {
      const res = await fetch('/api/insurance/payers', { method: 'POST', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ name: newPayerName, payerCode: newPayerCode || null }) })
      if (!res.ok) { const e = await res.json().catch(()=>({})); toast.error(e.error||'Failed to add payer') }
      else { setNewPayerName(''); setNewPayerCode(''); await load(); toast.success('Payer added') }
    } catch { toast.error('Failed to add payer') } finally { setAddingPayer(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Insurance</CardTitle>
        <CardDescription>Policies attached to this patient</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Select value={payerId} onValueChange={setPayerId} disabled={payers.length === 0}>
              <SelectTrigger disabled={payers.length === 0}>
                <SelectValue placeholder={payers.length === 0 ? "No payers found — add below" : "Select payer"} />
              </SelectTrigger>
              <SelectContent>
                {payers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No payers found. Add one below.</div>
                ) : (
                  payers.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))
                )}
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Policy No" value={policyNo} onChange={(e)=>setPolicyNo(e.target.value)} />
          <Input placeholder="Coverage notes (optional)" value={notes} onChange={(e)=>setNotes(e.target.value)} />
        </div>
        <Button onClick={addPolicy} disabled={creating || payers.length === 0}>{creating? 'Adding...':'Add Policy'}</Button>

        <div className="rounded border divide-y">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Loading...</div>
          ) : policies.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No policies</div>
          ) : policies.map((pol) => {
            const coverageValue = noteEdits[pol.id] ?? pol.coverage_notes ?? ""
            return (
              <div key={pol.id} className="p-3 text-sm space-y-3 border-b last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">{pol.payer_name}</div>
                    <div className="text-xs text-muted-foreground">{pol.policy_no}</div>
                    {pol.payer_code && (
                      <div className="text-xs text-muted-foreground">Code: {pol.payer_code}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch checked={!!pol.active} onCheckedChange={(v)=>toggleActive(pol.id, v)} />
                    </div>
                    <Button size="sm" variant="destructive" onClick={() => deletePolicy(pol.id)} disabled={deletingPolicyId === pol.id}>
                      {deletingPolicyId === pol.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground font-semibold">Coverage notes</div>
                  <Textarea
                    value={coverageValue}
                    placeholder="Add a short description of what this policy covers"
                    onChange={(e) => setNoteEdits((prev) => ({ ...prev, [pol.id]: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveCoverageNotes(pol.id, coverageValue)}
                    disabled={savingCoverageId === pol.id}
                  >
                    {savingCoverageId === pol.id ? 'Saving...' : 'Save notes'}
                  </Button>
                  <span className="text-xs text-muted-foreground">Last updated: {pol.updated_at ? new Date(pol.updated_at).toLocaleString() : "—"}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded border p-3 space-y-2">
          <div className="text-sm font-medium">Add New Payer</div>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
            <Input placeholder="Payer Name" value={newPayerName} onChange={(e)=>setNewPayerName(e.target.value)} />
            <Input placeholder="Payer Code (optional)" value={newPayerCode} onChange={(e)=>setNewPayerCode(e.target.value)} />
            <Button onClick={addPayer} disabled={addingPayer}>{addingPayer?'Adding...':'Add Payer'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

