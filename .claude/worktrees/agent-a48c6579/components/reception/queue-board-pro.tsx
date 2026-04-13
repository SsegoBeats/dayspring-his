"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { runExport } from "@/lib/reception-export-utils"
import { RECEPTION_DEPARTMENTS } from "@/lib/constants/departments"
import { formatPatientNumber } from "@/lib/patients"
import { ScrollArea } from "@/components/ui/scroll-area"

const LANE_HEIGHT_CLASS = "h-[36rem]"

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
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve())

  const loadLane = useCallback(async (st: 'waiting'|'in_service'|'done') => {
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
  }, [department])

  const load = useCallback(async () => {
    try { setLoading(true); await Promise.all([loadLane("waiting"), loadLane("in_service"), loadLane("done")]) }
    finally { setLoading(false) }
  }, [loadLane])
  loadRef.current = load

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      return
    }
    const INTERVAL_MS = 30_000
    autoRefreshIntervalRef.current = setInterval(() => { loadRef.current() }, INTERVAL_MS)
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    }
  }, [autoRefresh, load])

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
      const res = await fetch(`/api/queues?id=${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_priority', priority }) })
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

  type LaneStatus = 'waiting' | 'in_service' | 'done'

  const statusAction = (target: LaneStatus): 'advance' | 'start' | 'done' | 'cancel' | 'waiting' =>
    target === 'in_service' ? 'start' : target === 'done' ? 'done' : 'waiting'

  const handleDropToLane = async (srcId: string, targetStatus: LaneStatus, targetId?: string, place?: 'before' | 'after') => {
    try {
      const action = statusAction(targetStatus)
      const statusRes = await fetch(`/api/queues?id=${srcId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action === 'waiting' ? 'waiting' : action }),
      })
      if (!statusRes.ok) {
        const err = await statusRes.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || 'Failed to move entry')
        return
      }
      const reorderBody: Record<string, unknown> = { action: 'reorder', department: department || undefined, statusCtx: targetStatus }
      if (targetId) {
        reorderBody.targetId = targetId
        reorderBody.place = place ?? 'after'
      }
      const reorderRes = await fetch(`/api/queues?id=${srcId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reorderBody),
      })
      if (!reorderRes.ok) {
        const err = await reorderRes.json().catch(() => ({}))
        toast.error((err as { error?: string }).error || 'Failed to reorder entry')
        await load()
        return
      }
      toast.success('Entry moved')
      await load()
    } catch {
      toast.error('Failed to move entry')
    }
  }

  const handleDropOnCard = async (
    srcId: string,
    srcStatus: LaneStatus,
    targetLaneStatus: LaneStatus,
    targetId: string,
    place: 'before' | 'after',
  ) => {
    if (srcId === targetId) return
    const sameLane = srcStatus === targetLaneStatus
    if (sameLane) {
      try {
        const res = await fetch(`/api/queues?id=${srcId}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', targetId, place, department: department || undefined, statusCtx: targetLaneStatus }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error((err as { error?: string }).error || 'Failed to reorder')
          return
        }
        toast.success('Order updated')
        await load()
      } catch {
        toast.error('Failed to reorder')
      }
      return
    }
    await handleDropToLane(srcId, targetLaneStatus, targetId, place)
  }

  return (
    <Card className="border-sky-100 bg-white/95 shadow-sm">
      <CardHeader>
        <CardTitle>Department Queue</CardTitle>
        <CardDescription>Track and advance patients through the queue.</CardDescription>
        <div className="mt-2 text-xs text-muted-foreground space-y-1">
          <p>Drag between lanes; drop on a card to position (hold Shift for before).</p>
          <p>Keyboard when a card is focused: <kbd className="rounded border bg-muted px-1">A</kbd> = Start service, <kbd className="rounded border bg-muted px-1">D</kbd> = Done, <kbd className="rounded border bg-muted px-1">C</kbd> = Cancel.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56 space-y-1">
            <Label htmlFor="queue-department-filter" className="text-xs text-muted-foreground block">Department (board + exports)</Label>
            <Select value={department} onValueChange={(v: string) => setDepartment(v === "__CLEAR__" ? "" : v)}>
              <SelectTrigger id="queue-department-filter" aria-label="Filter by department"><SelectValue placeholder="All departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__CLEAR__">All</SelectItem>
                {RECEPTION_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => load()} disabled={loading} aria-label="Refresh queue">
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <div className="flex items-center gap-2">
              <Switch id="queue-auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <Label htmlFor="queue-auto-refresh" className="text-xs text-muted-foreground whitespace-nowrap">
                Auto-refresh (30s)
              </Label>
            </div>
          </div>
          <div className="flex items-end gap-2 border-l pl-2 border-border/50">
            <span className="text-xs text-muted-foreground self-center hidden sm:inline">Export period:</span>
            <div className="space-y-1">
              <Label htmlFor="queue-export-from" className="text-xs text-muted-foreground sr-only">Export from date</Label>
              <input id="queue-export-from" name="queueExportFrom" className="border rounded px-2 py-1 text-sm w-36" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Export from date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="queue-export-to" className="text-xs text-muted-foreground sr-only">Export to date</Label>
              <input id="queue-export-to" name="queueExportTo" className="border rounded px-2 py-1 text-sm w-36" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Export to date" />
            </div>
            <div className="w-44">
              <Label htmlFor="queue-export-status" className="text-xs text-muted-foreground sr-only">Export status filter</Label>
              <Select
                value={statusFilter}
                onValueChange={(v: string) =>
                  setStatusFilter(v === "__CLEAR__" ? "" : (v as "waiting" | "in_service" | "done" | "cancelled"))
                }
              >
                <SelectTrigger id="queue-export-status" aria-label="Export status filter"><SelectValue placeholder="Any Status" /></SelectTrigger>
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
              onClick={async () => {
                await runExport(
                  {
                    dataset: "queue_events",
                    format: "xlsx",
                    filters: {
                      from: new Date(from + "T00:00:00Z").toISOString(),
                      to: new Date(to + "T23:59:59Z").toISOString(),
                      department: department || undefined,
                      status: statusFilter || undefined,
                    },
                  },
                  `queue-events-${from}-${to}.xlsx`,
                  {
                    onError: (msg) => toast.error("Queue events XLSX failed", { description: msg }),
                    onSuccess: () => toast.success(`Downloaded queue-events-${from}-${to}.xlsx`),
                  }
                )
              }}
            >
              Export Queue Events
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await runExport(
                  {
                    dataset: "queue_events",
                    format: "csv",
                    filters: {
                      from: new Date(from + "T00:00:00Z").toISOString(),
                      to: new Date(to + "T23:59:59Z").toISOString(),
                      department: department || undefined,
                      status: statusFilter || undefined,
                    },
                  },
                  `queue-events-${from}-${to}.csv`,
                  {
                    onError: (msg) => toast.error("Queue events CSV failed", { description: msg }),
                    onSuccess: () => toast.success(`Downloaded queue-events-${from}-${to}.csv`),
                  }
                )
              }}
            >
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {([
            { title: 'Waiting', status: 'waiting', data: waiting },
            { title: 'In Service', status: 'in_service', data: inService },
            { title: 'Done', status: 'done', data: done },
          ] as const).map((lane) => (
            <div key={lane.status} className="overflow-hidden rounded border min-h-[200px]"
              onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='move' }}
              onDrop={(e)=>{
                e.preventDefault()
                let srcId: string
                try {
                  const raw = e.dataTransfer.getData('text/plain')
                  const parsed = raw.startsWith('{') ? JSON.parse(raw) as { id: string; status?: LaneStatus } : { id: raw }
                  srcId = parsed.id
                } catch { srcId = e.dataTransfer.getData('text/plain') }
                if (!srcId) return
                handleDropToLane(srcId, lane.status)
              }}
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
              <ScrollArea className={LANE_HEIGHT_CLASS}>
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
                        className={`p-3 border-t transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${cls}`}
                        draggable
                        onDragStart={(e)=>{
                          e.dataTransfer.setData('text/plain', JSON.stringify({ id: r.id, status: lane.status }))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e)=>{ e.preventDefault(); e.currentTarget.classList.add('bg-emerald-50'); e.dataTransfer.dropEffect='move' }}
                        onDragLeave={(e)=>{ e.currentTarget.classList.remove('bg-emerald-50') }}
                        onDrop={(e)=>{
                          e.preventDefault()
                          e.currentTarget.classList.remove('bg-emerald-50')
                          let srcId: string
                          let srcStatus: LaneStatus
                          try {
                            const raw = e.dataTransfer.getData('text/plain')
                            const parsed = raw.startsWith('{') ? JSON.parse(raw) as { id: string; status: LaneStatus } : { id: raw, status: lane.status }
                            srcId = parsed.id
                            srcStatus = parsed.status ?? lane.status
                          } catch { srcId = e.dataTransfer.getData('text/plain'); srcStatus = lane.status }
                          if (!srcId || srcId === r.id) return
                          const place: 'before' | 'after' = e.shiftKey ? 'before' : 'after'
                          handleDropOnCard(srcId, srcStatus, lane.status, r.id, place)
                        }}
                        tabIndex={0}
                        onKeyDown={(e)=>{
                          if (e.key === 'a' || e.key === 'A') { update(r.id, 'start') }
                          if (e.key === 'd' || e.key === 'D') { update(r.id, 'done') }
                          if (e.key === 'c' || e.key === 'C') { update(r.id, 'cancel') }
                        }}
                      >
                        {/* Patient info row */}
                        <div className="mb-2">
                          <div className="text-sm font-semibold text-foreground leading-snug">
                            {formatPatientNumber(r.patient_number)} — {r.first_name} {r.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.department} | Priority {r.priority} | #{r.position}
                          </div>
                          {lane.status === 'waiting' && typeof r.waiting_minutes === 'number' && (
                            <div className="text-xs font-medium mt-0.5 text-amber-700">
                              Waiting {Math.max(0, Math.round(r.waiting_minutes))} min
                            </div>
                          )}
                          {lane.status === 'in_service' && typeof r.in_service_minutes === 'number' && (
                            <div className="text-xs font-medium mt-0.5 text-emerald-700">
                              In service {Math.max(0, Math.round(r.in_service_minutes))} min
                            </div>
                          )}
                        </div>
                        {/* Action buttons row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Lower priority" onClick={() => setPriority(r.id, Math.max(0, r.priority - 1))}>-</Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Raise priority" onClick={() => setPriority(r.id, r.priority + 1)}>+</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" title="Move to top of lane" onClick={() => fetch(`/api/queues?id=${r.id}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'top', department: department || undefined, statusCtx: lane.status }) }).then(()=>load())}>Top</Button>
                          {lane.status === 'waiting' && (
                            <>
                              <Button size="sm" className="h-7 px-2" onClick={() => update(r.id, 'start')}>Start</Button>
                              <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => update(r.id, 'advance')}>Advance</Button>
                              <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => update(r.id, 'cancel')}>Cancel</Button>
                            </>
                          )}
                          {lane.status === 'in_service' && (
                            <Button size="sm" className="h-7 px-2" onClick={() => update(r.id, 'done')}>Mark Done</Button>
                          )}
                          {lane.status === 'done' && (
                            <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => handleDeleteDone(r.id)}>Remove</Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
