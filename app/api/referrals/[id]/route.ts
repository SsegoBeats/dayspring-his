import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"
import { z } from "zod"

const UpdateReferralSchema = z.object({
  status: z.enum(['pending', 'accepted', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
})

interface ReferralStatusRow {
  id: string
  status: string
  status_history?: unknown
  receiving_user_id?: string | null
  receiving_department?: string | null
}

function canAccessReferrals(role: string) {
  return ['Clinician', 'Nurse', 'Midwife', 'Hospital Admin'].includes(role)
}

async function ensureReferralSchema() {
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES users(id) ON DELETE SET NULL`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL`)
  await query(`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb`)
}

function canTransitionStatus(currentStatus: string, nextStatus: string) {
  if (currentStatus === nextStatus) return true
  if (currentStatus === 'pending' && (nextStatus === 'accepted' || nextStatus === 'cancelled')) return true
  if (currentStatus === 'accepted' && (nextStatus === 'completed' || nextStatus === 'cancelled')) return true
  return false
}

async function getUserFacilityId(userId: string) {
  const userRes = await query<{ facility_id?: string }>(
    `SELECT facility_id FROM users WHERE id = $1`,
    [userId]
  )
  return userRes.rows[0]?.facility_id || null
}

function isReferralRecipient(
  referral: { receiving_user_id?: string | null; receiving_department?: string | null },
  userId: string,
  role: string,
) {
  if (referral.receiving_user_id) return referral.receiving_user_id === userId
  return referral.receiving_department?.trim().toLowerCase() === role.trim().toLowerCase()
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params
    await ensureReferralSchema()
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessReferrals(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const data = UpdateReferralSchema.parse(body)

    if (!data.status && data.notes === undefined) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const adminByIdQuery =
      `SELECT id, status, status_history, receiving_user_id, receiving_department
         FROM referrals
        WHERE id = $1`
    const scopedByIdQuery =
      `SELECT id, status, status_history, receiving_user_id, receiving_department
         FROM referrals
        WHERE id = $1
          AND (
            referring_user_id = $2
            OR receiving_user_id = $2
            OR (facility_id IS NOT NULL AND facility_id = $3)
          )`

    let existingRow: ReferralStatusRow | null = null
    if (payload.role === 'Hospital Admin') {
      const existing = await query<ReferralStatusRow>(adminByIdQuery, [routeParams.id])
      existingRow = existing.rows[0] || null
    } else {
      const facilityId = await getUserFacilityId(payload.sub)
      const existing = await query<ReferralStatusRow>(scopedByIdQuery, [routeParams.id, payload.sub, facilityId])
      existingRow = existing.rows[0] || null
    }

    if (!existingRow) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    if (data.status && !canTransitionStatus(existingRow.status, data.status)) {
      return NextResponse.json(
        { error: `Invalid referral status transition: ${existingRow.status} -> ${data.status}` },
        { status: 409 }
      )
    }
    if (
      data.status &&
      (data.status === "accepted" || data.status === "completed") &&
      payload.role !== "Hospital Admin" &&
      !isReferralRecipient(existingRow, payload.sub, payload.role)
    ) {
      return NextResponse.json({ error: "Only the intended receiving care team can accept or complete this handoff" }, { status: 403 })
    }

    const previousHistory = Array.isArray(existingRow.status_history)
      ? existingRow.status_history
      : []

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (data.status) {
      updates.push(`status = $${paramIndex++}`)
      values.push(data.status)

      const statusHistory = [
        ...previousHistory,
        {
          status: data.status,
          changedAt: new Date().toISOString(),
          changedBy: payload.sub,
        },
      ]
      updates.push(`status_history = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(statusHistory))

      if (data.status === 'accepted') {
        updates.push(`accepted_at = COALESCE(accepted_at, now())`)
        updates.push(`accepted_by = COALESCE(accepted_by, $${paramIndex++})`)
        values.push(payload.sub)
      }
      if (data.status === 'completed') {
        updates.push(`completed_at = COALESCE(completed_at, now())`)
        updates.push(`completed_by = COALESCE(completed_by, $${paramIndex++})`)
        values.push(payload.sub)
      }
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(data.notes)
    }

    updates.push(`updated_at = now()`)
    values.push(routeParams.id)

    if (payload.role === 'Hospital Admin') {
      const adminResult = await query<{ id: string }>(
        `UPDATE referrals SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id`,
        values
      )
      if (adminResult.rows.length === 0) {
        return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }

    const facilityId = await getUserFacilityId(payload.sub)
    const scopedResult = await query<{ id: string }>(
      `UPDATE referrals
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
         AND (
           referring_user_id = $${paramIndex + 1}
           OR receiving_user_id = $${paramIndex + 1}
           OR (facility_id IS NOT NULL AND facility_id = $${paramIndex + 2})
         )
       RETURNING id`,
      [...values, payload.sub, facilityId]
    )
    if (scopedResult.rows.length === 0) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
    }
    console.error('[referrals/:id] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update referral' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params
    const cookieStore = await cookies()
    const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canAccessReferrals(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let result
    if (payload.role === 'Hospital Admin') {
      result = await query<any>(
        `SELECT r.*,
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         WHERE r.id = $1`,
        [routeParams.id]
      )
    } else {
      const facilityId = await getUserFacilityId(payload.sub)
      result = await query<any>(
        `SELECT r.*,
                u1.name as referring_user_name,
                u2.name as receiving_user_name,
                p.first_name || ' ' || p.last_name as patient_name
         FROM referrals r
         LEFT JOIN users u1 ON r.referring_user_id = u1.id
         LEFT JOIN users u2 ON r.receiving_user_id = u2.id
         LEFT JOIN patients p ON r.patient_id = p.id
         WHERE r.id = $1
           AND (
             r.referring_user_id = $2
             OR r.receiving_user_id = $2
             OR (r.facility_id IS NOT NULL AND r.facility_id = $3)
           )`,
        [routeParams.id, payload.sub, facilityId]
      )
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 })
    }

    return NextResponse.json({ referral: result.rows[0] })
  } catch (error: any) {
    console.error('[referrals/:id] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch referral' }, { status: 500 })
  }
}
