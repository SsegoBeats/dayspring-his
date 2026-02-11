"use client"

import { useState, useMemo, useEffect } from "react"
import type { LabTest } from "@/lib/lab-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { FileText, Printer, AlertCircle, SortAsc, SortDesc, Loader2, Users, CheckCircle2, XCircle, PlayCircle } from "lucide-react"
import { toast } from "sonner"
import { useLab } from "@/lib/lab-context"

interface LabTestQueueProps {
  tests: LabTest[]
  onSelectTest: (testId: string) => void
  emptyMessage: string
}

type SortField = 'accession' | 'patient' | 'test' | 'priority' | 'ordered' | 'tat' | 'status'
type SortOrder = 'asc' | 'desc'

export function LabTestQueue({ tests, onSelectTest, emptyMessage }: LabTestQueueProps & { loading?: boolean }) {
  const { user } = useAuth()
  const { refresh } = useLab()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all'|'pending'|'inprogress'|'completed'|'cancelled'>('all')
  const [prio, setPrio] = useState<'all'|'routine'|'stat'>('all')
  const [testType, setTestType] = useState<string>('all')
  const [assignedTech, setAssignedTech] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [viewPatient, setViewPatient] = useState<{ id: string; name: string } | null>(null)
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('ordered')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<string>('In Progress')
  const [labTechs, setLabTechs] = useState<{ id: string; name: string }[]>([])
  const [assigningTech, setAssigningTech] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Fetch lab techs for assignment
  useEffect(() => {
    fetch('/api/users/lab-techs', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.labTechs)) {
          setLabTechs(data.labTechs)
        }
      })
      .catch(() => {})
  }, [])

  // Get unique test types
  const testTypes = useMemo(() => {
    const types = new Set(tests.map(t => t.testType).filter(Boolean))
    return Array.from(types).sort()
  }, [tests])

  // Get unique assigned techs
  const assignedTechs = useMemo(() => {
    const techs = new Set(tests.map(t => t.labTechName).filter(Boolean))
    return Array.from(techs).sort()
  }, [tests])

  const filtered = useMemo(() => {
    return tests.filter(t => {
      const s = (t.status || '').toLowerCase()
      const p = (t.priority || '').toLowerCase()
      const okS = status === 'all' || 
        (status === 'pending' && s === 'pending') || 
        (status === 'inprogress' && s === 'in progress') || 
        (status === 'completed' && s === 'completed') || 
        (status === 'cancelled' && s === 'cancelled')
      const okP = prio === 'all' || (prio === 'routine' && p === 'routine') || (prio === 'stat' && p === 'stat')
      const okQ = !q.trim() || [t.patientName, t.testName, t.accessionNumber].filter(Boolean).some(v => String(v).toLowerCase().includes(q.toLowerCase()))
      const okType = testType === 'all' || t.testType === testType
      const okTech = assignedTech === 'all' || (assignedTech === 'unassigned' && !t.labTechName) || t.labTechName === assignedTech
      const okDateFrom = !dateFrom || new Date(t.orderedAt) >= new Date(dateFrom)
      const okDateTo = !dateTo || new Date(t.orderedAt) <= new Date(dateTo + 'T23:59:59')
      return okS && okP && okQ && okType && okTech && okDateFrom && okDateTo
    })
  }, [tests, q, status, prio, testType, assignedTech, dateFrom, dateTo])

  const sortedTests = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'accession':
          cmp = (a.accessionNumber || '').localeCompare(b.accessionNumber || '')
          break
        case 'patient':
          cmp = (a.patientName || '').localeCompare(b.patientName || '')
          break
        case 'test':
          cmp = (a.testName || '').localeCompare(b.testName || '')
          break
        case 'priority':
          const prioOrder = { 'Stat': 0, 'Routine': 1 }
          cmp = (prioOrder[a.priority as keyof typeof prioOrder] ?? 2) - (prioOrder[b.priority as keyof typeof prioOrder] ?? 2)
          break
        case 'ordered':
          cmp = new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
          break
        case 'tat':
          const tatA = a.completedAt && a.orderedAt ? new Date(a.completedAt).getTime() - new Date(a.orderedAt).getTime() : 0
          const tatB = b.completedAt && b.orderedAt ? new Date(b.completedAt).getTime() - new Date(b.orderedAt).getTime() : 0
          cmp = tatA - tatB
          break
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '')
          break
        default:
          cmp = new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime()
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filtered, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const toggleTest = (testId: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedTests(new Set(sortedTests.map(t => t.id)))
  }

  const deselectAll = () => {
    setSelectedTests(new Set())
  }

  const handleBulkAssign = async () => {
    if (!assigningTech || selectedTests.size === 0) {
      toast.error('Please select tests and a lab tech')
      return
    }
    setAssigning(true)
    try {
      const results = await Promise.all(
        Array.from(selectedTests).map(id =>
          fetch(`/api/lab-tests/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedLabTechId: assigningTech }),
          }).then(async res => ({ id, ok: res.ok, error: res.ok ? null : await res.json().catch(() => ({ error: 'Failed' })) }))
        )
      )
      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        toast.error(`Failed to assign ${failed.length} test(s)`)
      } else {
        toast.success(`Assigned ${selectedTests.size} test(s) to ${labTechs.find(t => t.id === assigningTech)?.name || 'lab tech'}`)
        setSelectedTests(new Set())
        setAssignDialogOpen(false)
        setAssigningTech('')
        refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign tests')
    } finally {
      setAssigning(false)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (selectedTests.size === 0) {
      toast.error('Please select tests')
      return
    }
    setUpdatingStatus(true)
    try {
      const results = await Promise.all(
        Array.from(selectedTests).map(id =>
          fetch(`/api/lab-tests/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: bulkStatus }),
          }).then(async res => ({ id, ok: res.ok, error: res.ok ? null : await res.json().catch(() => ({ error: 'Failed' })) }))
        )
      )
      const failed = results.filter(r => !r.ok)
      if (failed.length > 0) {
        toast.error(`Failed to update ${failed.length} test(s)`)
      } else {
        toast.success(`Updated ${selectedTests.size} test(s) to ${bulkStatus}`)
        setSelectedTests(new Set())
        setBulkStatusDialogOpen(false)
        refresh()
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update tests')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const minsBetween = (a?: string | null, b?: string | null) => {
    if (!a) return null
    const t1 = new Date(a).getTime()
    const t2 = b ? new Date(b).getTime() : Date.now()
    return Math.max(0, Math.round((t2 - t1) / 60000))
  }

  const flagCounts = (t: LabTest) => {
    try {
      const res = (t.results || '').toString()
      if (!res) return { H: 0, L: 0, critical: false }
      const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP)\s*:\s*([^\n]+)/ig
      const toNum = (s: string) => { const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
      const sex = (t.patientGender || '').toLowerCase()
      const ageYears = (() => {
        const dob = t.patientDob ? new Date(t.patientDob) : null
        if (!dob || isNaN(dob.getTime())) return undefined
        const n = new Date(); let y = n.getFullYear() - dob.getFullYear(); const m = n.getMonth() - dob.getMonth(); if (m < 0 || (m === 0 && n.getDate() < dob.getDate())) y--; return Math.max(0, y)
      })()
      const ref = (k: string): [number | null, number | null] => {
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
      let H = 0, L = 0, critical = false
      while ((m = rx.exec(res)) != null) {
        const k = m[1].replace(/\s+/g, ' ')
        const v = m[2].trim()
        const [lo, hi] = ref(k)
        const val = toNum(v)
        if (val != null && lo != null && hi != null) {
          if (val < lo) { L++; if (val < lo * 0.5) critical = true }
          else if (val > hi) { H++; if (val > hi * 1.5) critical = true }
        }
      }
      return { H, L, critical }
    } catch { return { H: 0, L: 0, critical: false } }
  }

  const anyFilters = q.trim() || status !== 'all' || prio !== 'all' || testType !== 'all' || assignedTech !== 'all' || dateFrom || dateTo

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Laboratory Tests</CardTitle>
              <CardDescription>View and manage laboratory test requests</CardDescription>
            </div>
            {selectedTests.size > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Assign ({selectedTests.size})
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkStatusDialogOpen(true)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Update Status ({selectedTests.size})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by patient, test, accession"
                  value={q}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                  onChange={(e) => setQ(e.target.value)}
                />
                {showSuggestions && q.trim().length >= 2 && filtered.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-sm max-h-48 overflow-auto text-xs">
                    {filtered.slice(0, 6).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1 hover:bg-muted/70 text-left"
                        onMouseDown={(ev) => { ev.preventDefault(); setQ(t.patientName || t.testName || (t.accessionNumber || '')); }}
                      >
                        <span className="truncate mr-2">{t.patientName || '-'} · {t.testName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{t.accessionNumber || '-'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inprogress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={prio} onValueChange={(v: any) => setPrio(v)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
              {testTypes.length > 0 && (
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Test Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {testTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={assignedTech} onValueChange={setAssignedTech}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Assigned To" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Techs</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assignedTechs.map(tech => (
                    <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground ml-auto">
                {filtered.length} of {tests.length}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">From:</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px]" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">To:</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px]" />
              </div>
              {anyFilters && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setQ('')
                  setStatus('all')
                  setPrio('all')
                  setTestType('all')
                  setAssignedTech('all')
                  setDateFrom('')
                  setDateTo('')
                }}>
                  Clear Filters
                </Button>
              )}
            </div>
            {anyFilters && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                {q.trim() && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={() => setQ('')}>
                    <span>Search:</span>
                    <span className="font-medium">{q}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                )}
                {status !== 'all' && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={() => setStatus('all')}>
                    <span>Status:</span>
                    <span className="font-medium capitalize">{status}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                )}
                {prio !== 'all' && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={() => setPrio('all')}>
                    <span>Priority:</span>
                    <span className="font-medium uppercase">{prio}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                )}
                {testType !== 'all' && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={() => setTestType('all')}>
                    <span>Type:</span>
                    <span className="font-medium">{testType}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                )}
                {assignedTech !== 'all' && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 border text-slate-600" onClick={() => setAssignedTech('all')}>
                    <span>Tech:</span>
                    <span className="font-medium">{assignedTech === 'unassigned' ? 'Unassigned' : assignedTech}</span>
                    <span className="text-slate-400">×</span>
                  </button>
                )}
              </div>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="py-2 px-2 w-10">
                      <Checkbox
                        checked={selectedTests.size === sortedTests.length && sortedTests.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) selectAll()
                          else deselectAll()
                        }}
                      />
                    </th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('accession')}>
                      <div className="flex items-center gap-1">
                        Accession
                        {sortField === 'accession' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('patient')}>
                      <div className="flex items-center gap-1">
                        Patient
                        {sortField === 'patient' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('test')}>
                      <div className="flex items-center gap-1">
                        Test
                        {sortField === 'test' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('priority')}>
                      <div className="flex items-center gap-1">
                        Priority
                        {sortField === 'priority' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2">Specimen</th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('ordered')}>
                      <div className="flex items-center gap-1">
                        Ordered
                        {sortField === 'ordered' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('tat')}>
                      <div className="flex items-center gap-1">
                        Aging/TAT
                        {sortField === 'tat' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2">Flags</th>
                    <th className="py-2 px-2 cursor-pointer select-none" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">
                        Status
                        {sortField === 'status' && (sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="py-2 px-2">Assigned To</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTests.map((test) => {
                    const s = (test.status || '').toLowerCase()
                    const mins = s === 'completed' ? minsBetween(test.orderedAt, test.completedAt || undefined) : minsBetween(test.orderedAt, undefined)
                    const agingBadge = (() => {
                      if (mins == null) return null
                      const label = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
                      const cls = s === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : mins > 240 ? 'bg-red-100 text-red-800 border-red-200' : mins > 120 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                      return <span className={`rounded px-1.5 py-0.5 text-[10px] border ${cls}`}>{label}</span>
                    })()
                    const flags = flagCounts(test)
                    const isSelected = selectedTests.has(test.id)
                    return (
                      <tr 
                        key={test.id} 
                        className={`border-b hover:bg-muted/40 ${isSelected ? 'bg-blue-50/50' : ''} ${flags.critical ? 'bg-red-50/30' : ''}`}
                      >
                        <td className="py-2 px-2">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleTest(test.id)} />
                        </td>
                        <td className="py-2 px-2 font-mono">{test.accessionNumber || '-'}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            {test.patientName}
                            {flags.critical && <AlertCircle className="h-3 w-3 text-red-600" title="Critical results" />}
                          </div>
                        </td>
                        <td className="py-2 px-2">{test.testName}</td>
                        <td className="py-2 px-2">
                          <Badge variant={test.priority?.toLowerCase() === 'stat' ? 'destructive' : 'outline'}>
                            {test.priority || 'Routine'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">{test.specimenType || '-'}</td>
                        <td className="py-2 px-2">{new Date(test.orderedAt).toLocaleString()}</td>
                        <td className="py-2 px-2">{agingBadge}</td>
                        <td className="py-2 px-2">
                          {flags.H > 0 || flags.L > 0 ? (
                            <span 
                              title={`${flags.H} high, ${flags.L} low${flags.critical ? ' (CRITICAL)' : ''}`}
                              className={`rounded px-1.5 py-0.5 text-[10px] border ${flags.critical ? 'bg-red-200 text-red-900 border-red-400' : flags.H > 0 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
                            >
                              H:{flags.H} L:{flags.L}{flags.critical ? ' ⚠' : ''}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-col gap-1">
                            <Badge variant={test.status.toLowerCase() === 'completed' ? 'default' : test.status.toLowerCase() === 'pending' ? 'secondary' : 'outline'}>
                              {test.status}
                            </Badge>
                            {test.rejectionReason && (
                              <span className="text-xs text-red-600 italic" title={`Rejected: ${test.rejectionReason}`}>
                                Rejected
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-xs text-muted-foreground">
                          {test.labTechName || <span className="italic">Unassigned</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => onSelectTest(test.id)}>
                              Process
                            </Button>
                            {test.status.toLowerCase() === 'completed' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => window.open(`/lab-tests/${test.id}/print`, '_blank')}
                                title="Print result"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Tests to Lab Tech</DialogTitle>
            <DialogDescription>
              Assign {selectedTests.size} selected test(s) to a lab technician
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Lab Tech</Label>
              <Select value={assigningTech} onValueChange={setAssigningTech}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lab tech" />
                </SelectTrigger>
                <SelectContent>
                  {labTechs.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAssignDialogOpen(false); setAssigningTech('') }}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign} disabled={!assigningTech || assigning}>
                {assigning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Assign
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Test Status</DialogTitle>
            <DialogDescription>
              Update status for {selectedTests.size} selected test(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setBulkStatusDialogOpen(false); setBulkStatus('In Progress') }}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={updatingStatus}>
                {updatingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Update Status
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Patient Tests Dialog */}
      <Dialog open={!!viewPatient} onOpenChange={(o) => !o && setViewPatient(null)}>
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
                    <Printer className="mr-2 h-4 w-4" />
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
            {viewPatient && sortedTests.filter(t => t.patientId === viewPatient.id).map((t) => (
              <div key={t.id} className="rounded-md border p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-semibold">{t.testName}</div>
                    <div className="text-xs text-muted-foreground">{t.accessionNumber} · {t.priority || 'Routine'} · {t.specimenType || '-'}</div>
                    <div className="text-xs text-muted-foreground">Ordered: {new Date(t.orderedAt).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Status: {t.status}</div>
                  </div>
                  <Button size="sm" onClick={() => { onSelectTest(t.id); setViewPatient(null) }}>
                    Process
                  </Button>
                </div>
              </div>
            ))}
            {viewPatient && sortedTests.filter(t => t.patientId === viewPatient.id).length === 0 && (
              <div className="text-sm text-muted-foreground">No tests for this patient.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
