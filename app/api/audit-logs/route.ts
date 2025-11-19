import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"

// Helper function to check authentication
async function checkAuth() {
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
  
  // Only Hospital Admin can access audit logs
  if (user.role !== "Hospital Admin") {
    return { error: "Insufficient permissions", status: 403 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

// Helper function for logging audit actions (allows any authenticated user)
async function checkAuthForLogging() {
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
  
  return { user: { id: payload.userId, role: user.role } }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await checkAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build the query with filters
    let whereConditions = []
    let params: any[] = []
    let paramIndex = 1

    if (search) {
      whereConditions.push(`(
        al.details->>'description' ILIKE $${paramIndex} OR
        u.name ILIKE $${paramIndex} OR
        al.entity_type ILIKE $${paramIndex}
      )`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (category) {
      whereConditions.push(`al.details->>'category' = $${paramIndex}`)
      params.push(category)
      paramIndex++
    }

    if (action) {
      whereConditions.push(`al.action = $${paramIndex}`)
      params.push(action)
      paramIndex++
    }

    if (startDate) {
      whereConditions.push(`al.created_at >= $${paramIndex}`)
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      whereConditions.push(`al.created_at <= $${paramIndex}`)
      params.push(endDate)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
    `
    const { rows: countRows } = await query(countQuery, params)
    const total = parseInt(countRows[0].total)

    // Get audit logs with user information
    const logsQuery = `
      SELECT 
        al.id,
        al.created_at as timestamp,
        al.user_id,
        u.name as user_name,
        u.role as user_role,
        al.action,
        al.entity_type,
        al.entity_id,
        al.details,
        al.ip_address
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const { rows } = await query(logsQuery, params)

    // Format the response
    const logs = rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      userId: row.user_id,
      userName: row.user_name || (row.user_id ? 'Unknown User' : 'System Process'),
      userRole: row.user_role || (row.user_id ? 'Unknown' : 'System'),
      action: row.action,
      category: row.details?.category || 'SYSTEM',
      entityType: row.entity_type,
      entityId: row.entity_id,
      description: row.details?.description || `${row.action} ${row.entity_type}`,
      ipAddress: row.ip_address || '127.0.0.1',
      changes: row.details?.changes || [],
      metadata: row.details?.metadata || {}
    }))

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await checkAuthForLogging()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { action, entityType, entityId, details, ipAddress } = body

    if (!action || !entityType) {
      return NextResponse.json({ error: "Action and entity type are required" }, { status: 400 })
    }

    // Insert audit log
    try {
      const { rows } = await query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `, [
        auth.user.id,
        action,
        entityType,
        entityId || null,
        JSON.stringify(details || {}),
        ipAddress || '127.0.0.1'
      ])

      return NextResponse.json({ 
        success: true, 
        id: rows[0].id,
        timestamp: rows[0].created_at
      })
    } catch (dbError) {
      console.error("Database error creating audit log:", dbError)
      return NextResponse.json({ 
        error: "Failed to create audit log", 
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Error creating audit log:", error)
    return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 })
  }
}
