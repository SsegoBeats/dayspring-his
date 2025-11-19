"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
 
import { useNursing } from "@/lib/nursing-context"
import { PatientCareList } from "@/components/nursing/patient-care-list"
import { PatientCareView } from "@/components/nursing/patient-care-view"
import { Users, Activity, FileText, Clock, SortAsc, SortDesc, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePatients } from "@/lib/patient-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { formatPatientDigits } from "@/lib/patients"

export function NurseDashboard() {
  const { patients } = usePatients()
  const { vitalSigns, nursingNotes } = useNursing()
  const [selected, setSelected] = useState<{ id: string; tab?: 'vitals'|'notes' } | null>(null)
  const seenNotif = useRef<Set<string>>(new Set())

  const [todayVitalsCount, setTodayVitalsCount] = useState<number | null>(null)
  const [todayNotesCount, setTodayNotesCount] = useState<number | null>(null)
  const [latestVitals, setLatestVitals] = useState<any[]>([])
  const [latestLoading, setLatestLoading] = useState(false)
  const lastToastRef = useRef<{ vitals?: number; notes?: number; list?: number }>({})
  const [q, setQ] = useState("")
  const [sortBy, setSortBy] = useState<
    | 'patient'
    | 'pid'
    | 'time'
    | 'temp'
    | 'hr'
    | 'rr'
    | 'spo2'
    | 'bp'
  >('time')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc')
  const todayVitals = vitalSigns.filter((vs) => vs.date === new Date().toISOString().split("T")[0])
  const todayNotes = nursingNotes.filter((nn) => nn.date === new Date().toISOString().split("T")[0])

  // Fetch latest vitals summary for accurate today's count
  useEffect(() => {
    let stop = false
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/vitals/latest?since=today', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!stop && data?.summary?.todaysCount != null) setTodayVitalsCount(Number(data.summary.todaysCount))
      } catch {
        const now = Date.now();
        if (!lastToastRef.current.vitals || now - lastToastRef.current.vitals > 60000) {
          lastToastRef.current.vitals = now
          toast.error('Failed to load latest vitals')
        }
      }
    }
    fetchLatest()
    const t = setInterval(fetchLatest, 30000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  // Fetch latest notes summary too
  useEffect(() => {
    let stop = false
    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/nursing-notes/latest?since=today', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!stop && data?.summary?.todaysCount != null) setTodayNotesCount(Number(data.summary.todaysCount))
      } catch {
        const now = Date.now();
        if (!lastToastRef.current.notes || now - lastToastRef.current.notes > 60000) {
          lastToastRef.current.notes = now
          toast.error('Failed to load latest notes')
        }
      }
    }
    fetchLatest()
    const t = setInterval(fetchLatest, 30000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  // Load latest vitals table (and refetch on search)
  useEffect(() => {
    let stop = false
    const controller = new AbortController()
    const load = async () => {
      try {
        setLatestLoading(true)
        const url = new URL('/api/vitals/latest', window.location.origin)
        url.searchParams.set('since', 'today')
        if (q.trim()) url.searchParams.set('q', q.trim())
        const res = await fetch(url.toString(), { credentials: 'include', signal: controller.signal })
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (!stop && Array.isArray(data?.vitals)) setLatestVitals(data.vitals)
      } catch {
        const now = Date.now();
        if (!lastToastRef.current.list || now - lastToastRef.current.list > 60000) {
          lastToastRef.current.list = now
          toast.error('Failed to load latest vitals list')
        }
      }
      finally { setLatestLoading(false) }
    }
    const t = setTimeout(load, 250)
    return () => { stop = true; clearTimeout(t); controller.abort() }
  }, [q])

  const sortedVitals = latestVitals.slice().sort((a, b) => {
    const getPid = (v:any) => formatPatientDigits(v.patient_number)
    const timeA = new Date(a.recorded_at || a.created_at || Date.now()).getTime()
    const timeB = new Date(b.recorded_at || b.created_at || Date.now()).getTime()
    const tempA = a.temperature != null ? Number(a.temperature) : Number.NEGATIVE_INFINITY
    const tempB = b.temperature != null ? Number(b.temperature) : Number.NEGATIVE_INFINITY
    const hrA = a.heart_rate != null ? Number(a.heart_rate) : Number.NEGATIVE_INFINITY
    const hrB = b.heart_rate != null ? Number(b.heart_rate) : Number.NEGATIVE_INFINITY
    const rrA = a.respiratory_rate != null ? Number(a.respiratory_rate) : Number.NEGATIVE_INFINITY
    const rrB = b.respiratory_rate != null ? Number(b.respiratory_rate) : Number.NEGATIVE_INFINITY
    const sA = a.blood_pressure_systolic != null ? Number(a.blood_pressure_systolic) : Number.NEGATIVE_INFINITY
    const sB = b.blood_pressure_systolic != null ? Number(b.blood_pressure_systolic) : Number.NEGATIVE_INFINITY
    const spo2A = a.oxygen_saturation != null ? Number(a.oxygen_saturation) : Number.NEGATIVE_INFINITY
    const spo2B = b.oxygen_saturation != null ? Number(b.oxygen_saturation) : Number.NEGATIVE_INFINITY
    const nameA = `${a.first_name||''} ${a.last_name||''}`.trim().toLowerCase()
    const nameB = `${b.first_name||''} ${b.last_name||''}`.trim().toLowerCase()
    const pidA = getPid(a)
    const pidB = getPid(b)

    let cmp = 0
    switch (sortBy) {
      case 'patient': cmp = nameA.localeCompare(nameB); break
      case 'pid': cmp = pidA.localeCompare(pidB); break
      case 'time': cmp = timeA - timeB; break
      case 'temp': cmp = tempA - tempB; break
      case 'hr': cmp = hrA - hrB; break
      case 'rr': cmp = rrA - rrB; break
      case 'spo2': cmp = spo2A - spo2B; break
      case 'bp': cmp = sA - sB; break
      default: cmp = timeA - timeB
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const setSort = (col: typeof sortBy) => {
    setSortBy((prev) => {
      if (prev === col) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
        return prev
      } else {
        setSortOrder('desc')
        return col
      }
    })
  }
  // New patient toast via SSE notifications stream
  useEffect(() => {
    try {
      const hasCookie = typeof document !== 'undefined' && /(?:^|;\s)(session=|session_dev=)/.test(document.cookie)
      const tokenMatch = typeof document !== 'undefined' ? (document.cookie.match(/(?:^|;\s)session_dev=([^;]+)/) || document.cookie.match(/(?:^|;\s)session=([^;]+)/)) : null
      const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : (typeof localStorage !== 'undefined' ? localStorage.getItem('session_dev_bearer') : null)
      const url = new URL('/api/notifications/stream', window.location.origin)
      if (!hasCookie && token) url.searchParams.set('t', token as string)
      const es = new (window as any).EventSource(url.toString(), { withCredentials: true })
      es.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as any)
          const list = Array.isArray((data as any).notifications) ? (data as any).notifications : []
          list.forEach((n: any) => {
            if (!n?.id || seenNotif.current.has(n.id)) return
            if (String(n.title || '').includes('New Patient Registered')) {
              seenNotif.current.add(n.id)
              const name = (n?.message || '').replace(' has been registered.', '')
              toast.success(`New patient: ${name}`)
            }
          })
        } catch {}
      }
      es.onerror = () => { try { es.close() } catch {} }
      return () => { try { es.close() } catch {} }
    } catch {}
  }, [])

  // Dialog approach; keep dashboard visible and open patient care as a dialog

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Nurse Dashboard</h2>
        <p className="text-muted-foreground">Monitor patient vitals and care</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.length}</div>
            <p className="text-xs text-muted-foreground">Under care</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Vitals</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayVitalsCount ?? todayVitals.length}</div>
            <p className="text-xs text-muted-foreground">Recorded today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Notes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayNotesCount ?? todayNotes.length}</div>
            <p className="text-xs text-muted-foreground">Notes added</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vitalSigns.length}</div>
            <p className="text-xs text-muted-foreground">Vital sign records</p>
          </CardContent>
        </Card>
      </div>

      <PatientCareList onSelectPatient={(id, tab) => setSelected({ id, tab })} />

      <Card>
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle>Latest Vitals (Today)</CardTitle>
          <div className="w-64">
            <Input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Search by name or P.ID" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('pid')}>
                    <div className="flex items-center gap-1">P.ID {sortBy==='pid' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('patient')}>
                    <div className="flex items-center gap-1">Patient {sortBy==='patient' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('time')}>
                    <div className="flex items-center gap-1">Time {sortBy==='time' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('temp')}>
                    <div className="flex items-center gap-1">Temp {sortBy==='temp' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('hr')}>
                    <div className="flex items-center gap-1">HR {sortBy==='hr' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('rr')}>
                    <div className="flex items-center gap-1">RR {sortBy==='rr' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('spo2')}>
                    <div className="flex items-center gap-1">SpO2 {sortBy==='spo2' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={()=> setSort('bp')}>
                    <div className="flex items-center gap-1">BP {sortBy==='bp' ? (sortOrder==='asc'?<SortAsc className="h-3 w-3"/>:<SortDesc className="h-3 w-3"/>) : null}</div>
                  </TableHead>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Triage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground text-sm">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading latest vitals…</span>
                    </TableCell>
                  </TableRow>
                ) : latestVitals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground text-sm">
                      {q.trim() ? (
                        <span>No results for "{q.trim()}". <button className="underline" onClick={()=> setQ("")}>Clear search</button></span>
                      ) : (
                        <span>No vitals recorded today</span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedVitals.map((v) => {
                    const d = new Date(v.recorded_at || v.created_at || Date.now())
                    const minsAgo = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000))
                    const rel = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo/60)}h ago`
                    const pid = formatPatientDigits(v.patient_number)
                    const temp = v.temperature != null ? `${Number(v.temperature).toFixed(1)} °C` : ''
                    const hr = v.heart_rate != null ? `${v.heart_rate} bpm` : ''
                    const rr = v.respiratory_rate != null ? `${v.respiratory_rate}/min` : ''
                    const spo2 = v.oxygen_saturation != null ? `${v.oxygen_saturation}%` : ''
                    const bp = (v.blood_pressure_systolic != null && v.blood_pressure_diastolic != null)
                      ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`
                      : ''
                    const onOpenVitals = (e?: React.MouseEvent | React.KeyboardEvent) => { if (e) e.stopPropagation(); setSelected({ id: v.patient_id, tab: 'vitals' }) }
                    const onOpenNotes = (e?: React.MouseEvent | React.KeyboardEvent) => { if (e) e.stopPropagation(); setSelected({ id: v.patient_id, tab: 'notes' }) }
                    const onOpenTriage = (e?: React.MouseEvent | React.KeyboardEvent) => { if (e) e.stopPropagation(); setSelected({ id: v.patient_id, tab: 'triage' }) }
                    const onKeyDown = (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') return onOpenVitals(e)
                      if (e.key.toLowerCase() === 'v') return onOpenVitals(e)
                      if (e.key.toLowerCase() === 'n') return onOpenNotes(e)
                      if (e.key.toLowerCase() === 't') return onOpenTriage(e)
                    }
                    const triage = String(v.triage_category || '').trim()
                    const triageVariant = triage === 'Emergency' || triage === 'Very Urgent'
                      ? 'destructive'
                      : triage === 'Urgent' ? 'default' : 'secondary'
                    return (
                      <TableRow
                        key={v.id}
                        className="hover:bg-muted/40 cursor-pointer"
                        onClick={() => setSelected({ id: v.patient_id, tab: 'vitals' })}
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        aria-label={`Open patient ${[v.first_name, v.last_name].filter(Boolean).join(' ')}`}
                      >
                        <TableCell className="font-mono">{pid ? `P.${pid}` : ''}</TableCell>
                        <TableCell>{[v.first_name, v.last_name].filter(Boolean).join(' ')}</TableCell>
                        <TableCell>{d.toTimeString().slice(0,5)} <span className="text-xs text-muted-foreground">• {rel}</span></TableCell>
                        <TableCell>{temp}</TableCell>
                        <TableCell>{hr}</TableCell>
                        <TableCell>{rr}</TableCell>
                        <TableCell>{spo2}</TableCell>
                        <TableCell>{bp}</TableCell>
                        <TableCell>{v.nurse_name || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {triage ? <Badge variant={triageVariant as any}>{triage}</Badge> : <span className="text-xs text-muted-foreground">Not triaged</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-3">
                            <button type="button" className="text-blue-600 hover:underline" onClick={onOpenVitals} title="Record Vitals (V or Enter)">Record Vitals</button>
                            <button type="button" className="text-green-700 hover:underline" onClick={onOpenNotes} title="Add Nursing Note (N)">Add Note</button>
                            <button type="button" className="text-purple-700 hover:underline" onClick={onOpenTriage} title="Open Triage (T)">Triage</button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o)=> { if (!o) setSelected(null) }}>
        <DialogContent size="xl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected ? (()=>{
                const p = patients.find(x=>x.id===selected.id)
                if (!p) return 'Patient Care'
                const pid = formatPatientDigits(p.patientNumber)
                return `Patient Care – ${p.firstName} ${p.lastName}${pid ? ` (P.${pid})` : ''}`
              })() : 'Patient Care'}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <PatientCareView
              patientId={selected.id}
              initialTab={selected.tab || 'vitals'}
              onBack={() => setSelected(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
