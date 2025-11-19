import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value || cookieStore.get('session_dev')?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rows } = await query(
      `SELECT lt.id, lt.patient_id, p.first_name, p.last_name, p.patient_number, p.gender, p.date_of_birth,
              lt.doctor_id, d.name AS doctor_name,
              lt.test_name, lt.test_type, lt.status, lt.results, lt.notes,
              lt.lab_tech_id, t.name AS lab_tech_name,
              lt.ordered_at, lt.completed_at, lt.priority, lt.specimen_type, lt.accession_number, lt.collected_at, lt.collected_by,
              lt.reviewed_by, rb.name AS reviewed_by_name, lt.reviewed_at,
              lt.assigned_radiologist_id, ar.name AS assigned_radiologist_name, lt.assigned_at
         FROM lab_tests lt
         LEFT JOIN patients p ON p.id = lt.patient_id
         LEFT JOIN users d ON d.id = lt.doctor_id
         LEFT JOIN users t ON t.id = lt.lab_tech_id
         LEFT JOIN users rb ON rb.id = lt.reviewed_by
         LEFT JOIN users ar ON ar.id = lt.assigned_radiologist_id
        WHERE lt.id = $1`, [id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const r:any = rows[0]
    const test = {
      id: r.id,
      patientId: r.patient_id,
      patientName: [r.first_name, r.last_name].filter(Boolean).join(' '),
      patientNumber: r.patient_number,
      doctorName: r.doctor_name || '',
      testName: r.test_name,
      testType: r.test_type,
      status: r.status,
      results: r.results || '',
      notes: r.notes || '',
      labTechName: r.lab_tech_name || '',
      orderedAt: r.ordered_at,
      completedAt: r.completed_at || null,
      priority: r.priority || 'Routine',
      specimenType: r.specimen_type || null,
      accessionNumber: r.accession_number || null,
      collectedAt: r.collected_at || null,
      reviewedBy: r.reviewed_by_name || null,
      reviewedAt: r.reviewed_at || null,
      patientGender: r.gender || null,
      patientDob: r.date_of_birth || null,
      assignedToId: r.assigned_radiologist_id || null,
      assignedToName: r.assigned_radiologist_name || null,
      assignedAt: r.assigned_at || null,
    }
    return NextResponse.json({ test })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to load test' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const cookieStore = await cookies()
    const token = cookieStore.get('session')?.value || cookieStore.get('session_dev')?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as {
      reviewed?: boolean
      status?: string
      results?: string
      notes?: string
      specimenType?: string
      collectedAt?: string
      priority?: string
      rejectionReason?: string
      assignedRadiologistId?: string | null
    }
    const reviewed = body.reviewed

    // Load role for authorization
    const u = await query<{ role: string; name: string }>("SELECT role, name FROM users WHERE id = $1", [auth.userId])
    const role = (u.rows?.[0]?.role || '').toString()
    const name = u.rows?.[0]?.name || 'Doctor'
    if (!["Doctor", "Hospital Admin", "Lab Tech", "Radiologist"].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (reviewed === false) {
      // Unreview – allowed for Admin only
      if (role !== 'Hospital Admin') return NextResponse.json({ error: 'Only admin can unreview' }, { status: 403 })
      await query("UPDATE lab_tests SET reviewed_by = NULL, reviewed_at = NULL WHERE id = $1", [id])
      return NextResponse.json({ success: true })
    }
    // Status/results/specimen update
    const hasStatusLikeUpdate =
      body.status ||
      body.results !== undefined ||
      body.notes !== undefined ||
      body.specimenType !== undefined ||
      body.collectedAt !== undefined ||
      body.priority !== undefined ||
      body.rejectionReason !== undefined ||
      body.assignedRadiologistId !== undefined

    if (hasStatusLikeUpdate) {
      if (!["Hospital Admin", "Lab Tech", "Doctor", "Radiologist"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const fields: string[] = []
      const params2: any[] = []
      if (body.status) { fields.push(`status = $${fields.length+1}`); params2.push(body.status) }
      if (body.results !== undefined) { fields.push(`results = $${fields.length+1}`); params2.push(body.results) }
      if (body.notes !== undefined) { fields.push(`notes = $${fields.length+1}`); params2.push(body.notes) }
      if (body.specimenType !== undefined) { fields.push(`specimen_type = $${fields.length+1}`); params2.push(body.specimenType) }
      if (body.priority !== undefined) { fields.push(`priority = $${fields.length+1}`); params2.push(body.priority) }
      if (body.rejectionReason !== undefined) { fields.push(`rejection_reason = $${fields.length+1}`); params2.push(body.rejectionReason) }
      if (body.collectedAt !== undefined) { fields.push(`collected_at = $${fields.length+1}, collected_by = $${fields.length+2}`); params2.push(new Date(body.collectedAt).toISOString()); params2.push(auth.userId) }
      if (body.assignedRadiologistId !== undefined) {
        fields.push(`assigned_radiologist_id = $${fields.length + 1}`)
        params2.push(body.assignedRadiologistId)
        if (body.assignedRadiologistId) {
          fields.push(`assigned_at = NOW()`)
        } else {
          fields.push(`assigned_at = NULL`)
        }
      }
      if (body.status && body.status.toLowerCase() === 'completed') { fields.push(`completed_at = NOW()`) }
      params2.push(id)
      try {
        await queryWithSession({ role, userId: auth.userId }, `UPDATE lab_tests SET ${fields.join(', ')} WHERE id = $${params2.length}`, params2)
      } catch (err: any) {
        const msg = String(err?.message || '')
        const friendly =
          msg.match(/row-level security|violates row-level security/i) ? 'Update blocked by security policy for your role.' :
          msg.match(/permission denied|not authorized|forbidden/i) ? 'You do not have permission to update this test.' :
          msg.match(/reviewed_?by|reviewed_?at/i) ? 'Only a Doctor or Admin can set review fields.' :
          msg.match(/completed_at|status/i) && role === 'Doctor' ? 'Only Lab Tech or Admin can complete results.' :
          'Failed to update lab test.'
        const code = msg.match(/row-level security|permission denied|not authorized|forbidden|reviewed_/i) ? 403 : 400
        return NextResponse.json({ error: friendly, details: process.env.NODE_ENV === 'production' ? undefined : msg }, { status: code })
      }
      try { await writeAuditLog({ userId: auth.userId, action: 'UPDATE', entityType: 'LabTest', entityId: id, details: { ...body } }) } catch {}
      return NextResponse.json({ success: true })
    }

    if (reviewed === true) {
      // Mark reviewed: record user and time
      try {
        await queryWithSession({ role, userId: auth.userId }, "UPDATE lab_tests SET reviewed_by = $1, reviewed_at = NOW() WHERE id = $2", [auth.userId, id])
      } catch (err:any) {
        const msg = String(err?.message || '')
        const friendly = msg.match(/row-level security|permission denied/i) ? 'You are not allowed to review this test.' : 'Failed to mark reviewed.'
        const code = msg.match(/row-level security|permission denied/i) ? 403 : 400
        return NextResponse.json({ error: friendly, details: process.env.NODE_ENV === 'production' ? undefined : msg }, { status: code })
      }
      try {
        await query(
          `UPDATE notifications
           SET read_at = NOW()
           WHERE (payload->>'testId') = $1
             AND (title ILIKE '%lab%' OR message ILIKE '%lab%')`,
          [id]
        )
      } catch {}
      try {
        await query(
          "INSERT INTO notifications (user_id, title, message, type, priority) VALUES ($1, $2, $3, $4, $5)",
          [null, 'Lab Result Reviewed', `${name} reviewed lab test ${id}`, 'Lab Result', 'Standard']
        )
      } catch {}
      try { await writeAuditLog({ userId: auth.userId, action: 'REVIEW', entityType: 'LabTest', entityId: id, details: { reviewed: true } }) } catch {}
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'No changes' }, { status: 400 })
  } catch (e) {
    console.error('PATCH /api/lab-tests/[id] failed', e)
    return NextResponse.json({ error: 'Failed to update lab test' }, { status: 500 })
  }
}
