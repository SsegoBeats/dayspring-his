"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { BarcodeGenerator } from '@/components/barcode-generator'

export default function PrintLabTestPage() {
  const params = useParams() as { id: string }
  const id = params?.id
  const [test, setTest] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<any>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/lab-tests/${id}`, { credentials: 'include' })
        if (!res.ok) throw new Error('Failed to load test')
        const data = await res.json()
        setTest(data.test)
      } catch (e:any) {
        setError(e?.message || 'Failed to load')
      } finally { setLoading(false) }
    })()
  }, [id])

  useEffect(()=>{ (async()=>{ try{ const r = await fetch('/api/settings/org'); const d = await r.json(); setOrg(d.settings||null) }catch{} })() },[])

  useEffect(() => { if (test) setTimeout(() => { try { window.print() } catch {} }, 300) }, [test])

  const analytes = useMemo(() => {
    const toNum = (s: string) => {
      const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
      return m ? parseFloat(m[0]) : null
    }
    const parts: Record<string, string> = {}
    const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein|CRP|pH|SG|Nitrite|Leukocyte|Blood|Protein|Glucose|Ketone|HIV\s*Rapid|Test\s*1|Test\s*2)\s*:\s*([^\n]+)/ig
    if (typeof test?.results === 'string') {
      let m: RegExpExecArray | null
      while ((m = rx.exec(test.results)) != null) parts[m[1].replace(/\s+/g, ' ')] = m[2].trim()
    }
    const sex = String(test?.patientGender || '').toLowerCase()
    const ageYears = (() => {
      const dob = test?.patientDob ? new Date(test.patientDob) : null
      if (!dob || isNaN(dob.getTime())) return undefined
      const now = new Date()
      let years = now.getFullYear() - dob.getFullYear()
      const m = now.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years--
      return Math.max(0, years)
    })()
    const range = (k: string): [number | null, number | null, string] => {
      switch (k) {
        case 'Hb': {
          if (typeof ageYears === 'number' && ageYears < 12) return [11.5, 15.5, 'g/dL']
          const female = sex === 'female'
          return [female ? 12 : 13, female ? 15.5 : 17, 'g/dL']
        }
        case 'WBC': {
          if (typeof ageYears === 'number' && ageYears < 12) return [5, 15, 'x10^9/L']
          return [4, 11, 'x10^9/L']
        }
        case 'Platelets': return [150, 450, 'x10^9/L']
        case 'HCT': {
          if (typeof ageYears === 'number' && ageYears < 12) return [35, 45, '%']
          const female = sex === 'female'
          return [female ? 36 : 40, female ? 46 : 52, '%']
        }
        case 'MCV': {
          if (typeof ageYears === 'number' && ageYears < 12) return [75, 95, 'fL']
          return [80, 100, 'fL']
        }
        case 'Neut': return [40, 75, '%']
        case 'Lymph': return [20, 45, '%']
        case 'Mono': return [2, 10, '%']
        case 'Eos': return [1, 6, '%']
        case 'Baso': return [0, 2, '%']
        case 'RBS': return [3.9, 7.8, 'mmol/L']
        case 'ALT': return [7, 55, 'U/L']
        case 'AST': return [8, 48, 'U/L']
        case 'ALP': {
          if (typeof ageYears === 'number' && ageYears < 12) return [100, 350, 'U/L']
          return [40, 130, 'U/L']
        }
        case 'T. Bilirubin': return [0.3, 1.2, 'mg/dL']
        case 'D. Bilirubin': return [0.0, 0.3, 'mg/dL']
        case 'Albumin': return [3.5, 5.0, 'g/dL']
        case 'Total Protein': return [6.0, 8.3, 'g/dL']
        case 'CRP': return [0, 10, 'mg/L']
        case 'pH': return [5.0, 8.0, '']
        case 'SG': return [1.005, 1.03, '']
        default: return [null, null, '']
      }
    }
    const rows = Object.entries(parts).map(([k, v]) => {
      const [lo, hi, unit] = range(k)
      const val = toNum(v)
      let flag = ''
      if (val != null && lo != null && hi != null) {
        if (val < lo) flag = 'L'
        else if (val > hi) flag = 'H'
      }
      return { parameter: k, value: v, range: (lo != null && hi != null) ? `${lo}-${hi} ${unit}` : '', flag }
    })
    return rows
  }, [test?.results, test?.patientGender, test?.patientDob])

  const interpretations = useMemo(() => {
    if (typeof test?.results !== 'string') return [] as string[]
    const idx = test.results.indexOf('Interpretation:')
    if (idx === -1) return []
    const block = test.results.slice(idx)
    return block.split(/\r?\n/).slice(1).map((l)=> l.replace(/^[-\s]+/, '').trim()).filter(Boolean)
  }, [test?.results])

  const flagsSummary = useMemo(() => {
    const hi = analytes.filter(a=> a.flag === 'H').length
    const lo = analytes.filter(a=> a.flag === 'L').length
    return { hi, lo }
  }, [analytes])

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>
  if (!test) return <div className="p-6 text-sm text-muted-foreground">Not found</div>

  return (
    <div className="p-6 print:p-0">
      <style>{`@media print {.no-print{display:none}} .hdr{border-bottom:1px solid #ddd; padding-bottom:8px; margin-bottom:12px}`}</style>
      <div className="hdr flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={(org?.logoUrl) || "/logo.png"} alt="Logo" className="h-10 w-10 object-contain" onError={(e:any)=>{ (e.currentTarget as any).style.display='none' }} />
          <div>
            <div className="text-xl font-semibold">{org?.name || 'Dayspring Medical Center'}</div>
            <div className="text-xs text-muted-foreground">Laboratory Result</div>
            <div className="text-[10px] text-muted-foreground">
              Email: {org?.email || 'dayspringmedicalcenter@gmail.com'} | Tel: {org?.phone || '+256 703-942-230 / +256 703-844-396 / +256 742-918-253'} | {org?.location || 'Wanyange, Uganda'}
            </div>
          </div>
        </div>
        <div className="text-right">
          {test.accessionNumber && (
            <div className="inline-block">
              <BarcodeGenerator value={test.accessionNumber} width={2} height={40} displayValue={true} />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{test.patientName}</span></div>
        <div><span className="text-muted-foreground">P.ID:</span> <span className="font-mono">{test.patientNumber || '-'}</span></div>
        <div><span className="text-muted-foreground">Accession:</span> <span className="font-mono">{test.accessionNumber || '-'}</span></div>
        <div><span className="text-muted-foreground">Ordered:</span> {test.orderedAt ? new Date(test.orderedAt).toLocaleString() : '-'}</div>
        <div><span className="text-muted-foreground">Completed:</span> {test.completedAt ? new Date(test.completedAt).toLocaleString() : '-'}</div>
        <div><span className="text-muted-foreground">Doctor:</span> {test.doctorName || '-'}</div>
        <div><span className="text-muted-foreground">Lab Tech:</span> {test.labTechName || '-'}</div>
        <div><span className="text-muted-foreground">Reviewed:</span> {test.reviewedAt ? `${new Date(test.reviewedAt).toLocaleString()}${test.reviewedBy ? ' by '+test.reviewedBy : ''}` : '-'}</div>
        <div><span className="text-muted-foreground">Gender:</span> <span className="font-medium">{(test.patientGender || '').toString() || '-'}</span></div>
        <div><span className="text-muted-foreground">Age:</span> <span className="font-medium">{(() => { const d = test.patientDob ? new Date(test.patientDob) : null; if (!d || isNaN(d.getTime())) return '-'; const n = new Date(); let y = n.getFullYear()-d.getFullYear(); const m=n.getMonth()-d.getMonth(); if(m<0||(m===0&&n.getDate()<d.getDate())) y--; return `${y} yr`; })()}</span></div>
        {(flagsSummary.hi || flagsSummary.lo) ? (
          <div className="col-span-2"><span className="text-muted-foreground">Flags:</span> <span className="font-medium">H:{flagsSummary.hi} L:{flagsSummary.lo}</span></div>
        ) : null}
      </div>

      <div className="mb-3"><span className="text-muted-foreground">Test:</span> <span className="font-medium">{test.testName || test.testType}</span></div>

      {analytes.length > 0 ? (
        <div className="mb-4">
          <div className="font-medium">Analytes</div>
          <table className="w-full text-sm border">
            <thead><tr className="bg-muted/40 border-b"><th className="text-left px-2 py-1">Parameter</th><th className="text-left px-2 py-1">Value</th><th className="text-left px-2 py-1">Ref Range</th><th className="text-left px-2 py-1">Flag</th></tr></thead>
            <tbody>
              {analytes.map(r => (<tr key={r.parameter} className="border-b"><td className="px-2 py-1">{r.parameter}</td><td className="px-2 py-1">{r.value}</td><td className="px-2 py-1">{r.range}</td><td className="px-2 py-1">{r.flag}</td></tr>))}
            </tbody>
          </table>
        </div>
      ) : null}

      {test.results && (
        <div className="mb-4">
          <div className="font-medium">Results</div>
          <pre className="whitespace-pre-wrap text-sm border rounded p-3 bg-muted/40">{test.results}</pre>
        </div>
      )}

      {interpretations.length > 0 && (
        <div className="mb-4">
          <div className="font-medium">Interpretation</div>
          <ul className="list-disc pl-5 text-sm">
            {interpretations.map((line, i)=> (<li key={i}>{line}</li>))}
          </ul>
        </div>
      )}

      {test.notes && (
        <div className="mb-4">
          <div className="font-medium">Notes</div>
          <pre className="whitespace-pre-wrap text-sm border rounded p-3 bg-muted/40">{test.notes}</pre>
        </div>
      )}

      <div className="no-print mt-6">
        <button className="rounded border px-3 py-1.5 text-sm" onClick={()=> window.print()}>Print</button>
      </div>
    </div>
  )
}
