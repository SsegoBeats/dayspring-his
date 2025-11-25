"use client"

import type { LabTest } from "@/lib/lab-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FileText } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface LabTestQueueProps {
  tests: LabTest[]
  onSelectTest: (testId: string) => void
  emptyMessage: string
}

export function LabTestQueue({ tests, onSelectTest, emptyMessage }: LabTestQueueProps & { loading?: boolean }) {
  const [q, setQ] = (require('react') as any).useState('')
  const [status, setStatus] = (require('react') as any).useState<'all'|'pending'|'inprogress'|'completed'|'cancelled'>('all')
  const [prio, setPrio] = (require('react') as any).useState<'all'|'routine'|'stat'>('all')
  const [showSuggestions, setShowSuggestions] = (require('react') as any).useState(false)
  const [viewPatient, setViewPatient] = (require('react') as any).useState<{ id: string; name: string } | null>(null)
  const filtered = tests.filter(t => {
    const s = (t.status || '').toLowerCase()
    const p = (t.priority || '').toLowerCase()
    const okS = status === 'all' || (status==='pending' && s==='pending') || (status==='inprogress' && s==='in progress') || (status==='completed' && s==='completed') || (status==='cancelled' && s==='cancelled')
    const okP = prio === 'all' || (prio==='routine' && p==='routine') || (prio==='stat' && p==='stat')
    const okQ = !q.trim() || [t.patientName,t.testName,t.accessionNumber].filter(Boolean).some(v=> String(v).toLowerCase().includes(q.toLowerCase()))
    return okS && okP && okQ
  })
  const minsBetween = (a?: string|null, b?: string|null) => {
    if (!a) return null
    const t1 = new Date(a).getTime()
    const t2 = b ? new Date(b).getTime() : Date.now()
    return Math.max(0, Math.round((t2 - t1)/60000))
  }
  const flagCounts = (t: LabTest) => {
    try {
      const res = (t.results || '').toString()
      if (!res) return { H: 0, L: 0 }
      const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP)\s*:\s*([^\n]+)/ig
      const toNum = (s:string) => { const m = String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
      const sex = (t.patientGender || '').toLowerCase()
      const ageYears = (() => {
        const dob = t.patientDob ? new Date(t.patientDob) : null
        if (!dob || isNaN(dob.getTime())) return undefined
        const n = new Date(); let y = n.getFullYear() - dob.getFullYear(); const m = n.getMonth()-dob.getMonth(); if(m<0||(m===0&&n.getDate()<dob.getDate())) y--; return Math.max(0,y)
      })()
      const ref = (k:string): [number|null, number|null] => {
        switch (k) {
          case 'Hb': {
            if (typeof ageYears === 'number' && ageYears < 12) return [11.5, 15.5]
            const female = sex === 'female'; return [female ? 12 : 13, female ? 15.5 : 17]
          }
          case 'WBC': { if (typeof ageYears === 'number' && ageYears < 12) return [5, 15]; return [4, 11] }
          case 'Platelets': return [150, 450]
          case 'HCT': { if (typeof ageYears === 'number' && ageYears < 12) return [35, 45]; const female = sex === 'female'; return [female ? 36 : 40, female ? 46 : 52] }
          case 'MCV': { if (typeof ageYears === 'number' && ageYears < 12) return [75, 95]; return [80, 100] }
          case 'Neut': return [40, 75]
          case 'Lymph': return [20, 45]
          case 'Mono': return [2, 10]
          case 'Eos': return [1, 6]
          case 'Baso': return [0, 2]
          case 'RBS': return [3.9, 7.8]
          case 'ALT': return [7, 55]
          case 'AST': return [8, 48]
          case 'ALP': { if (typeof ageYears === 'number' && ageYears < 12) return [100, 350]; return [40, 130] }
          default: return [null, null]
        }
      }
      let m: RegExpExecArray | null
      let H = 0, L = 0
      while ((m = rx.exec(res)) != null) {
        const k = m[1].replace(/\s+/g,' ')
        const v = m[2].trim()
        const [lo, hi] = ref(k)
        const val = toNum(v)
        if (val != null && lo != null && hi != null) {
          if (val < lo) L++
          else if (val > hi) H++
        }
      }
      return { H, L }
    } catch { return { H: 0, L: 0 } }
  }

  const loading = (globalThis as any).React?.useContext ? undefined : undefined
  const anyFilters = q.trim() || status !== 'all' || prio !== 'all'

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Laboratory Tests</CardTitle>
        <CardDescription>View and manage laboratory test requests</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Input
              placeholder="Search by patient, test, accession"
              value={q}
              onFocus={()=> setShowSuggestions(true)}
              onBlur={()=> setTimeout(()=> setShowSuggestions(false), 120)}
              onChange={(e:any)=> setQ(e.target.value)}
            />
            {showSuggestions && q.trim().length >= 2 && filtered.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-sm max-h-48 overflow-auto text-xs">
                {filtered.slice(0,6).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/70 text-left"
                    onMouseDown={(ev:any)=> { ev.preventDefault(); setQ(t.patientName || t.testName || (t.accessionNumber || '')); }}
                  >
                    <span className="truncate mr-2">{t.patientName || '-'} · {t.testName}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{t.accessionNumber || '-'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e)=> setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="border rounded px-2 py-1 text-sm" value={prio} onChange={(e)=> setPrio(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="routine">Routine</option>
            <option value="stat">STAT</option>
          </select>
          <div className="text-xs text-muted-foreground ml-auto">{filtered.length} of {tests.length}</div>
        </div>
        {anyFilters && (
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            {q.trim() && (
              <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={()=> setQ('')}>
                <span>Search:</span>
                <span className="font-medium">{q}</span>
                <span className="text-slate-400">×</span>
              </button>
            )}
            {status !== 'all' && (
              <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={()=> setStatus('all')}>
                <span>Status:</span>
                <span className="font-medium capitalize">{status}</span>
                <span className="text-slate-400">×</span>
              </button>
            )}
            {prio !== 'all' && (
              <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={()=> setPrio('all')}>
                <span>Priority:</span>
                <span className="font-medium uppercase">{prio}</span>
                <span className="text-slate-400">×</span>
              </button>
            )}
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="py-2 px-2">Accession</th>
                  <th className="py-2 px-2">Patient</th>
                  <th className="py-2 px-2">Test</th>
                  <th className="py-2 px-2">Priority</th>
                  <th className="py-2 px-2">Specimen</th>
                  <th className="py-2 px-2">Ordered</th>
                  <th className="py-2 px-2">Aging/TAT</th>
                  <th className="py-2 px-2">Flags</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((test) => {
                  const s = (test.status || '').toLowerCase()
                  const mins = s==='completed' ? minsBetween(test.orderedAt, test.completedAt || undefined) : minsBetween(test.orderedAt, undefined)
                  const agingBadge = (()=>{
                    if (mins == null) return null
                    const label = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`
                    const cls = s==='completed' ? 'bg-green-100 text-green-800 border-green-200' : mins > 240 ? 'bg-red-100 text-red-800 border-red-200' : mins > 120 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                    return <span className={`rounded px-1.5 py-0.5 text-[10px] border ${cls}`}>{label}</span>
                  })()
                  return (
                  <tr key={test.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 px-2 font-mono">{test.accessionNumber || '-'}</td>
                    <td className="py-2 px-2">{test.patientName}</td>
                    <td className="py-2 px-2">{test.testName}</td>
                    <td className="py-2 px-2">{test.priority || 'Routine'}</td>
                    <td className="py-2 px-2">{test.specimenType || '-'}</td>
                    <td className="py-2 px-2">{new Date(test.orderedAt).toLocaleString()}</td>
                    <td className="py-2 px-2">{agingBadge}</td>
                    <td className="py-2 px-2">
                      {(() => {
                        const f = flagCounts(test)
                        if (!f.H && !f.L) return null
                        const cls = f.H > 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        const sex = (test.patientGender || '').toString().toLowerCase() || '-'
                        const ageYears = (() => {
                          const dob = test.patientDob ? new Date(test.patientDob) : null
                          if (!dob || isNaN(dob.getTime())) return undefined
                          const n = new Date(); let y = n.getFullYear() - dob.getFullYear(); const m = n.getMonth() - dob.getMonth(); if (m < 0 || (m === 0 && n.getDate() < dob.getDate())) y--; return Math.max(0, y)
                        })()
                        const ped = typeof ageYears === 'number' && ageYears < 12
                        const title = `Flags based on ${sex}/${ageYears!=null ? ageYears+'y' : '?y'} ${ped ? '(pediatric)' : '(adult)'} ranges`
                        return (
                          <span title={title} className={`rounded px-1.5 py-0.5 text-[10px] border ${cls}`}>
                            H:{f.H} L:{f.L}{ped ? ' P' : ''}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={test.status.toLowerCase()==='completed'? 'default' : test.status.toLowerCase()==='pending'? 'secondary':'outline'}>
                        {test.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => setViewPatient({ id: test.patientId, name: test.patientName || "Patient" })}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Ordered
                      </Button>
                    </td>
                  </tr>
                  )})}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!viewPatient} onOpenChange={(o)=> !o && setViewPatient(null)}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle>Ordered tests - {viewPatient?.name || "Patient"}</DialogTitle>
            {viewPatient && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/lab-tests/print?patientId=${viewPatient.id}`, "_blank")}
                >
                  Print Results
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(`/api/lab-tests/pdf?patientId=${viewPatient.id}`, "_blank")}
                >
                  Download Results
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          {viewPatient && tests.filter(t => t.patientId === viewPatient.id).map((t)=> (
            <div key={t.id} className="rounded-md border p-3 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-semibold">{t.testName}</div>
                  <div className="text-xs text-muted-foreground">{t.accessionNumber} · {t.priority || 'Routine'} · {t.specimenType || '-'}</div>
                  <div className="text-xs text-muted-foreground">Ordered: {new Date(t.orderedAt).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Status: {t.status}</div>
                </div>
                <Button size="sm" onClick={()=> onSelectTest(t.id)}>Process</Button>
              </div>
            </div>
          ))}
          {viewPatient && tests.filter(t => t.patientId === viewPatient.id).length === 0 && (
            <div className="text-sm text-muted-foreground">No tests for this patient.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
