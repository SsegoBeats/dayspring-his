import { NextResponse } from "next/server"
import { query } from "@/lib/db"
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

// DELETE /api/beds/[id] - Delete specific bed
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication - only Hospital Admin can delete beds
    const authResult = await checkAuth(['Hospital Admin'])
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { id: bedId } = await params

    if (!bedId) {
      return NextResponse.json(
        { error: "Bed ID is required" },
        { status: 400 }
      )
    }

    // Check if bed has active assignments
    const activeAssignments = await query(
      "SELECT COUNT(*) FROM bed_assignments WHERE bed_id = $1 AND status = 'Active'",
      [bedId]
    )

    if (parseInt(activeAssignments.rows[0].count) > 0) {
      return NextResponse.json(
        { error: "Cannot delete bed with active patient assignments" },
        { status: 409 }
      )
    }

    // Delete bed assignments first (cascade should handle this, but being explicit)
    await query("DELETE FROM bed_assignments WHERE bed_id = $1", [bedId])
    
    // Delete the bed
    const result = await query("DELETE FROM beds WHERE id = $1 RETURNING bed_number", [bedId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Bed not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Bed ${result.rows[0].bed_number} deleted successfully`
    })

  } catch (error: any) {
    console.error("[Beds API] Delete bed error:", error)
    return NextResponse.json(
      { 
        error: "Failed to delete bed",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}

// PUT /api/beds/[id] - Update specific bed
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication - Hospital Admin and Nurse can update beds
    const authResult = await checkAuth(['Hospital Admin', 'Nurse'])
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { id: bedId } = await params
    const body = await request.json()
    const { bedNumber, ward, bedType, location, equipment, notes, status } = body

    if (!bedId) {
      return NextResponse.json(
        { error: "Bed ID is required" },
        { status: 400 }
      )
    }

    // Check if bed exists
    const existingBed = await query("SELECT id FROM beds WHERE id = $1", [bedId])
    if (existingBed.rows.length === 0) {
      return NextResponse.json(
        { error: "Bed not found" },
        { status: 404 }
      )
    }

    // If updating bed number, check for conflicts
    if (bedNumber) {
      const conflictCheck = await query(
        "SELECT id FROM beds WHERE bed_number = $1 AND id != $2",
        [bedNumber, bedId]
      )
      if (conflictCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "Bed number already exists" },
          { status: 409 }
        )
      }
    }

    // Update bed
    const result = await query(`
      UPDATE beds 
      SET 
        bed_number = COALESCE($2, bed_number),
        ward = COALESCE($3, ward),
        bed_type = COALESCE($4, bed_type),
        location = COALESCE($5, location),
        equipment = COALESCE($6, equipment),
        notes = COALESCE($7, notes),
        status = COALESCE($8, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      bedId,
      bedNumber,
      ward,
      bedType,
      location,
      equipment ? JSON.stringify(equipment) : null,
      notes,
      status
    ])

    const updatedBed = result.rows[0]

    return NextResponse.json({
      success: true,
      bed: {
        id: updatedBed.id,
        bedNumber: updatedBed.bed_number,
        ward: updatedBed.ward,
        bedType: updatedBed.bed_type,
        status: updatedBed.status,
        location: updatedBed.location,
        equipment: updatedBed.equipment,
        notes: updatedBed.notes,
        createdAt: updatedBed.created_at,
        updatedAt: updatedBed.updated_at,
      }
    })

  } catch (error: any) {
    console.error("[Beds API] Update bed error:", error)
    return NextResponse.json(
      { 
        error: "Failed to update bed",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}
