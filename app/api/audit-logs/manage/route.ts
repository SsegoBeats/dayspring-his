import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, can } from "@/lib/security"
import { query } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

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
  
  // Only Hospital Admin can manage audit logs
  if (user.role !== "Hospital Admin") {
    return { error: "Insufficient permissions", status: 403 }
  }
  
  return { user: { id: payload.userId, role: user.role } }
}

// Manual deletion of audit logs
export async function DELETE(req: NextRequest) {
  try {
    const auth = await checkAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')
    const deleteAll = searchParams.get('deleteAll') === 'true'

    let deleteQuery: string
    let params: any[] = []
    let description: string

    if (deleteAll) {
      deleteQuery = `DELETE FROM audit_logs`
      description = `All audit logs deleted`
    } else {
      deleteQuery = `DELETE FROM audit_logs WHERE created_at < NOW() - $1::interval`
      params = [`${days} days`]
      description = `Audit logs older than ${days} days deleted`
    }

    let rowCount = 0
    try {
      const result = await query(deleteQuery, params)
      rowCount = result.rowCount || 0
    } catch (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ 
        error: "Database operation failed", 
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 })
    }

    // Only log the deletion action if we're not deleting all logs
    // (since logging to a table we just cleared would fail)
    if (!deleteAll) {
      try {
        await writeAuditLog({
          userId: auth.user.id,
          action: "DELETE",
          entityType: "AuditLog",
          entityId: null, // Use null instead of "bulk-delete" since it's not a specific entity
          details: {
            category: "SYSTEM",
            description: `${description} - ${rowCount} records removed`,
            metadata: { days, deleteAll, recordsDeleted: rowCount }
          },
          ip: "127.0.0.1"
        })
      } catch (auditError) {
        console.error("Failed to record audit log for cleanup:", auditError)
        // Don't fail the entire operation if audit logging fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: rowCount,
      message: `${rowCount} audit log records deleted`
    })

  } catch (error) {
    console.error("Error deleting audit logs:", error)
    return NextResponse.json({ error: "Failed to delete audit logs" }, { status: 500 })
  }
}

// Get audit log statistics
export async function GET(req: NextRequest) {
  try {
    const auth = await checkAuth()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Get statistics
    const { rows: stats } = await query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as logs_last_7_days,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as logs_last_30_days,
        COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days') as logs_older_than_30_days,
        MIN(created_at) as oldest_log,
        MAX(created_at) as newest_log
      FROM audit_logs
    `)

    const { rows: actionStats } = await query(`
      SELECT 
        action,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY action
      ORDER BY count DESC
    `)

    const { rows: categoryStats } = await query(`
      SELECT 
        details->>'category' as category,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND details->>'category' IS NOT NULL
      GROUP BY details->>'category'
      ORDER BY count DESC
    `)

    return NextResponse.json({
      statistics: stats[0],
      actionBreakdown: actionStats,
      categoryBreakdown: categoryStats
    })

  } catch (error) {
    console.error("Error fetching audit log statistics:", error)
    return NextResponse.json({ error: "Failed to fetch audit log statistics" }, { status: 500 })
  }
}
