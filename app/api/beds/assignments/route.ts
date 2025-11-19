import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/security"

// Helper function to check authentication and role
async function checkAuth(allowedRoles: string[] = []) {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value || cookieStore.get("session_dev")?.value
  
  if (!token) {
    return { error: "Authentication required", status: 401 }
  }
  
  const payload = verifyToken(token)
  if (!payload) {
    return { error: "Invalid token", status: 401 }
  }
  
  // Get user role from database
  const { rows } = await query("SELECT role, is_active FROM users WHERE id = $1", [payload.userId])
  const user = rows[0]
  
  if (!user || !user.is_active) {
    return { error: "User not found or inactive", status: 401 }
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: "Insufficient permissions", status: 403 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

// GET /api/beds/assignments - Get bed assignments
export async function GET(request: Request) {
  try {
    // Check authentication - all authenticated users can view assignments
    const authResult = await checkAuth()
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'Active'
    const ward = searchParams.get('ward')
    const bedId = searchParams.get('bedId')

    const conditions: string[] = []
    const params: any[] = []
    let idx = 1
    if (status && status.toLowerCase() !== 'all') {
      conditions.push(`ba.status = $${idx}`); params.push(status); idx++
    }
    if (ward) { conditions.push(`b.ward = $${idx}`); params.push(ward); idx++ }
    if (bedId) { conditions.push(`ba.bed_id = $${idx}`); params.push(bedId); idx++ }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const assignments = await query(`
      SELECT 
        ba.*,
        b.bed_number,
        b.ward,
        b.bed_type,
        p.first_name,
        p.last_name,
        p.patient_number,
        u.name as assigned_by_name
      FROM bed_assignments ba
      JOIN beds b ON ba.bed_id = b.id
      JOIN patients p ON ba.patient_id = p.id
      JOIN users u ON ba.assigned_by = u.id
      ${whereClause}
      ORDER BY ba.assigned_at DESC
    `, params)

    return NextResponse.json({
      assignments: assignments.rows.map(assignment => ({
        id: assignment.id,
        bedId: assignment.bed_id,
        bedNumber: assignment.bed_number,
        ward: assignment.ward,
        bedType: assignment.bed_type,
        patient: {
          id: assignment.patient_id,
          name: `${assignment.first_name} ${assignment.last_name}`.trim(),
          patientNumber: assignment.patient_number,
        },
        assignedBy: {
          id: assignment.assigned_by,
          name: assignment.assigned_by_name,
        },
        assignedAt: assignment.assigned_at,
        dischargeDate: assignment.discharge_date,
        status: assignment.status,
        notes: assignment.notes,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
      })),
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Bed Assignments API] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch bed assignments",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}

// POST /api/beds/assignments - Create bed assignment
export async function POST(request: Request) {
  try {
    // Check authentication - only Nurse can assign patients to beds
    const authResult = await checkAuth(['Nurse'])
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const body = await request.json()
    const { bedId, patientId, assignedBy, notes } = body

    // Validate required fields
    if (!bedId || !patientId || !assignedBy) {
      return NextResponse.json(
        { error: "Missing required fields: bedId, patientId, assignedBy" },
        { status: 400 }
      )
    }

    // Check if bed is available
    const bed = await query(
      "SELECT status FROM beds WHERE id = $1",
      [bedId]
    )

    if (bed.rows.length === 0) {
      return NextResponse.json(
        { error: "Bed not found" },
        { status: 404 }
      )
    }

    if (bed.rows[0].status !== 'Available') {
      return NextResponse.json(
        { error: "Bed is not available for assignment" },
        { status: 409 }
      )
    }

    // Check if patient already has an active assignment
    const existingAssignment = await query(
      "SELECT id FROM bed_assignments WHERE patient_id = $1 AND status = 'Active'",
      [patientId]
    )

    if (existingAssignment.rows.length > 0) {
      return NextResponse.json(
        { error: "Patient already has an active bed assignment" },
        { status: 409 }
      )
    }

    // Start transaction
    const client = await query('BEGIN')

    try {
      // Create bed assignment
      const assignmentResult = await query(`
        INSERT INTO bed_assignments (bed_id, patient_id, assigned_by, notes)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [bedId, patientId, assignedBy || authResult.user.id, notes])

      // Update bed status to occupied
      await query(
        "UPDATE beds SET status = 'Occupied', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [bedId]
      )

      await query('COMMIT')

      const newAssignment = assignmentResult.rows[0]

      // Audit
      try { await writeAuditLog({ userId: authResult.user.id, action: 'ASSIGN', entityType: 'BedAssignment', entityId: newAssignment.id, details: { bedId, patientId, notes } }) } catch {}

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
          createdAt: newAssignment.created_at,
        }
      }, { status: 201 })

    } catch (error) {
      await query('ROLLBACK')
      throw error
    }

  } catch (error: any) {
    console.error("[Bed Assignments API] Create assignment error:", error)
    return NextResponse.json(
      { 
        error: "Failed to create bed assignment",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}

// PATCH /api/beds/assignments - Update an assignment (e.g., discharge)
export async function PATCH(request: Request) {
  try {
    // Nurse or Admin can discharge
    const authResult = await checkAuth(['Nurse', 'Hospital Admin'])
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const body = await request.json()
    const { assignmentId, status, dischargeDate, notes } = body

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
    }

    // Get assignment and bed
    const { rows } = await query(`SELECT bed_id, status FROM bed_assignments WHERE id = $1`, [assignmentId])
    if (rows.length === 0) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    const bedId = rows[0].bed_id

    const newStatus = status || 'Discharged'

    const client = await query('BEGIN')
    try {
      await query(
        `UPDATE bed_assignments SET status = $1, discharge_date = COALESCE($2, discharge_date), notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [newStatus, dischargeDate || new Date().toISOString(), notes || null, assignmentId]
      )
      // Free the bed when not Active
      if (newStatus !== 'Active') {
        await query(`UPDATE beds SET status = 'Available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [bedId])
      }
      await query('COMMIT')
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }

    // Audit
    try { await writeAuditLog({ userId: authResult.user.id, action: 'DISCHARGE', entityType: 'BedAssignment', entityId: assignmentId, details: { bedId, status: newStatus, notes } }) } catch {}
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Bed Assignments API] Update assignment error:', error)
    return NextResponse.json({ error: 'Failed to update bed assignment' }, { status: 500 })
  }
}
