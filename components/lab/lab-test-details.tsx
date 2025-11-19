"use client"

import { useState } from "react"
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
  const [usePanel, setUsePanel] = useState(true)
  const [panel, setPanel] = useState<any>({
    hb: '', wbc: '', plt: '', hct: '', mcv: '', neut: '', lymph: '', mono: '', eos: '', baso: '',
    rbs: '', alt: '', ast: '', alp: '', tbili: '', dbili: '', alb: '', tp: '',
    malaria: 'Negative', crp: '', hiv1: 'Negative', hiv2: 'Negative',
    ua_nitrite: 'Negative', ua_leuk: 'Negative', ua_blood: 'Negative', ua_protein: 'Negative', ua_glucose: 'Negative', ua_ketone: 'Negative', ua_ph: '', ua_sg: ''
  })

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
              <div className="flex items-center justify-between">
                <div className="font-medium">Structured Panel</div>
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={usePanel} onChange={(e)=> setUsePanel(e.target.checked)} /> Use structured form</label>
              </div>
              {usePanel && (
                <div className="rounded-md border p-3 space-y-3">
                  <div className="grid md:grid-cols-4 gap-2">
                    {['hb','wbc','plt','hct','mcv','neut','lymph','mono','eos','baso'].map((k)=> (
                      <label key={k} className="text-xs">
                        {k.toUpperCase()}
                        <input className="border rounded px-2 py-1 text-sm w-full" value={panel[k]||''} onChange={(e)=> setPanel({ ...panel, [k]: e.target.value })} />
                      </label>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-3 gap-2">
                    {['rbs','alt','ast','alp','tbili','dbili','alb','tp'].map((k)=> (
                      <label key={k} className="text-xs">
                        {k.toUpperCase()}
                        <input className="border rounded px-2 py-1 text-sm w-full" value={panel[k]||''} onChange={(e)=> setPanel({ ...panel, [k]: e.target.value })} />
                      </label>
                    ))}
                  </div>
                  <div className="grid md:grid-cols-3 gap-2">
                    <label className="text-xs">Malaria RDT
                      <select className="border rounded px-2 py-1 text-sm w-full" value={panel.malaria} onChange={(e)=> setPanel({...panel, malaria: e.target.value})}>
                        {['Negative','Positive','Invalid'].map(o=> <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="text-xs">CRP (mg/L)
                      <input className="border rounded px-2 py-1 text-sm w-full" value={panel.crp} onChange={(e)=> setPanel({...panel, crp: e.target.value})} />
                    </label>
                    <label className="text-xs">HIV Rapid
                      <div className="grid grid-cols-2 gap-2">
                        <select className="border rounded px-2 py-1 text-sm w-full" value={panel.hiv1} onChange={(e)=> setPanel({...panel, hiv1: e.target.value})}>
                          {['Negative','Positive','Invalid'].map(o=> <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select className="border rounded px-2 py-1 text-sm w-full" value={panel.hiv2} onChange={(e)=> setPanel({...panel, hiv2: e.target.value})}>
                          {['Negative','Positive','Invalid'].map(o=> <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </label>
                  </div>
                  <div className="grid md:grid-cols-4 gap-2">
                    {[
                      ['Nitrite','ua_nitrite'],['Leukocyte','ua_leuk'],['Blood','ua_blood'],['Protein','ua_protein'],
                      ['Glucose','ua_glucose'],['Ketone','ua_ketone'],['pH','ua_ph'],['SG','ua_sg']
                    ].map(([labelKey, stateKey]) => (
                      <label key={stateKey} className="text-xs">
                        {labelKey}
                        <input className="border rounded px-2 py-1 text-sm w-full" value={panel[stateKey]||''} onChange={(e)=> setPanel({ ...panel, [stateKey]: e.target.value })} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Results (free text)</Label>
                <Textarea rows={6} value={results} onChange={(e)=> setResults(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button onClick={async ()=>{
                  let compiled = results
                  if (usePanel) {
                    const lines: string[] = []
                    const cbc: [string,string, string][] = [
                      ['Hb', panel.hb, 'g/dL'], ['WBC', panel.wbc, 'x10^9/L'], ['Platelets', panel.plt, 'x10^9/L'], ['HCT', panel.hct, '%'], ['MCV', panel.mcv, 'fL'],
                    ]
                    if (cbc.some(([_,v])=> v)) {
                      lines.push('CBC:')
                      for (const [k,v,u] of cbc) if (v) lines.push(`  ${k}: ${v} ${u}`)
                      const diff: [string,string][] = [['Neut',panel.neut],['Lymph',panel.lymph],['Mono',panel.mono],['Eos',panel.eos],['Baso',panel.baso]]
                      if (diff.some(([_,v])=> v)) lines.push('  Differential:')
                      for (const [k,v] of diff) if (v) lines.push(`    ${k}: ${v} %`)
                    }
                    if (panel.rbs) lines.push(`RBS: ${panel.rbs} mmol/L`)
                    const lft: [string,string][] = [['ALT',panel.alt],['AST',panel.ast],['ALP',panel.alp],['T. Bilirubin',panel.tbili],['D. Bilirubin',panel.dbili],['Albumin',panel.alb],['Total Protein',panel.tp]]
                    if (lft.some(([_,v])=> v)) { lines.push('LFT:'); for (const [k,v] of lft) if (v) lines.push(`  ${k}: ${v}`) }
                    if (/malaria|rdt/i.test(test.testName)) lines.push(`Malaria RDT: ${panel.malaria}`)
                    if (/crp/i.test(test.testName) && panel.crp) lines.push(`CRP: ${panel.crp} mg/L`)
                    if (/hiv/i.test(test.testName)) { lines.push('HIV Rapid:'); lines.push(`  Test 1: ${panel.hiv1}`); lines.push(`  Test 2: ${panel.hiv2}`) }
                    if (/urinalysis|urine/i.test(test.testName)) {
                      lines.push('Urinalysis (Dipstick):')
                      const ua: [string,string][] = [['Nitrite', panel.ua_nitrite],['Leukocyte', panel.ua_leuk],['Blood', panel.ua_blood],['Protein', panel.ua_protein],['Glucose', panel.ua_glucose],['Ketone', panel.ua_ketone],['pH', panel.ua_ph],['SG', panel.ua_sg]]
                      for (const [k,v] of ua) if (v) lines.push(`  ${k}: ${v}`)
                    }
                    compiled = [lines.join('\n'), results].filter(Boolean).join('\n\n')
                    setResults(compiled)
                  }
                  const interpretations: string[] = []
                  if (/malaria|rdt/i.test(test.testName)) {
                    if (panel.malaria === 'Positive') interpretations.push('Malaria parasite detected (RDT Positive).')
                    else if (panel.malaria === 'Negative') interpretations.push('No malaria parasite detected (RDT Negative).')
                    else interpretations.push('Malaria RDT invalid. Repeat test recommended.')
                  }
                  if (/crp/i.test(test.testName)) {
                    const v = parseFloat(panel.crp)
                    if (isFinite(v)) {
                      if (v >= 100) interpretations.push('CRP very high - consider severe bacterial infection/sepsis.')
                      else if (v >= 10) interpretations.push('CRP elevated - suggests inflammation/infection.')
                      else interpretations.push('CRP within normal limits.')
                    }
                  }
                  if (/hiv/i.test(test.testName)) {
                    const a = panel.hiv1, b = panel.hiv2
                    if (a === 'Positive' && b === 'Positive') interpretations.push('HIV Rapid: Positive (dual algorithm).')
                    else if (a === 'Negative' && b === 'Negative') interpretations.push('HIV Rapid: Negative.')
                    else interpretations.push('HIV Rapid: Discordant/Inconclusive - repeat or perform ELISA/confirmatory testing.')
                  }
                  if (/urinalysis|urine/i.test(test.testName)) {
                    const nit = panel.ua_nitrite !== 'Negative'
                    const leu = panel.ua_leuk !== 'Negative'
                    if (nit || leu) interpretations.push('Urinalysis suggests possible UTI (nitrite/leukocyte positive). Correlate clinically and consider culture.')
                    if (panel.ua_blood !== 'Negative') interpretations.push('Hematuria present on dipstick; confirm with microscopy.')
                    if (panel.ua_protein !== 'Negative') interpretations.push('Proteinuria detected; quantify and consider renal evaluation.')
                  }
                  if (interpretations.length) {
                    const block = 'Interpretation:\n' + interpretations.map(x=> '- ' + x).join('\n')
                    setResults(prev => [prev, block].filter(Boolean).join('\n\n'))
                  }
                  await handleSubmitResults()
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

