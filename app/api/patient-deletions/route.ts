import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query, queryWithSession } from "@/lib/db"
import { verifyToken, can } from "@/lib/security"

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get("status") || undefined

    // Only admins (or roles that can delete patients) can list requests
    if (!can(auth.role, 'patients', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const params: any[] = []
    let where = ''
    if (status) { where = 'WHERE r.status = $1'; params.push(status) }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `SELECT r.id, r.patient_id, r.reason, r.status, r.requested_by, r.approved_by, r.approved_at, r.created_at,
              p.patient_number, p.first_name, p.last_name,
              u.name as requested_by_name, u.role as requested_by_role
       FROM patient_deletion_requests r
       JOIN patients p ON p.id = r.patient_id
       LEFT JOIN users u ON u.id = r.requested_by
       ${where}
       ORDER BY r.created_at DESC
      `,
      params
    )
    return NextResponse.json({ requests: rows })
  } catch (err: any) {
    console.error('Error listing patient deletion requests:', err)
    return NextResponse.json({ error: 'Failed to list requests' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const patientId: string | undefined = body?.patientId
    const reason: string | undefined = (body?.reason || '').toString().trim()
    if (!patientId || !reason) {
      return NextResponse.json({ error: 'patientId and reason are required' }, { status: 400 })
    }

    // Allow anyone who can read patients to file a deletion request
    if (!can(auth.role, 'patients', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { rows } = await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `INSERT INTO patient_deletion_requests (patient_id, reason, requested_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
       [patientId, reason, auth.userId]
    )
    const reqId = rows[0]?.id

    // Load patient minimal info for message
    const pat = await query(`SELECT patient_number, first_name, last_name FROM patients WHERE id = $1`, [patientId])
    const pn = pat.rows?.[0]?.patient_number || ''
    const name = `${pat.rows?.[0]?.first_name || ''} ${pat.rows?.[0]?.last_name || ''}`.trim()

    // Notify admins via role-targeted notification and the requester personally
    const message = `Deletion requested for ${name} (${pn}). Reason: ${reason}`
    await query(
      `INSERT INTO notifications (user_id, role, title, message, type, payload) VALUES (NULL, $1, $2, $3, $4, $5)`,
      ['Hospital Admin', 'Patient Deletion Request', message, 'System', JSON.stringify({ requestId: reqId, patientId })]
    )
    await query(
      `INSERT INTO notifications (user_id, title, message, type, payload) VALUES ($1, $2, $3, $4, $5)`,
      [auth.userId, 'Deletion Request Submitted', message, 'System', JSON.stringify({ requestId: reqId, patientId })]
    )

    return NextResponse.json({ success: true, id: reqId })
  } catch (err: any) {
    console.error('Error creating patient deletion request:', err)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Only roles that can delete patients may approve/reject and perform deletion
    if (!can(auth.role, 'patients', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const requestId: string | undefined = body?.requestId
    const approve: boolean = !!body?.approve
    if (!requestId) return NextResponse.json({ error: 'requestId is required' }, { status: 400 })

    // Load request info
    const { rows: reqRows } = await query(`SELECT * FROM patient_deletion_requests WHERE id = $1`, [requestId])
    if (!reqRows.length) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    const reqRow: any = reqRows[0]

    if (!approve) {
      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `UPDATE patient_deletion_requests SET status = 'Rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [auth.userId, requestId]
      )
      // Notify requester of rejection
      await query(
        `INSERT INTO notifications (user_id, title, message, type, payload) VALUES ($1, $2, $3, $4, $5)`,
        [reqRow.requested_by, 'Deletion Request Rejected', `Deletion request for patient ${reqRow.patient_id} was rejected.`, 'System', JSON.stringify({ requestId })]
      )
      return NextResponse.json({ success: true })
    }

    // Approve: mark request Approved first (audit), then delete patient and dependents.
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patient_deletion_requests SET status = 'Approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [auth.userId, requestId]
    )

    const patientId = reqRow.patient_id
    try {
      await queryWithSession(
        { role: auth.role, userId: auth.userId },
        `DELETE FROM patients WHERE id = $1`,
        [patientId]
      )
    } catch (e: any) {
      if (String(e?.code || "") !== "23503") throw e

      const deletes: Array<[string, string]> = [
        ["triage_assessments", "patient_id"],
        ["appointments", "patient_id"],
        ["medical_records", "patient_id"],
        ["vital_signs", "patient_id"],
        ["nursing_notes", "patient_id"],
        ["prescriptions", "patient_id"],
        ["lab_tests", "patient_id"],
        ["radiology_tests", "patient_id"],
        ["bills", "patient_id"],
        ["payments", "patient_id"],
        ["patient_routing", "patient_id"],
        ["bed_assignments", "patient_id"],
        ["checkins", "patient_id"],
        ["documents", "patient_id"],
        ["insurance_policies", "patient_id"],
        ["patient_feedback", "patient_id"],
        ["patient_deletion_requests", "patient_id"],
      ]
      for (const [tbl, col] of deletes) {
        try {
          await queryWithSession(
            { role: auth.role, userId: auth.userId },
            `DELETE FROM ${tbl} WHERE ${col} = $1`,
            [patientId]
          )
        } catch {}
      }
      try {
        await queryWithSession(
          { role: auth.role, userId: auth.userId },
          `DELETE FROM patients WHERE id = $1`,
          [patientId]
        )
      } catch (retryErr: any) {
        if (String((retryErr as any)?.code || "") === "23503") {
          return NextResponse.json(
            { error: "Patient cannot be deleted due to remaining references. Request marked Approved; remove dependencies and delete the patient manually if needed." },
            { status: 409 },
          )
        }
        throw retryErr
      }
    }
    // Notify requester and admins of approval
    await query(
      `INSERT INTO notifications (user_id, title, message, type, payload) VALUES ($1, $2, $3, $4, $5)`,
      [reqRow.requested_by, 'Deletion Request Approved', `Patient has been deleted.`, 'System', JSON.stringify({ requestId })]
    )
    await query(
      `INSERT INTO notifications (user_id, role, title, message, type, payload) VALUES (NULL, $1, $2, $3, $4, $5)`,
      ['Hospital Admin', 'Patient Deleted', `Patient record was deleted via approved request.`, 'System', JSON.stringify({ requestId })]
    )
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error approving patient deletion request:', err)
    if (String(err?.code || "") === "23503") {
      return NextResponse.json({ error: "Patient cannot be deleted due to existing references." }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
