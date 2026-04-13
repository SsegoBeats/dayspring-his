import { NextRequest, NextResponse } from "next/server"
import { cleanupAuditLogs } from "@/lib/audit-cleanup"

// This endpoint can be called by a cron job or scheduled task
export async function POST(req: NextRequest) {
  try {
    // Verify this is a legitimate cleanup request
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.CLEANUP_TOKEN || 'audit-cleanup-token'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await cleanupAuditLogs()
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `Cleanup completed: ${result.deletedCount} records deleted`,
        deletedCount: result.deletedCount
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 })
    }
  } catch (error) {
    console.error("Cleanup endpoint error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Cleanup failed" 
    }, { status: 500 })
  }
}

// Manual cleanup endpoint for testing
export async function GET(req: NextRequest) {
  try {
    const result = await cleanupAuditLogs()
    
    return NextResponse.json({
      success: result.success,
      message: result.success ? 
        `Manual cleanup completed: ${result.deletedCount} records deleted` : 
        `Cleanup failed: ${result.error}`,
      deletedCount: result.deletedCount || 0
    })
  } catch (error) {
    console.error("Manual cleanup error:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Manual cleanup failed" 
    }, { status: 500 })
  }
}
