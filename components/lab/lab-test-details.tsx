"use client"

import { useEffect, useMemo, useState } from "react"
import { useLab } from "@/lib/lab-context"
import { useAuth } from "@/lib/auth-context"
import { usePatients } from "@/lib/patient-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, XCircle } from "lucide-react"
import { BarcodeGenerator } from "@/components/barcode-generator"
import { formatPatientNumber } from "@/lib/patients"

interface LabTestDetailsProps {
  testId: string
  onBack: () => void
}

export function LabTestDetails({ testId, onBack }: LabTestDetailsProps) {
  const { tests, updateTest } = useLab()
  const { user } = useAuth()
  const { getPatient } = usePatients()
  const test = tests.find((lr) => lr.id === testId)
  const patient = test ? getPatient(test.patientId) : null

  const [results, setResults] = useState(test?.results || "")
  const [notes, setNotes] = useState(test?.notes || "")
  const role = (user?.role || '').toLowerCase()
  const isLabTech = role.includes('lab')
  const [structured, setStructured] = useState<any>(() => test?.resultJson || { value: '', units: test?.loincUnits || '', interpretation: '', reference: '' })

  useEffect(() => {
    setStructured((prev:any) => ({
      ...prev,
      units: prev.units || test?.loincUnits || '',
    }))
  }, [test?.loincUnits])

  const loincTitle = useMemo(() => test?.loincLongName || test?.testName, [test])

  if (!test) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Test not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    )
  }

  const handleSubmitResults = async () => {
    try {
      await fetch(`/api/lab-tests/${test.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed', results, notes }) })
    } catch {}
    updateTest(test.id, { status: 'Completed' as any, completedAt: new Date().toISOString(), results, notes })
    alert('Test results submitted successfully!')
    onBack()
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Queue
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{test.testType}</CardTitle>
              <CardDescription>Test ID: {test.id}</CardDescription>
            </div>
            {test.accessionNumber && (
              <div className="text-right">
                <div className="mb-2 text-xs">Accession: <span className="font-mono">{test.accessionNumber}</span></div>
                <div className="inline-block">
                  <BarcodeGenerator value={test.accessionNumber} width={2} height={40} displayValue={true} />
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Patient:</span> <span className="text-foreground">{test.patientName}</span></div>
              <div><span className="text-muted-foreground">P.ID:</span> <span className="font-mono">{formatPatientNumber((patient as any)?.patientNumber) || test.patientId}</span></div>
              <div><span className="text-muted-foreground">Doctor:</span> <span className="text-foreground">{test.doctorName || '-'}</span></div>
              <div><span className="text-muted-foreground">Ordered:</span> <span className="text-foreground">{new Date(test.orderedAt).toLocaleString()}</span></div>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Priority:</span> <Badge variant="outline">{test.priority || 'Routine'}</Badge></div>
              <div><span className="text-muted-foreground">Specimen:</span> <span className="text-foreground">{test.specimenType || '-'}</span></div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant={test.status.toLowerCase()==='completed'? 'default' : test.status.toLowerCase()==='pending'? 'secondary':'outline'}>{test.status}</Badge></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=> window.open(`/lab-tests/${test.id}/print`, '_blank')}>Print Result</Button>
                <Button variant="outline" size="sm" onClick={()=> window.open(`/api/lab-tests/${test.id}/pdf`, '_blank')}>Download PDF</Button>
              </div>
            </div>
          </div>

          {isLabTech && test.status.toLowerCase() !== 'completed' ? (
            <div className="space-y-4">
              <div className="rounded-md border p-3 space-y-3">
                <div className="text-sm text-muted-foreground">Structured entry for {loincTitle}</div>
                <div className="grid md:grid-cols-3 gap-2">
                  <label className="text-xs">
                    Value
                    <input className="border rounded px-2 py-1 text-sm w-full" value={structured.value || ''} onChange={(e)=> setStructured({ ...structured, value: e.target.value })} />
                  </label>
                  <label className="text-xs">
                    Units
                    <input className="border rounded px-2 py-1 text-sm w-full" value={structured.units || ''} onChange={(e)=> setStructured({ ...structured, units: e.target.value })} placeholder={test.loincUnits || ''} />
                  </label>
                  <label className="text-xs">
                    Reference Range
                    <input className="border rounded px-2 py-1 text-sm w-full" value={structured.reference || ''} onChange={(e)=> setStructured({ ...structured, reference: e.target.value })} />
                  </label>
                </div>
                <label className="text-xs block">
                  Interpretation
                  <Textarea rows={3} value={structured.interpretation || ''} onChange={(e)=> setStructured({ ...structured, interpretation: e.target.value })} />
                </label>
              </div>
              <div className="space-y-2">
                <Label>Results (free text)</Label>
                <Textarea rows={6} value={results} onChange={(e)=> setResults(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button onClick={async ()=>{
                  const parts: string[] = []
                  if (structured.value) parts.push(`Value: ${structured.value}${structured.units ? ' ' + structured.units : ''}`)
                  if (structured.reference) parts.push(`Reference: ${structured.reference}`)
                  if (structured.interpretation) parts.push(`Interpretation: ${structured.interpretation}`)
                  const summary = parts.join('\n')
                  const compiled = [summary, results].filter(Boolean).join('\n\n')
                  setResults(compiled)
                  await fetch(`/api/lab-tests/${test.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Completed', results: compiled, notes, resultJson: structured })
                  }).catch(()=>{})
                  updateTest(test.id, { status: 'Completed' as any, completedAt: new Date().toISOString(), results: compiled, resultJson: structured })
                  alert('Test results submitted successfully!')
                  onBack()
                }} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Submit Results
                </Button>
                <Button variant="destructive" onClick={()=>{ if (confirm('Cancel this test?')) { fetch(`/api/lab-tests/${test.id}`, { method:'PATCH', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status: 'Cancelled' }) }).catch(()=>{}); updateTest(test.id, { status: 'Cancelled' as any }); onBack() } }}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Test
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {test.results && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Results</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{test.results}</p>
                  </div>
                  {test.reviewedAt && (
                    <div className="text-xs text-muted-foreground">Reviewed {new Date(test.reviewedAt).toLocaleString()} {test.reviewedBy ? `by ${test.reviewedBy}` : ''}</div>
                  )}
                </div>
              )}
              {test.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground">Notes</h3>
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{test.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AttachmentForm({ patientId }: { patientId: string }) {
  const [url, setUrl] = (require('react') as any).useState('')
  const [saving, setSaving] = (require('react') as any).useState(false)
  const add = async () => {
    if (!url.trim()) return
    setSaving(true)
    try {
      await fetch('/api/documents', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId, type: 'OTHER', fileUrl: url.trim() }) })
      setUrl('')
    } catch {}
    finally { setSaving(false) }
  }
  return (
    <div className="flex items-center gap-2">
      <input className="border rounded px-2 py-1 text-sm flex-1" placeholder="Paste analyzer file URL (PDF/image)" value={url} onChange={(e)=> setUrl(e.target.value)} />
      <button className="rounded border px-3 py-1.5 text-sm" onClick={add} disabled={saving || !url.trim()}>{saving ? 'Attaching…':'Attach'}</button>
    </div>
  )
}
