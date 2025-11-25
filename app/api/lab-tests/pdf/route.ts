import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"

export const runtime = 'nodejs'

function getAnalyteRows(test: any) {
  const rows: { Patient: string; Test: string; Parameter: string; Value: string; RefRange?: string; Flag?: string; Accession?: string; Ordered?: string; Completed?: string }[] = []
  const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein|CRP|pH|SG|Nitrite|Leukocyte|Blood|Protein|Glucose|Ketone|HIV\s*Rapid|Test\s*1|Test\s*2)\s*:\s*([^\n]+)/ig
  const toNum = (s:string) => { const m = String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
  const sex = String((test.gender ?? test.patient_gender ?? '') || '').toLowerCase()
  const dobRaw = (test.date_of_birth ?? test.patient_dob) as any
  const dob = dobRaw ? new Date(dobRaw) : null
  const ageYears = (dob && !isNaN(dob.getTime())) ? (()=>{ const n=new Date(); let y = n.getFullYear()-dob.getFullYear(); const m=n.getMonth()-dob.getMonth(); if(m<0||(m===0&&n.getDate()<dob.getDate())) y--; return Math.max(0,y) })() : null
  const ref = (k:string): [number|null, number|null, string] => {
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
  if (typeof test.results === 'string') {
    let m: RegExpExecArray | null
    while ((m = rx.exec(test.results)) != null) {
      const k = m[1].replace(/\s+/g,' ')
      const v = m[2].trim()
      const [lo, hi, unit] = ref(k)
      const val = toNum(v)
      let flag = ''
      if (val != null && lo != null && hi != null) flag = val < lo ? 'L' : (val > hi ? 'H' : '')
      rows.push({ Patient: test.patientName, Test: test.testName || test.testType, Parameter: k, Value: v, RefRange: (lo!=null&&hi!=null) ? `${lo}-${hi} ${unit}` : undefined, Flag: flag || undefined, Accession: test.accession_number || test.accessionNumber, Ordered: test.ordered_at || test.orderedAt, Completed: test.completed_at || test.completedAt })
    }
    // Interpretations block
    const idx = test.results.indexOf('Interpretation:')
    if (idx !== -1) {
      const block = String(test.results).slice(idx)
      const lines = block.split(/\r?\n/).slice(1).map((l:string)=> l.replace(/^[-\s]+/,'').trim()).filter(Boolean)
      if (lines.length) rows.push({ Patient: test.patientName, Test: test.testName || test.testType, Parameter: 'Interpretation', Value: lines.join(' | '), Accession: test.accession_number || test.accessionNumber, Ordered: test.ordered_at || test.orderedAt, Completed: test.completed_at || test.completedAt })
    }
  }
  if (!rows.length && test.results) {
    rows.push({ Patient: test.patientName, Test: test.testName || test.testType, Parameter: 'Note', Value: String(test.results).slice(0, 1000), Accession: test.accession_number || test.accessionNumber, Ordered: test.ordered_at || test.orderedAt, Completed: test.completed_at || test.completedAt })
  }
  return rows
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const patientId = url.searchParams.get('patientId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const status = url.searchParams.get('status')
    const where: string[] = []
    const params: any[] = []
    if (patientId) { params.push(patientId); where.push(`lt.patient_id = $${params.length}`) }
    if (from) { params.push(from); where.push(`lt.ordered_at >= $${params.length}`) }
    if (to) { params.push(to); where.push(`lt.ordered_at <= $${params.length}`) }
    if (status && status.toLowerCase() !== 'all') { params.push(status); where.push(`lt.status ILIKE $${params.length}`) }

    const { rows } = await query(
      `SELECT lt.id, lt.patient_id, p.first_name, p.last_name, p.patient_number, p.gender, p.date_of_birth,
              lt.doctor_id, d.name AS doctor_name,
              lt.test_name, lt.test_type, lt.status, lt.results, lt.notes,
              lt.lab_tech_id, t.name AS lab_tech_name,
              lt.ordered_at, lt.completed_at, lt.priority, lt.specimen_type, lt.accession_number, lt.collected_at, lt.collected_by
         FROM lab_tests lt
         LEFT JOIN patients p ON p.id = lt.patient_id
         LEFT JOIN users d ON d.id = lt.doctor_id
         LEFT JOIN users t ON t.id = lt.lab_tech_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY COALESCE(lt.completed_at, lt.ordered_at) DESC
        LIMIT 2000`, params)

    const tests = rows.map((r:any)=> ({
      ...r,
      patientName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      testName: r.test_name,
      orderedAt: r.ordered_at,
      completedAt: r.completed_at,
      accessionNumber: r.accession_number
    }))
    const tableRows = tests.flatMap(getAnalyteRows)
    // Add per-test flags summary rows to improve readability in grouped output
    try {
      const keyOf = (r:any) => `${r.Patient || ''}|${r.Test || ''}|${r.Accession || ''}`
      const counts = new Map<string, { Patient:string; Test:string; Accession?:string; H:number; L:number; Ordered?:string; Completed?:string }>()
      for (const r of tableRows) {
        const k = keyOf(r)
        const cur = counts.get(k) || { Patient: r.Patient, Test: r.Test, Accession: r.Accession, H: 0, L: 0, Ordered: r.Ordered, Completed: r.Completed }
        if (String(r.Flag||'') === 'H') cur.H++
        if (String(r.Flag||'') === 'L') cur.L++
        counts.set(k, cur)
      }
      for (const [, v] of counts) {
        if (v.H > 0 || v.L > 0) {
          tableRows.push({ Patient: v.Patient, Test: v.Test, Parameter: 'Flags Summary', Value: `H:${v.H} L:${v.L}`, Accession: v.Accession, Ordered: v.Ordered, Completed: v.Completed })
        }
      }
    } catch {}
    // Add printed-by and signature placeholders
    tableRows.push({ Patient: "", Test: "", Parameter: "Printed By", Value: auth.email, RefRange: undefined, Flag: undefined, Accession: undefined, Ordered: undefined, Completed: undefined })
    tableRows.push({ Patient: "", Test: "", Parameter: "Signature", Value: "____________________    Stamp: ____________________", RefRange: undefined, Flag: undefined, Accession: undefined, Ordered: undefined, Completed: undefined })

    // Organization branding
    let org = { name: 'Dayspring Medical Center', logoUrl: '/logo0.png' } as any
    try { const orgRes = await fetch(new URL('/api/settings/org', req.url).toString()); const data = await orgRes.json(); if (data?.settings) org = { ...org, ...data.settings } } catch {}
    let logoDataUrl: string | undefined
    try {
      const origin = new URL(req.url).origin
      const safeLogo = org.logoUrl?.startsWith('http') ? org.logoUrl : `${origin}${org.logoUrl}`
      const lr = await fetch(safeLogo)
      if (lr.ok) {
        const ct = lr.headers.get('content-type') || 'image/png'
        const ab = await lr.arrayBuffer(); const b = Buffer.from(ab)
        logoDataUrl = `data:${ct};base64,${b.toString('base64')}`
      }
    } catch {}

    const title = `${org.name} - Laboratory Results`
    const periodStr = [from || '', to || ''].filter(Boolean).join(' to ')
    const buf = await toPDF(
      title,
      tableRows,
      { userId: auth.userId, timestamp: new Date().toISOString() },
      false,
      {
        logoDataUrl,
        meta: { Period: periodStr, Email: org.email, Tel: org.phone, Location: org.location, "Printed By": auth.email },
        subtitle: `${org.name} - Information System`,
        watermarkOpacity: 0.08,
        groupByKey: 'Patient',
        subGroupKey: 'Test'
      }
    )
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=labs-${new Date().toISOString().slice(0,10)}.pdf` } })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 })
  }
}
