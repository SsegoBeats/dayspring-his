import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query } from "@/lib/db"
import { toPDF } from "@/lib/exports/writers/pdf"

export const runtime = 'nodejs'

function parseAnalytes(results?: string, sex?: string, ageYears?: number | null) {
  const out: { Parameter: string; Value: string; RefRange?: string; Flag?: string }[] = []
  if (!results) return out
  const rx = /(Hb|WBC|Platelets|HCT|MCV|Neut|Lymph|Mono|Eos|Baso|RBS|ALT|AST|ALP|T\.?\s*Bilirubin|D\.?\s*Bilirubin|Albumin|Total\s*Protein|CRP|pH|SG|Nitrite|Leukocyte|Blood|Protein|Glucose|Ketone|HIV\s*Rapid|Test\s*1|Test\s*2)\s*:\s*([^\n]+)/ig
  const toNum = (s:string) => { const m = String(s).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null }
  const ref = (k:string): [number|null, number|null, string] => {
    switch (k) {
      case 'Hb': {
        if (typeof ageYears === 'number' && ageYears < 12) return [11.5, 15.5, 'g/dL']
        const female = (sex || '').toLowerCase() === 'female'
        return [female ? 12 : 13, female ? 15.5 : 17, 'g/dL']
      }
      case 'WBC': return [4, 11, 'x10^9/L']
      case 'Platelets': return [150, 450, 'x10^9/L']
      case 'HCT': {
        if (typeof ageYears === 'number' && ageYears < 12) return [35, 45, '%']
        const female = (sex || '').toLowerCase() === 'female'
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
  let m: RegExpExecArray | null
  while ((m = rx.exec(results)) != null) {
    const k = m[1].replace(/\s+/g,' ')
    const v = m[2].trim()
    const [lo, hi, unit] = ref(k)
    const val = toNum(v)
    let flag = ''
    if (val != null && lo != null && hi != null) flag = val < lo ? 'L' : (val > hi ? 'H' : '')
    out.push({ Parameter: k, Value: v, RefRange: (lo!=null&&hi!=null)? `${lo}-${hi} ${unit}` : undefined, Flag: flag || undefined })
  }
  return out
}

function parseInterpretations(results?: string) {
  if (!results) return [] as string[]
  const idx = results.indexOf('Interpretation:')
  if (idx === -1) return []
  const block = results.slice(idx)
  const lines = block.split(/\r?\n/).slice(1)
  return lines.map(l => l.replace(/^[-\s]+/, '').trim()).filter(Boolean)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value || cookieStore.get('session_dev')?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const testQ = await query(
      `SELECT lt.id, lt.patient_id, p.first_name, p.last_name, p.patient_number, p.gender, p.date_of_birth,
              lt.doctor_id, d.name AS doctor_name,
              lt.test_name, lt.test_type, lt.status, lt.results, lt.notes,
              lt.lab_tech_id, t.name AS lab_tech_name,
              lt.ordered_at, lt.completed_at, lt.priority, lt.specimen_type, lt.accession_number, lt.collected_at, lt.collected_by,
              lt.reviewed_by, rb.name AS reviewed_by_name, lt.reviewed_at
         FROM lab_tests lt
         LEFT JOIN patients p ON p.id = lt.patient_id
         LEFT JOIN users d ON d.id = lt.doctor_id
         LEFT JOIN users t ON t.id = lt.lab_tech_id
         LEFT JOIN users rb ON rb.id = lt.reviewed_by
        WHERE lt.id = $1`, [id]
    )
    if (!testQ.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r:any = testQ.rows[0]
    const patientName = [r.first_name, r.last_name].filter(Boolean).join(' ')

    // Org settings and logo data URL
    let org = { name: 'Dayspring Medical Center', logoUrl: '/logo0.png', email: 'dayspringmedicalcenter@gmail.com', phone: '+256 703-942-230 / +256 703-844-396 / +256 742-918-253', location: 'Wanyange, Uganda' } as any
    try { const orgRes = await fetch(new URL('/api/settings/org', req.url).toString()); const data = await orgRes.json(); if (data?.settings) org = { ...org, ...data.settings } } catch {}
    let logoDataUrl: string | undefined
    try {
      const origin = new URL(req.url).origin
      const safeLogo = org.logoUrl?.startsWith('http') ? org.logoUrl : `${origin}${org.logoUrl}`
      const lr = await fetch(safeLogo)
      if (lr.ok) {
        const ct = lr.headers.get('content-type') || 'image/png'
        const ab = await lr.arrayBuffer()
        const b = Buffer.from(ab)
        logoDataUrl = `data:${ct};base64,${b.toString('base64')}`
      }
    } catch {}

    // Compute age in years
    const dob = r.date_of_birth ? new Date(r.date_of_birth) : null
    const ageYears = (dob && !isNaN(dob.getTime())) ? (()=>{ const n=new Date(); let y = n.getFullYear()-dob.getFullYear(); const m=n.getMonth()-dob.getMonth(); if(m<0||(m===0&&n.getDate()<dob.getDate())) y--; return Math.max(0,y) })() : null
    const analyteRows = parseAnalytes(r.results || '', r.gender || '', ageYears)
    const interpretations = parseInterpretations(r.results || '')
    // Compute flags summary
    const highCount = analyteRows.filter((x:any)=> x.Flag === 'H').length
    const lowCount = analyteRows.filter((x:any)=> x.Flag === 'L').length
    const meta = { Patient: patientName, 'P.ID': r.patient_number || '-', Gender: r.gender || '-', Age: (ageYears!=null? String(ageYears)+' yr' : '-'), Test: r.test_name || r.test_type, Accession: r.accession_number || '-', Ordered: String(r.ordered_at||''), Flags: (highCount||lowCount) ? `H:${highCount} L:${lowCount}` : undefined as any }
    const title = `${org.name} - Laboratory Result`
    const preparedRows = analyteRows.length ? [...analyteRows] : [{ Note: (r.results || '').slice(0, 1000) }]
    if (highCount || lowCount) {
      preparedRows.push({ Parameter: 'Flags Summary', Value: `H:${highCount} L:${lowCount}` } as any)
    }
    if (interpretations.length) {
      preparedRows.push({ Parameter: 'Interpretation', Value: interpretations.join(' | ') } as any)
    }
    const buf = await toPDF(title, preparedRows, { userId: auth.userId, timestamp: new Date().toISOString() }, false, { logoDataUrl, meta, subtitle: `${org.name} - Information System` })
    return new NextResponse(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=lab-result-${id}.pdf` } })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 })
  }
}
