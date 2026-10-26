import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { query } from "@/lib/db"
import { verifyToken } from "@/lib/security"

function canAccessReferrals(role: string) {
  return ['Clinician', 'Nurse', 'Midwife', 'Hospital Admin'].includes(role)
}

export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const urgency = url.searchParams.get('urgency')
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)))

    const userRes = await query<{ department?: string | null; facility_id?: string | null }>(
      `SELECT department, facility_id FROM users WHERE id = $1`,
      [payload.sub],
    )
    const userDepartment = userRes.rows[0]?.department || null
    const userFacilityId = userRes.rows[0]?.facility_id || null

    const whereClauses = [
      `r.type = 'internal'`,
      `(r.receiving_user_id = $1 OR (
        r.receiving_user_id IS NULL
        AND r.receiving_department IS NOT NULL
        AND (
          LOWER(TRIM(r.receiving_department)) = LOWER(TRIM(COALESCE($2, '')))
          OR LOWER(TRIM(r.receiving_department)) = LOWER(TRIM($3))
        )
      ))`,
    ]
    const params: Array<string | number | null> = [payload.sub, userDepartment, payload.role]
    let paramIndex = 4

    if (userFacilityId) {
      whereClauses.push(`(r.facility_id IS NULL OR r.facility_id = $${paramIndex})`)
      params.push(userFacilityId)
      paramIndex += 1
    }

    if (status) {
      whereClauses.push(`r.status = $${paramIndex}`)
      params.push(status)
      paramIndex += 1
    }

    if (urgency) {
      whereClauses.push(`r.urgency = $${paramIndex}`)
      params.push(urgency)
      paramIndex += 1
    }

    params.push(limit)

    const result = await query<any>(
      `SELECT r.*, 
              u.name as referring_user_name,
              p.first_name || ' ' || p.last_name as patient_name,
              p.patient_number
       FROM referrals r
       INNER JOIN users u ON r.referring_user_id = u.id
       INNER JOIN patients p ON r.patient_id = p.id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY
         CASE r.urgency
           WHEN 'emergency' THEN 1
           WHEN 'Very Urgent' THEN 2
           WHEN 'urgent' THEN 3
           WHEN 'routine' THEN 4
           ELSE 5
         END,
         r.created_at DESC
       LIMIT $${paramIndex}`,
      params
    )

    return NextResponse.json({ referrals: result.rows })
  } catch (error: any) {
    console.error('[referrals/incoming] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch incoming referrals' }, { status: 500 })
  }
}
