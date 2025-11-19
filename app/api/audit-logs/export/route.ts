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
  
  // Only Hospital Admin can export audit logs
  if (user.role !== "Hospital Admin") {
    return { error: "Insufficient permissions", status: 403 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await checkAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { search, category, action, startDate, endDate, format = 'csv' } = body

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

    // Get audit logs for export
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
    `

    const { rows } = await query(logsQuery, params)

    // Format the data for export
    const exportData = rows.map(row => ({
      timestamp: row.timestamp,
      userName: row.user_name || 'System',
      userRole: row.user_role || 'System',
      action: row.action,
      category: row.details?.category || 'SYSTEM',
      entityType: row.entity_type,
      entityId: row.entity_id,
      description: row.details?.description || `${row.action} ${row.entity_type}`,
      ipAddress: row.ip_address || '127.0.0.1'
    }))

    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`

    if (format === 'csv') {
      const csv = [
        "Timestamp,User,Role,Action,Category,Entity Type,Entity ID,Description,IP Address",
        ...exportData.map(log => 
          `"${log.timestamp}","${log.userName}","${log.userRole}","${log.action}","${log.category}","${log.entityType}","${log.entityId}","${log.description}","${log.ipAddress}"`
        )
      ].join("\n")

      const response = new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename=${filename}`,
          "Content-Length": csv.length.toString()
        }
      })
      return response
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 })

  } catch (error) {
    console.error("Error exporting audit logs:", error)
    return NextResponse.json({ error: "Failed to export audit logs" }, { status: 500 })
  }
}
