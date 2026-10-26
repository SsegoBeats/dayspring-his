import { NextResponse } from "next/server"
import { query, withClient } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"

type AuthUser = { id: string; role: string; facilityId?: string | null }

async function checkAuth(allowedRoles: string[] = []) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value

  if (!token) return { error: "Authentication required", status: 401 }

  const payload = verifyToken(token)
  if (!payload) return { error: "Invalid token", status: 401 }

  const { rows } = await query("SELECT role, is_active, facility_id FROM users WHERE id = $1", [payload.userId])
  const user = rows[0]

  if (!user || !user.is_active) return { error: "User not found or inactive", status: 401 }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role))
    return { error: "Insufficient permissions", status: 403 }

  return { user: { id: payload.userId, role: user.role, facilityId: user.facility_id } }
}

async function canAccessAssignmentByFacility(user: AuthUser, assignmentId: string) {
  if (user.role === "Hospital Admin") return true
  if (!user.facilityId) return true
  const { rows } = await query(
    `SELECT 1
       FROM bed_assignments ba
       JOIN patients p ON p.id = ba.patient_id
      WHERE ba.id = $1 AND p.facility_id::text = $2
      LIMIT 1`,
    [assignmentId, String(user.facilityId)],
  )
  return rows.length > 0
}

async function canAccessBedByFacility(user: AuthUser, bedId: string) {
  if (user.role === "Hospital Admin") return true
  if (!user.facilityId) return true
  try {
    const { rows } = await query<{ ward: string }>("SELECT ward FROM beds WHERE id = $1 LIMIT 1", [bedId])
    if (!rows.length) return false
    const wardName = (rows[0].ward || "").trim()
    if (!wardName) return false
    const wardScope = await query(
      `SELECT 1 FROM wards WHERE facility_id::text = $1 AND name = $2 LIMIT 1`,
      [String(user.facilityId), wardName],
    )
    return wardScope.rows.length > 0
  } catch {
    return true
  }
}

// POST /api/beds/assignments/transfer - Transfer patient from one bed to another
export async function POST(request: Request) {
  try {
    const authResult = await checkAuth(["Nurse", "Hospital Admin"])
    if (authResult.error)
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })

    const body = await request.json()
    const { assignmentId, targetBedId, notes } = body

    if (!assignmentId || !targetBedId) {
      return NextResponse.json(
        { error: "Missing required fields: assignmentId, targetBedId" },
        { status: 400 }
      )
    }

    if (!(await canAccessAssignmentByFacility(authResult.user as AuthUser, assignmentId))) {
      return NextResponse.json({ error: "Active assignment not found" }, { status: 404 })
    }
    if (!(await canAccessBedByFacility(authResult.user as AuthUser, targetBedId))) {
      return NextResponse.json({ error: "Target bed not found" }, { status: 404 })
    }

    const assignmentRes = await query(
      `SELECT ba.id, ba.bed_id, ba.patient_id, ba.assigned_by
       FROM bed_assignments ba
       WHERE ba.id = $1 AND ba.status = 'Active'`,
      [assignmentId]
    )
    if (assignmentRes.rows.length === 0)
      return NextResponse.json({ error: "Active assignment not found" }, { status: 404 })

    const assignment = assignmentRes.rows[0]
    const currentBedId = assignment.bed_id
    const patientId = assignment.patient_id

    if (currentBedId === targetBedId)
      return NextResponse.json({ error: "Patient is already in the target bed" }, { status: 409 })

    const targetBedRes = await query(
      "SELECT id, status FROM beds WHERE id = $1",
      [targetBedId]
    )
    if (targetBedRes.rows.length === 0)
      return NextResponse.json({ error: "Target bed not found" }, { status: 404 })
    if (targetBedRes.rows[0].status !== "Available")
      return NextResponse.json({ error: "Target bed is not available" }, { status: 409 })

    const newAssignment = await withClient(async (client) => {
      await client.query("BEGIN")
      try {
        await client.query(
          `UPDATE bed_assignments SET status = 'Transfer', discharge_date = NOW(), notes = COALESCE(notes || E'\n', '') || 'Transferred to new bed', updated_at = NOW() WHERE id = $1`,
          [assignmentId]
        )
        await client.query(
          `UPDATE beds SET status = 'Available', updated_at = NOW() WHERE id = $1`,
          [currentBedId]
        )

        const ins = await client.query(
          `INSERT INTO bed_assignments (bed_id, patient_id, assigned_by, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [targetBedId, patientId, authResult.user!.id, notes ? `Transfer: ${notes}` : "Bed transfer"]
        )

        await client.query(
          `UPDATE beds SET status = 'Occupied', updated_at = NOW() WHERE id = $1`,
          [targetBedId]
        )

        await client.query("COMMIT")
        return ins.rows[0]
      } catch (e) {
        await client.query("ROLLBACK")
        throw e
      }
    })

    try {
      await writeAuditLog({
        userId: authResult.user!.id,
        action: "TRANSFER",
        entityType: "BedAssignment",
        entityId: newAssignment.id,
        details: { fromBedId: currentBedId, toBedId: targetBedId, patientId, notes },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      assignment: {
        id: newAssignment.id,
        bedId: newAssignment.bed_id,
        patientId: newAssignment.patient_id,
        assignedBy: newAssignment.assigned_by,
        assignedAt: newAssignment.assigned_at,
        status: newAssignment.status,
        notes: newAssignment.notes,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error("[Bed Assignments Transfer] Error:", error)
    return NextResponse.json(
      { error: "Failed to transfer patient", details: process.env.NODE_ENV === "development" ? error.message : undefined },
      { status: 500 }
    )
  }
}
