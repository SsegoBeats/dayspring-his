import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"
import { query, queryWithSession } from "@/lib/db"
import { formatPatientNumber } from "@/lib/patients"
import { writeAuditLog } from "@/lib/audit"
import { checkCriticalValues } from "@/lib/lab-results-validation"

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
              lt.assigned_radiologist_id, ar.name AS assigned_radiologist_name, lt.assigned_at,
              lt.loinc_code, lt.loinc_long_name, lt.loinc_property, lt.loinc_scale, lt.loinc_system, lt.loinc_time_aspct, lt.loinc_class, lt.loinc_units, lt.result_json,
              lt.rejection_reason
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
      patientNumber: formatPatientNumber(r.patient_number),
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
      loincCode: r.loinc_code || null,
      loincLongName: r.loinc_long_name || null,
      loincProperty: r.loinc_property || null,
      loincScale: r.loinc_scale || null,
      loincSystem: r.loinc_system || null,
      loincTimeAspct: r.loinc_time_aspct || null,
      loincClass: r.loinc_class || null,
      loincUnits: r.loinc_units || null,
      resultJson: r.result_json || {},
      rejectionReason: r.rejection_reason || null,
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
      assignedLabTechId?: string | null
      resultJson?: any
    }
    const reviewed = body.reviewed

    // Load role for authorization
    const u = await query<{ role: string; name: string }>("SELECT role, name FROM users WHERE id = $1", [auth.userId])
    const role = (u.rows?.[0]?.role || '').toString()
    const name = u.rows?.[0]?.name || 'Clinician'
    if (!["Clinician", "Hospital Admin", "Lab Tech", "Radiologist"].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (reviewed === false) {
      // Unreview - allowed for Admin only
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
      body.assignedRadiologistId !== undefined ||
      body.assignedLabTechId !== undefined

    if (hasStatusLikeUpdate) {
      if (!["Hospital Admin", "Lab Tech", "Clinician", "Radiologist"].includes(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      
      // Check if we need to auto-assign lab tech when completing
      let shouldAutoAssignLabTech = false
      if (body.status && body.status.toLowerCase() === 'completed' && body.assignedLabTechId === undefined && role === 'Lab Tech') {
        const checkTech = await query("SELECT lab_tech_id FROM lab_tests WHERE id = $1", [id])
        if (!checkTech.rows[0]?.lab_tech_id) {
          shouldAutoAssignLabTech = true
        }
      }
      
      const fields: string[] = []
      const params2: any[] = []
      if (body.status) { fields.push(`status = $${fields.length+1}`); params2.push(body.status) }
      if (body.results !== undefined) { fields.push(`results = $${fields.length+1}`); params2.push(body.results) }
      if (body.notes !== undefined) { fields.push(`notes = $${fields.length+1}`); params2.push(body.notes) }
      if (body.specimenType !== undefined) { fields.push(`specimen_type = $${fields.length+1}`); params2.push(body.specimenType) }
      if (body.priority !== undefined) { fields.push(`priority = $${fields.length+1}`); params2.push(body.priority) }
      if (body.rejectionReason !== undefined) { fields.push(`rejection_reason = $${fields.length+1}`); params2.push(body.rejectionReason) }
      if (body.resultJson !== undefined) { fields.push(`result_json = $${fields.length+1}`); params2.push(body.resultJson || {}) }
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
      if (body.assignedLabTechId !== undefined) {
        fields.push(`lab_tech_id = $${fields.length + 1}`)
        params2.push(body.assignedLabTechId)
      } else if (shouldAutoAssignLabTech) {
        // Auto-assign to current user if completing and no lab tech assigned
        fields.push(`lab_tech_id = $${fields.length + 1}`)
        params2.push(auth.userId)
      }
      if (body.status && body.status.toLowerCase() === 'completed') { 
        fields.push(`completed_at = NOW()`)
      }
      params2.push(id)
      
      if (fields.length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
      }
      try {
        await queryWithSession({ role, userId: auth.userId }, `UPDATE lab_tests SET ${fields.join(', ')} WHERE id = $${params2.length}`, params2)
      } catch (err: any) {
        const msg = String(err?.message || '')
        const friendly =
          msg.match(/row-level security|violates row-level security/i) ? 'Update blocked by security policy for your role.' :
          msg.match(/permission denied|not authorized|forbidden/i) ? 'You do not have permission to update this test.' :
          msg.match(/reviewed_?by|reviewed_?at/i) ? 'Only a Clinician or Admin can set review fields.' :
          msg.match(/completed_at|status/i) && role === 'Clinician' ? 'Only Lab Tech or Admin can complete results.' :
          'Failed to update lab test.'
        const code = msg.match(/row-level security|permission denied|not authorized|forbidden|reviewed_/i) ? 403 : 400
        return NextResponse.json({ error: friendly, details: process.env.NODE_ENV === 'production' ? undefined : msg }, { status: code })
      }
      try { await writeAuditLog({ userId: auth.userId, action: 'UPDATE', entityType: 'LabTest', entityId: id, details: { ...body } }) } catch {}
      
      // Notify assigned radiologist when a case is assigned
      if (body.assignedRadiologistId && body.assignedRadiologistId !== auth.userId) {
        try {
          const { rows: testRows } = await query(
            `SELECT lt.test_name, lt.test_type, lt.priority, lt.patient_id, p.first_name, p.last_name
             FROM lab_tests lt
             LEFT JOIN patients p ON p.id = lt.patient_id
             WHERE lt.id = $1`,
            [id]
          )
          const test = testRows[0]
          if (test) {
            const patientName = test.first_name && test.last_name 
              ? `${test.first_name} ${test.last_name}`.trim()
              : 'patient'
            await query(
              `INSERT INTO notifications (user_id, title, message, type, priority, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                body.assignedRadiologistId,
                'Radiology Case Assigned',
                `Case assigned: ${test.test_name || test.test_type} for ${patientName}`,
                'Radiology',
                test.priority === 'Stat' || test.priority === 'Urgent' ? 'High' : 'Standard',
                JSON.stringify({ testId: id, patientId: test.patient_id })
              ]
            )
          }
        } catch {}
      }

      // Notify assigned lab tech when work is delegated by another user.
      if (body.assignedLabTechId && body.assignedLabTechId !== auth.userId) {
        try {
          const { rows: testRows } = await query(
            `SELECT lt.test_name, lt.test_type, lt.priority, lt.patient_id, p.first_name, p.last_name
             FROM lab_tests lt
             LEFT JOIN patients p ON p.id = lt.patient_id
             WHERE lt.id = $1`,
            [id],
          )
          const test = testRows[0]
          if (test) {
            const patientName = test.first_name && test.last_name
              ? `${test.first_name} ${test.last_name}`.trim()
              : "patient"
            await query(
              `INSERT INTO notifications (user_id, title, message, type, priority, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                body.assignedLabTechId,
                "Lab Test Assigned",
                `Assigned: ${test.test_name || test.test_type} for ${patientName}.`,
                "Lab Result",
                test.priority === "Stat" || test.priority === "Urgent" ? "High" : "Standard",
                JSON.stringify({ testId: id, patientId: test.patient_id, assigned: true }),
              ],
            )
          }
        } catch {}
      }

      // Notify ordering clinician when radiology reports are completed, otherwise run lab critical-value checks.
      if (body.status && body.status.toLowerCase() === 'completed' && body.results) {
        try {
          const { rows: testRows } = await query(
            `SELECT lt.doctor_id, lt.test_name, lt.test_type, lt.patient_id,
                    lt.priority, p.first_name, p.last_name, p.gender, p.date_of_birth
             FROM lab_tests lt
             LEFT JOIN patients p ON p.id = lt.patient_id
             WHERE lt.id = $1`,
            [id]
          )
          const test = testRows[0]
          if (test && test.doctor_id) {
            const isRadiologyStudy = ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography'].includes(test.test_name || test.test_type)
            const patientName = test.first_name && test.last_name
              ? `${test.first_name} ${test.last_name}`.trim()
              : 'patient'

            if (isRadiologyStudy) {
              await query(
                `INSERT INTO notifications (user_id, title, message, type, priority, payload)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  test.doctor_id,
                  'Radiology Report Ready',
                  `Radiology report completed: ${test.test_name || test.test_type} for ${patientName}.`,
                  'Radiology',
                  test.priority === 'Stat' || test.priority === 'Urgent' ? 'High' : 'Standard',
                  JSON.stringify({
                    testId: id,
                    patientId: test.patient_id,
                    reportReady: true,
                  })
                ]
              )
            } else {
              const criticalCheck = checkCriticalValues(body.results, test.gender, test.date_of_birth)
              const criticalValues = criticalCheck.criticalValues.filter((v) => v.severity === "critical")
              const criticalParams = criticalValues
                .map((v) => `${v.parameter} (${v.value})`)
                .join(", ")

              await query(
                `INSERT INTO notifications (user_id, title, message, type, priority, payload)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  test.doctor_id,
                  criticalCheck.hasCritical ? "Critical Lab Results" : "Lab Results Ready",
                  criticalCheck.hasCritical
                    ? `CRITICAL values detected in ${test.test_name || test.test_type} for ${patientName}: ${criticalParams}. Please review immediately.`
                    : `Lab results completed: ${test.test_name || test.test_type} for ${patientName}.`,
                  "Lab Result",
                  criticalCheck.hasCritical ? "High" : (test.priority === "Stat" || test.priority === "Urgent" ? "High" : "Standard"),
                  JSON.stringify({
                    testId: id,
                    patientId: test.patient_id,
                    resultReady: true,
                    critical: criticalCheck.hasCritical,
                    criticalCount: criticalCheck.criticalCount,
                    criticalValues,
                  }),
                ],
              )
            }
          }
        } catch (err) {
          console.error('Error sending completion notification:', err)
        }
      }

      if (body.status && body.status.toLowerCase() === 'cancelled') {
        try {
          const { rows: testRows } = await query(
            `SELECT lt.doctor_id, lt.test_name, lt.test_type, lt.patient_id,
                    p.first_name, p.last_name
             FROM lab_tests lt
             LEFT JOIN patients p ON p.id = lt.patient_id
             WHERE lt.id = $1`,
            [id]
          )
          const test = testRows[0]
          const isRadiologyStudy = test && ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Mammography'].includes(test.test_name || test.test_type)
          if (test && test.doctor_id && isRadiologyStudy) {
            const patientName = test.first_name && test.last_name
              ? `${test.first_name} ${test.last_name}`.trim()
              : 'patient'
            await query(
              `INSERT INTO notifications (user_id, title, message, type, priority, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                test.doctor_id,
                'Radiology Study Cancelled',
                `Radiology study cancelled: ${test.test_name || test.test_type} for ${patientName}.`,
                'Radiology',
                'Standard',
                JSON.stringify({
                  testId: id,
                  patientId: test.patient_id,
                  cancelled: true,
                })
              ]
            )
          } else if (test && test.doctor_id && !body.rejectionReason) {
            const patientName = test.first_name && test.last_name
              ? `${test.first_name} ${test.last_name}`.trim()
              : "patient"
            await query(
              `INSERT INTO notifications (user_id, title, message, type, priority, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                test.doctor_id,
                "Lab Test Cancelled",
                `Lab test cancelled: ${test.test_name || test.test_type} for ${patientName}.`,
                "Lab Result",
                "Standard",
                JSON.stringify({
                  testId: id,
                  patientId: test.patient_id,
                  cancelled: true,
                }),
              ],
            )
          }
        } catch (err) {
          console.error('Error sending radiology cancellation notification:', err)
        }
      }

      // Notify clinician when test is rejected
      if (body.status && body.status.toLowerCase() === 'cancelled' && body.rejectionReason) {
        try {
          const { rows: testRows } = await query(
            `SELECT lt.doctor_id, lt.test_name, lt.test_type, lt.patient_id, 
                    p.first_name, p.last_name
             FROM lab_tests lt
             LEFT JOIN patients p ON p.id = lt.patient_id
             WHERE lt.id = $1`,
            [id]
          )
          const test = testRows[0]
          if (test && test.doctor_id) {
            const patientName = test.first_name && test.last_name 
              ? `${test.first_name} ${test.last_name}`.trim()
              : 'patient'
            
            await query(
              `INSERT INTO notifications (user_id, title, message, type, priority, payload)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                test.doctor_id,
                'Specimen Rejected',
                `Specimen rejected for ${test.test_name || test.test_type} - ${patientName}. Reason: ${body.rejectionReason}`,
                'Lab Result',
                'Standard',
                JSON.stringify({ 
                  testId: id, 
                  patientId: test.patient_id,
                  rejectionReason: body.rejectionReason
                })
              ]
            )
          }
        } catch (err) {
          console.error('Error sending rejection notification:', err)
        }
      }
      
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


