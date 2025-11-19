"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

type QueueRow = {
  id: string
  department: string
  status: 'waiting' | 'in_service' | 'done' | 'cancelled'
  priority: number
  position: number
  patient_id: string
  first_name: string
  last_name: string
  patient_number: string
  waiting_minutes?: number
  in_service_minutes?: number
}

export function QueueBoardPro() {
  const [department, setDepartment] = useState<string>("")
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0,10))
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10))
  const [statusFilter, setStatusFilter] = useState<'waiting'|'in_service'|'done'|'cancelled'|''>('')
  const [warn, setWarn] = useState<{ wait: number; critWait: number; svc: number; critSvc: number }>({ wait: 30, critWait: 60, svc: 30, critSvc: 60 })
  const [waiting, setWaiting] = useState<QueueRow[]>([])
  const [inService, setInService] = useState<QueueRow[]>([])
  const [done, setDone] = useState<QueueRow[]>([])
  const [loading, setLoading] = useState(false)

  async function loadLane(st: 'waiting'|'in_service'|'done') {
    const url = new URL('/api/queues', window.location.origin)
    if (department) url.searchParams.set('department', department)
    url.searchParams.set('status', st)
    const res = await fetch(url.toString(), { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      if (st === 'waiting') setWaiting(data.queue || [])
      if (st === 'in_service') setInService(data.queue || [])
      if (st === 'done') setDone(data.queue || [])
    }
  }

  async function load() {
    try { setLoading(true); await Promise.all([loadLane('waiting'), loadLane('in_service'), loadLane('done')]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [department])
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/preferences', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setWarn({
            wait: Number(data?.preferences?.queue_wait_warn) || 30,
            critWait: Number(data?.preferences?.queue_wait_crit) || 60,
            svc: Number(data?.preferences?.service_warn) || 30,
            critSvc: Number(data?.preferences?.service_crit) || 60,
          })
        }
      } catch {}
    })()
  }, [])

  const update = async (id: string, action: 'advance'|'start'|'done'|'cancel') => {
    try {
      const res = await fetch(`/api/queues?id=${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || 'Failed to update queue')
      } else { toast.success('Updated'); load() }
    } catch { toast.error('Failed to update queue') }
  }

  const setPriority = async (id: string, priority: number) => {
    try {
      const res = await fetch(`/api/queues?id=${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance', priority }) })
      if (!res.ok) { toast.error('Failed to update priority') } else { load() }
    } catch { toast.error('Failed to update priority') }
  }

  const handleDeleteDone = async (id: string) => {
    if (!window.confirm("Remove this completed entry from the queue?")) return
    try {
      const res = await fetch(`/api/queues?id=${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to remove entry')
      } else {
        toast.success('Entry removed')
        load()
      }
    } catch {
      toast.error('Failed to remove entry')
    }
  }

  const handleDropToLane = async (srcId: string, targetStatus: 'waiting'|'in_service'|'done', targetId?: string) => {
    try {
      const action = targetStatus === 'in_service' ? 'start' : targetStatus === 'done' ? 'done' : 'waiting'
      await fetch(`/api/queues?id=${srcId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ action }) })
      const body: any = { action: 'reorder', department: department || undefined, statusCtx: targetStatus }
      if (targetId) { body.targetId = targetId; body.place = 'after' }
      const res = await fetch(`/api/queues?id=${srcId}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('reorder failed')
      await load()
    } catch { toast.error('Failed to move entry') }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Queue</CardTitle>
        <CardDescription>Track and advance patients through the queue.</CardDescription>
        <div className="mt-2 text-xs text-muted-foreground">
          Tips: Drag between lanes. Drop on a card to position (hold Shift for before). Keyboard: A = Start/Advance, D = Done, C = Cancel.
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-56">
            <Select value={department} onValueChange={(v:any)=> setDepartment(v === '__CLEAR__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">All</SelectItem>
                <SelectItem value="General">General</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                <SelectItem value="Surgery">Surgery</SelectItem>
                <SelectItem value="Radiology">Radiology</SelectItem>
                <SelectItem value="Laboratory">Laboratory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <input className="border rounded px-2 py-1 text-sm" type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <input className="border rounded px-2 py-1 text-sm" type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
            </div>
            <div className="w-44">
              <Select value={statusFilter} onValueChange={(v:any)=>setStatusFilter(v === '__CLEAR__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Any Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__CLEAR__">Any Status</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="in_service">In Service</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={async ()=>{
                const payload = {
                  dataset: 'queue_events',
                  format: 'xlsx',
                  filters: {
                    from: new Date(from+'T00:00:00Z').toISOString(),
                    to: new Date(to+'T23:59:59Z').toISOString(),
                    department: department || undefined,
                    status: statusFilter || undefined,
                  },
                }
                const res = await fetch('/api/exports/direct', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
                if (!res.ok) return
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`queue-events-${from}-${to}.xlsx`; a.click(); URL.revokeObjectURL(url)
              }}
            >Export Queue Events</Button>
            <Button
              variant="outline"
              onClick={async ()=>{
                const payload = {
                  dataset: 'queue_events',
                  format: 'csv',
                  filters: {
                    from: new Date(from+'T00:00:00Z').toISOString(),
                    to: new Date(to+'T23:59:59Z').toISOString(),
                    department: department || undefined,
                    status: statusFilter || undefined,
                  },
                }
                const res = await fetch('/api/exports/direct', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
                if (!res.ok) return
                const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`queue-events-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(url)
              }}
            >Export CSV</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {([
            { title: 'Waiting', status: 'waiting', data: waiting },
            { title: 'In Service', status: 'in_service', data: inService },
            { title: 'Done', status: 'done', data: done },
          ] as const).map((lane) => (
            <div key={lane.status} className="rounded border min-h-[200px]"
              onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move' }}
              onDrop={(e)=>{ e.preventDefault(); const src=e.dataTransfer.getData('text/plain'); if (!src) return; handleDropToLane(src, lane.status) }}
            >
              <div className="px-3 py-2 text-sm font-semibold bg-muted/50 flex items-center justify-between">
                <span>{lane.title}</span>
                <span className="text-xs font-normal">
                  {(() => {
                    if (lane.data.length === 0) return null
                    if (lane.status === 'waiting') {
                      const vals = lane.data.filter(r=>typeof r.waiting_minutes==='number').map(r=>r.waiting_minutes as number)
                      const avg = Math.round((vals.reduce((a,b)=>a+(b||0),0)) / Math.max(1, vals.length))
                      const cls = avg > 60 ? 'text-red-600' : avg > 30 ? 'text-amber-600' : 'text-muted-foreground'
                      return <span className={cls}>Avg: {avg} min</span>
                    }
                    if (lane.status === 'in_service') {
                      const vals = lane.data.filter(r=>typeof r.in_service_minutes==='number').map(r=>r.in_service_minutes as number)
                      const avg = Math.round((vals.reduce((a,b)=>a+(b||0),0)) / Math.max(1, vals.length))
                      const cls = avg > 60 ? 'text-red-600' : avg > 30 ? 'text-amber-600' : 'text-muted-foreground'
                      return <span className={cls}>Avg: {avg} min</span>
                    }
                    return null
                  })()}
                </span>
              </div>
              <div>
                {(lane.data || []).length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No entries</div>
                ) : lane.data.map((r) => {
                  const cls = (() => {
                    if (lane.status === 'waiting') {
                      const v = typeof r.waiting_minutes === 'number' ? r.waiting_minutes : 0
                      if (v >= warn.critWait) return 'bg-red-50'
                      if (v >= warn.wait) return 'bg-amber-50'
                      return ''
                    }
                    if (lane.status === 'in_service') {
                      const v = typeof r.in_service_minutes === 'number' ? r.in_service_minutes : 0
                      if (v >= warn.critSvc) return 'bg-red-50'
                      if (v >= warn.svc) return 'bg-amber-50'
                      return ''
                    }
                    return ''
                  })()
                  return (
                    <div
                      key={r.id}
                      className={`p-3 flex items-center justify-between border-t transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${cls}`}
                      draggable
                      onDragStart={(e)=>{ e.dataTransfer.setData('text/plain', r.id); e.dataTransfer.effectAllowed='move' }}
                      onDragOver={(e)=>{ e.preventDefault(); e.currentTarget.classList.add('bg-emerald-50'); e.dataTransfer.dropEffect='move' }}
                      onDragLeave={(e)=>{ e.currentTarget.classList.remove('bg-emerald-50') }}
                      onDrop={(e)=>{ e.preventDefault(); e.currentTarget.classList.remove('bg-emerald-50'); const src=e.dataTransfer.getData('text/plain'); if (!src || src===r.id) return; const before=e.shiftKey; fetch(`/api/queues?id=${src}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'reorder', targetId: r.id, place: before?'before':'after', department: department || undefined, statusCtx: lane.status }) }).then(()=>load()) }}
                      tabIndex={0}
                      onKeyDown={(e)=>{
                        if (e.key === 'a' || e.key === 'A') { update(r.id, 'start') }
                        if (e.key === 'd' || e.key === 'D') { update(r.id, 'done') }
                        if (e.key === 'c' || e.key === 'C') { update(r.id, 'cancel') }
                      }}
                    >
                      <div className="text-sm">
                        <div className="font-medium">{r.patient_number} - {r.first_name} {r.last_name}</div>
                        <div className="text-muted-foreground">{r.department} | Priority {r.priority} | Position {r.position}</div>
                        {lane.status === 'waiting' && typeof r.waiting_minutes === 'number' && (
                          <div className="text-xs text-amber-600">Waiting: {Math.max(0, Math.round(r.waiting_minutes))} min</div>
                        )}
                        {lane.status === 'in_service' && typeof r.in_service_minutes === 'number' && (
                          <div className="text-xs text-emerald-600">In Service: {Math.max(0, Math.round(r.in_service_minutes))} min</div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setPriority(r.id, Math.max(0, r.priority - 1))}>-</Button>
                          <Button size="sm" variant="outline" onClick={() => setPriority(r.id, r.priority + 1)}>+</Button>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => fetch(`/api/queues?id=${r.id}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'top', department: department || undefined, statusCtx: lane.status }) }).then(()=>load())}>Top</Button>
                        {lane.status === 'waiting' && (
                          <>
                            <Button size="sm" onClick={() => update(r.id, 'start')}>Start</Button>
                            <Button size="sm" variant="secondary" onClick={() => update(r.id, 'advance')}>Advance</Button>
                            <Button size="sm" variant="destructive" onClick={() => update(r.id, 'cancel')}>Cancel</Button>
                          </>
                        )}
                        {lane.status === 'in_service' && (
                          <Button size="sm" onClick={() => update(r.id, 'done')}>Mark Done</Button>
                        )}
                        {lane.status === 'done' && (
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteDone(r.id)}>Remove</Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
