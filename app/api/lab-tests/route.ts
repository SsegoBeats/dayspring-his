import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

async function ensureSchema() {
  try {
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Routine'")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS specimen_type VARCHAR(100)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS accession_number VARCHAR(50)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS collected_at TIMESTAMP")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES users(id)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS rejection_reason TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_radiologist_id UUID REFERENCES users(id)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_code VARCHAR(20)")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_long_name TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_property TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_scale TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_system TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_time_aspct TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_class TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS loinc_units TEXT")
    await query("ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS result_json JSONB DEFAULT '{}'::jsonb")
    await query("CREATE INDEX IF NOT EXISTS idx_lab_tests_ordered ON lab_tests(ordered_at DESC)")
    await query("CREATE INDEX IF NOT EXISTS idx_lab_tests_accession ON lab_tests(accession_number)")
    await query("CREATE INDEX IF NOT EXISTS idx_lab_tests_assigned_radiologist ON lab_tests(assigned_radiologist_id)")
    await query("CREATE INDEX IF NOT EXISTS idx_lab_tests_loinc ON lab_tests(loinc_code)")
  } catch {}
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Ensure extended lab_tests schema exists (priority, assigned_radiologist_id, etc.)
    await ensureSchema()

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const q = (url.searchParams.get('q') || '').trim()
    const patientId = url.searchParams.get('patientId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)))
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

    const whereParts: string[] = []
    const params: any[] = []
    if (status && status !== 'all') { params.push(status); whereParts.push(`status ILIKE $${params.length}`) }
    if (patientId) { params.push(patientId); whereParts.push(`patient_id = $${params.length}`) }
    if (from) { params.push(from); whereParts.push(`ordered_at >= $${params.length}`) }
    if (to) { params.push(to); whereParts.push(`ordered_at <= $${params.length}`) }
    if (q) {
      params.push(`%${q.toLowerCase()}%`)
      whereParts.push(`(LOWER(test_name) LIKE $${params.length} OR LOWER(test_type) LIKE $${params.length} OR accession_number ILIKE $${params.length})`)
    }
    params.push(limit)
    params.push(offset)

    const { rows } = await query(
      `SELECT lt.*, p.first_name, p.last_name, p.gender, p.date_of_birth,
              d.name AS doctor_name,
              t.name AS lab_tech_name,
              ar.name AS assigned_radiologist_name
         FROM lab_tests lt
         LEFT JOIN patients p ON p.id = lt.patient_id
         LEFT JOIN users d ON d.id = lt.doctor_id
         LEFT JOIN users t ON t.id = lt.lab_tech_id
         LEFT JOIN users ar ON ar.id = lt.assigned_radiologist_id
        ${whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''}
        ORDER BY COALESCE(lt.completed_at, lt.ordered_at) DESC
        LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    )

    const tests = rows.map((r:any)=>({
      id: r.id,
      patientId: r.patient_id,
      patientName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      doctorId: r.doctor_id,
      doctorName: r.doctor_name || '',
      testName: r.test_name,
      testType: r.test_type,
      status: r.status,
      results: r.results || '',
      notes: r.notes || '',
      labTechId: r.lab_tech_id || null,
      labTechName: r.lab_tech_name || '',
      orderedAt: r.ordered_at,
      completedAt: r.completed_at || null,
      priority: r.priority || 'Routine',
      specimenType: r.specimen_type || null,
      accessionNumber: r.accession_number || null,
      collectedAt: r.collected_at || null,
      collectedBy: r.collected_by || null,
      rejectionReason: r.rejection_reason || null,
      reviewedBy: r.reviewed_by || null,
      reviewedAt: r.reviewed_at || null,
      patientGender: r.gender || null,
      patientDob: r.date_of_birth || null,
      assignedToId: r.assigned_radiologist_id || null,
      assignedToName: r.assigned_radiologist_name || null,
      assignedAt: r.assigned_at || null,
      loincCode: r.loinc_code || null,
      loincLongName: r.loinc_long_name || null,
      loincProperty: r.loinc_property || null,
      loincScale: r.loinc_scale || null,
      loincSystem: r.loinc_system || null,
      loincTimeAspct: r.loinc_time_aspct || null,
      loincClass: r.loinc_class || null,
      loincUnits: r.loinc_units || null,
      resultJson: r.result_json || {},
    }))
    return NextResponse.json({ tests })
  } catch (e:any) {
    console.error("Error in /api/lab-tests GET:", e)
    return NextResponse.json({ error: 'Failed to load lab tests', details: e.message }, { status: 500 })
  }
}

function generateAccession() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  const t = String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0')
  return `ACC${y}${m}${day}-${t}${String(Math.floor(Math.random()*90)+10)}`
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const forbiddenOrderRoles = ["Receptionist", "Lab Tech"]
    if (forbiddenOrderRoles.includes(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Allow roles that can order labs via medical create or patient update (lab tech cannot create orders)
    if (!can(auth.role, 'medical', 'create') && !can(auth.role, 'patients', 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await ensureSchema()
    const body = await req.json().catch(()=> ({}))
    const patientId = String(body.patientId||'')
    const notes = body.notes ? String(body.notes) : null
    const priorityDefault = String(body.priority||'Routine')
    const specimenDefault = body.specimenType ? String(body.specimenType) : null
    const incomingTests = Array.isArray(body.tests) && body.tests.length
      ? body.tests
      : [{ testName: body.testName, testType: body.testType, priority: body.priority, specimenType: body.specimenType, loincCode: body.loincCode }]

    if (!patientId) return NextResponse.json({ error: 'patientId is required' }, { status: 400 })

    const created: any[] = []
    for (const t of incomingTests) {
      const loincCode = t?.loincCode ? String(t.loincCode) : null
      const specimenType = t?.specimenType ? String(t.specimenType) : specimenDefault
      const priority = t?.priority ? String(t.priority) : priorityDefault
      let testName = t?.testName ? String(t.testName) : ''
      let testType = t?.testType ? String(t.testType) : 'General'
      let loinc: any = null
      if (loincCode) {
        const { rows: lrows } = await query("SELECT * FROM loinc_tests WHERE loinc_code = $1", [loincCode])
        loinc = lrows[0] || null
        if (loinc) {
          if (!testName) testName = loinc.long_common_name || loinc.shortname || loinc.loinc_code
          testType = loinc.class || testType
        }
      }
      if (!testName) continue
      const accession = generateAccession()
      const { rows } = await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `INSERT INTO lab_tests (
           patient_id, doctor_id, test_name, test_type, status,
           notes, priority, specimen_type, accession_number, ordered_at,
           loinc_code, loinc_long_name, loinc_property, loinc_scale, loinc_system, loinc_time_aspct, loinc_class, loinc_units
         ) VALUES ($1,$2,$3,$4,'Pending',$5,$6,$7,$8, NOW(),
                   $9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id, accession_number, ordered_at`,
        [
          patientId,
          auth.userId,
          testName,
          testType,
          notes,
          priority,
          specimenType,
          accession,
          loincCode,
          loinc?.long_common_name || null,
          loinc?.property || null,
          loinc?.scale_typ || null,
          loinc?.system || null,
          loinc?.time_aspct || null,
          loinc?.class || null,
          loinc?.units || loinc?.example_units || null,
        ]
      )
      const createdRow = rows[0]
      created.push({ id: createdRow.id, accessionNumber: createdRow.accession_number, orderedAt: createdRow.ordered_at, testName })

      try {
        await writeAuditLog({
          userId: auth.userId,
          action: "CREATE",
          entityType: "LabTest",
          entityId: createdRow.id,
          details: { patientId, testName, testType, priority, specimenType, loincCode },
        })
      } catch {}
    }

    if (!created.length) return NextResponse.json({ error: "No tests were created. Ensure testName or LOINC code is provided." }, { status: 400 })

    // Notify Lab department
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/notify/department`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ department: 'lab', title: 'New Lab Tests Ordered', message: `${created.length} test(s) ordered`, payload: { patientId } })
      })
    } catch {}

    return NextResponse.json({ tests: created })
  } catch (e:any) {
    return NextResponse.json({ error: 'Failed to order lab test', details: e.message }, { status: 500 })
  }
}
