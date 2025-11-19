import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query, queryWithSession } from "@/lib/db"
import { verifyToken, can } from "@/lib/security"

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS patient_deletion_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
      requested_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function ensureNotifications() {
  try {
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        department VARCHAR(100),
        role VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'System' CHECK (type IN ('Patient Arrival', 'Lab Result', 'Prescription', 'Payment', 'Low Stock', 'System', 'Other')),
        priority VARCHAR(20) DEFAULT 'Standard' CHECK (priority IN ('Emergency', 'High', 'Standard', 'Low')),
        is_read BOOLEAN DEFAULT false,
        related_patient_id UUID REFERENCES patients(id),
        payload JSONB,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
    // Add type column if it doesn't exist (for existing installations)
    await query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='type') THEN
          ALTER TABLE notifications ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'System' CHECK (type IN ('Patient Arrival', 'Lab Result', 'Prescription', 'Payment', 'Low Stock', 'System', 'Other'));
        END IF;
      END $$;
    `)
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`)    
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_dept ON notifications(department, created_at DESC)`) 
    await query(`CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role, created_at DESC)`)      
  } catch {}
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    const auth = token ? verifyToken(token) : null
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    await ensureTable()

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

    await ensureTable()

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
    await ensureNotifications()
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

    await ensureTable()

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
      await ensureNotifications()
      // Notify requester of rejection
      await query(
        `INSERT INTO notifications (user_id, title, message, type, payload) VALUES ($1, $2, $3, $4, $5)`,
        [reqRow.requested_by, 'Deletion Request Rejected', `Deletion request for patient ${reqRow.patient_id} was rejected.`, 'System', JSON.stringify({ requestId })]
      )
      return NextResponse.json({ success: true })
    }

    // Approve: delete patient and mark request Approved
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `DELETE FROM patients WHERE id = $1`,
      [reqRow.patient_id]
    )
    await queryWithSession(
      { role: auth.role, userId: auth.userId },
      `UPDATE patient_deletion_requests SET status = 'Approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [auth.userId, requestId]
    )
    await ensureNotifications()
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
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
}
