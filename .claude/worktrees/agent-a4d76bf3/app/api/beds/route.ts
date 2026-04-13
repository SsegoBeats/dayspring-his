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

// GET /api/beds - Get all beds with optional filtering
export async function GET(request: Request) {
  try {
    // Check authentication - all authenticated users can view beds
    const authResult = await checkAuth()
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const { searchParams } = new URL(request.url)
    const ward = searchParams.get('ward')
    const status = searchParams.get('status')
    const bedType = searchParams.get('bedType')
    const hasPatient = searchParams.get('hasPatient') // 'assigned' | 'unassigned'

    let whereClause = ''
    const params: any[] = []
    let paramIndex = 1

    if (ward) {
      whereClause += ` WHERE ward = $${paramIndex}`
      params.push(ward)
      paramIndex++
    }

    if (status) {
      whereClause += whereClause ? ` AND status = $${paramIndex}` : ` WHERE status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (bedType) {
      whereClause += whereClause ? ` AND bed_type = $${paramIndex}` : ` WHERE bed_type = $${paramIndex}`
      params.push(bedType)
      paramIndex++
    }

    // Get comprehensive bed summary for occupancy calculation
    const bedSummary = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Occupied') as occupied_beds,
        COUNT(*) FILTER (WHERE status = 'Available') as available_beds,
        COUNT(*) FILTER (WHERE status = 'Maintenance') as maintenance_beds,
        COUNT(*) FILTER (WHERE status = 'Reserved') as reserved_beds,
        COUNT(*) as total_beds,
        COUNT(DISTINCT ward) as total_wards
      FROM beds ${whereClause}
    `, params)

    const summary = bedSummary.rows[0]

    // Calculate occupancy rate with proper error handling
    const occupancyRate = summary.total_beds > 0
      ? Math.round((summary.occupied_beds / summary.total_beds) * 100)
      : 0

    // Get ward-wise breakdown for detailed analytics
    const wardBreakdown = await query(`
      SELECT 
        ward,
        COUNT(*) as total_beds,
        COUNT(*) FILTER (WHERE status = 'Occupied') as occupied_beds,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'Occupied')::DECIMAL / COUNT(*)) * 100, 2
        ) as occupancy_rate
      FROM beds 
      GROUP BY ward 
      ORDER BY ward
    `)

    // Get detailed bed information
    const beds = await query(`
      SELECT 
        b.*,
        ba.id as assignment_id,
        ba.patient_id,
        ba.assigned_at,
        ba.discharge_date,
        ba.status as assignment_status,
        p.first_name,
        p.last_name,
        p.patient_number,
        las.last_status,
        las.last_assigned_at,
        las.last_discharge_date,
        las.last_patient_first,
        las.last_patient_last
      FROM beds b
      LEFT JOIN bed_assignments ba ON b.id = ba.bed_id AND ba.status = 'Active'
      LEFT JOIN patients p ON ba.patient_id = p.id
      LEFT JOIN LATERAL (
        SELECT 
          ba2.status as last_status,
          ba2.assigned_at as last_assigned_at,
          ba2.discharge_date as last_discharge_date,
          p2.first_name as last_patient_first,
          p2.last_name as last_patient_last
        FROM bed_assignments ba2
        LEFT JOIN patients p2 ON p2.id = ba2.patient_id
        WHERE ba2.bed_id = b.id
        ORDER BY COALESCE(ba2.updated_at, ba2.assigned_at) DESC
        LIMIT 1
      ) las ON TRUE
      ${(() => {
        const cond = hasPatient === 'assigned' ? 'ba.patient_id IS NOT NULL' : hasPatient === 'unassigned' ? 'ba.patient_id IS NULL' : ''
        if (!cond) return whereClause
        return whereClause ? `${whereClause} AND ${cond}` : ` WHERE ${cond}`
      })()}
      ORDER BY b.ward, b.bed_number
    `, params)

    return NextResponse.json({
      summary: {
        total: parseInt(summary.total_beds),
        occupied: parseInt(summary.occupied_beds),
        available: parseInt(summary.available_beds),
        maintenance: parseInt(summary.maintenance_beds),
        reserved: parseInt(summary.reserved_beds),
        occupancyRate,
        totalWards: parseInt(summary.total_wards),
      },
      wardBreakdown: wardBreakdown.rows.map(row => ({
        ward: row.ward,
        totalBeds: parseInt(row.total_beds),
        occupiedBeds: parseInt(row.occupied_beds),
        occupancyRate: parseFloat(row.occupancy_rate),
      })),
      beds: beds.rows.map(bed => ({
        id: bed.id,
        bedNumber: bed.bed_number,
        ward: bed.ward,
        bedType: bed.bed_type,
        status: bed.status,
        location: bed.location,
        equipment: bed.equipment,
        notes: bed.notes,
        assignmentId: bed.assignment_id,
        patient: bed.patient_id ? {
          id: bed.patient_id,
          name: `${bed.first_name} ${bed.last_name}`.trim(),
          patientNumber: bed.patient_number,
          assignedAt: bed.assigned_at,
          dischargeDate: bed.discharge_date,
        } : null,
        lastAssignment: bed.last_status ? {
          status: bed.last_status,
          assignedAt: bed.last_assigned_at,
          dischargeDate: bed.last_discharge_date,
          patientName: `${bed.last_patient_first || ''} ${bed.last_patient_last || ''}`.trim()
        } : null,
        createdAt: bed.created_at,
        updatedAt: bed.updated_at,
      })),
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Beds API] Database error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch bed data",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}

// POST /api/beds - Create new bed
export async function POST(request: Request) {
  try {
    // Check authentication - only Hospital Admin can add beds
    const authResult = await checkAuth(['Hospital Admin'])
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }
    const body = await request.json()
    const { bedNumber, ward, bedType, location, equipment, notes } = body

    // Validate required fields
    if (!bedNumber || !ward || !bedType) {
      return NextResponse.json(
        { error: "Missing required fields: bedNumber, ward, bedType" },
        { status: 400 }
      )
    }

    // Check if bed number already exists
    const existingBed = await query(
      "SELECT id FROM beds WHERE bed_number = $1",
      [bedNumber]
    )

    if (existingBed.rows.length > 0) {
      return NextResponse.json(
        { error: "Bed number already exists" },
        { status: 409 }
      )
    }

    // Insert new bed
    const result = await query(`
      INSERT INTO beds (bed_number, ward, bed_type, location, equipment, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [bedNumber, ward, bedType, location, equipment ? JSON.stringify(equipment) : null, notes])

    const newBed = result.rows[0]

    return NextResponse.json({
      success: true,
      bed: {
        id: newBed.id,
        bedNumber: newBed.bed_number,
        ward: newBed.ward,
        bedType: newBed.bed_type,
        status: newBed.status,
        location: newBed.location,
        equipment: newBed.equipment,
        notes: newBed.notes,
        createdAt: newBed.created_at,
        updatedAt: newBed.updated_at,
      }
    }, { status: 201 })

  } catch (error: any) {
    console.error("[Beds API] Create bed error:", error)
    return NextResponse.json(
      { 
        error: "Failed to create bed",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, 
      { status: 500 }
    )
  }
}
