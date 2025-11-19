import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"

export const runtime = 'nodejs'

function getAnalyteRows(test: any) {
  const rows: { Patient: string; PID?: string; Test: string; Parameter: string; Value: string; RefRange?: string; Flag?: string; Accession?: string; Ordered?: string; Completed?: string }[] = []
  const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein|CRP|pH|SG|Nitrite|Leukocyte|Blood|Protein|Glucose|Ketone|HIV\s*Rapid|Test\s*1|Test\s*2)\s*:\s*([^\n]+)/ig
  const toNum = (s:string) => { const m = String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
  const ref = (k:string): [number|null, number|null, string] => {
    switch (k) {
      case 'Hb': return [12, 17, 'g/dL']
      case 'WBC': return [4, 11, 'x10^9/L']
      case 'Platelets': return [150, 450, 'x10^9/L']
      case 'HCT': return [36, 52, '%']
      case 'MCV': return [80, 100, 'fL']
      case 'Neut': return [40, 75, '%']
      case 'Lymph': return [20, 45, '%']
      case 'Mono': return [2, 10, '%']
      case 'Eos': return [1, 6, '%']
      case 'Baso': return [0, 2, '%']
      case 'RBS': return [3.9, 7.8, 'mmol/L']
      case 'ALT': return [7, 55, 'U/L']
      case 'AST': return [8, 48, 'U/L']
      case 'ALP': return [40, 130, 'U/L']
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
  try {
    if (typeof test.results !== 'string') return rows
    const resStr = String(test.results)
    let m: RegExpExecArray | null
    while ((m = rx.exec(resStr)) != null) {
      const k = m[1].replace(/\s+/g,' ')
      const v = m[2].trim()
      const [lo, hi, unit] = ref(k)
      const val = toNum(v)
      let flag = ''
      if (val != null && lo != null && hi != null) flag = val < lo ? 'L' : (val > hi ? 'H' : '')
      rows.push({ Patient: test.patientName, PID: test.patient_number || test.patientNumber || '', Test: test.testName || test.test_type || test.testType, Parameter: k, Value: v, RefRange: (lo!=null&&hi!=null) ? `${lo}-${hi} ${unit}` : undefined, Flag: flag || undefined, Accession: test.accession_number || test.accessionNumber, Ordered: test.ordered_at || test.orderedAt, Completed: test.completed_at || test.completedAt })
    }
    // Interpretations block
    const idx = resStr.indexOf('Interpretation:')
    if (idx !== -1) {
      const block = resStr.slice(idx)
      const lines = block.split(/\r?\n/).slice(1).map((l:string)=> l.replace(/^[-\s]+/,'').trim()).filter(Boolean)
      if (lines.length) rows.push({ Patient: test.patientName, PID: test.patient_number || test.patientNumber || '', Test: test.testName || test.test_type || test.testType, Parameter: 'Interpretation', Value: lines.join(' | '), Accession: test.accession_number || test.accessionNumber, Ordered: test.ordered_at || test.orderedAt, Completed: test.completed_at || test.completedAt })
    }
  } catch {}
  return rows
}

function toCSV(rows: any[]): string {
  const headers = ['Patient','P.ID','Test','Parameter','Value','RefRange','Flag','Accession','Ordered','Completed']
  const escape = (v:any) => {
    const s = String(v ?? '')
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"'
    return s
  }
  const out: string[] = [headers.join(',')]
  for (const r of rows) {
    out.push([
      escape(r.Patient),
      escape(r.PID || r['P.ID'] || ''),
      escape(r.Test),
      escape(r.Parameter),
      escape(r.Value),
      escape(r.RefRange || ''),
      escape(r.Flag || ''),
      escape(r.Accession || ''),
      escape(r.Ordered || ''),
      escape(r.Completed || ''),
    ].join(','))
  }
  return out.join('\n')
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
      `SELECT lt.id, lt.patient_id, p.first_name, p.last_name, p.patient_number,
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
        LIMIT 5000`, params)

    const tests = rows.map((r:any)=> ({
      ...r,
      patientName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      testName: r.test_name,
      orderedAt: r.ordered_at,
      completedAt: r.completed_at,
      accessionNumber: r.accession_number
    }))
    const tableRows = tests.flatMap(getAnalyteRows)
    const csv = toCSV(tableRows)
    return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename=labs-analytes-${new Date().toISOString().slice(0,10)}.csv` } })
  } catch (e:any) {
    console.error('CSV export failed:', e?.message || e)
    // Return an empty CSV with headers so UI still downloads a file
    const headers = 'Patient,P.ID,Test,Parameter,Value,RefRange,Flag,Accession,Ordered,Completed\n'
    return new NextResponse(headers, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename=labs-analytes-${new Date().toISOString().slice(0,10)}.csv` } })
  }
}
