import { NextRequest, NextResponse } from "next/server"
import { cleanupAuditLogs } from "@/lib/audit-cleanup"

// This endpoint is called by a cron job. Requires a secret Bearer token.
export async function POST(req: NextRequest) {
  try {
    const expectedToken = process.env.CLEANUP_TOKEN
    if (!expectedToken) {
      console.error("[audit-cleanup] CLEANUP_TOKEN environment variable is not set")
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
    }

    const authHeader = req.headers.get('authorization')
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
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (error) {
    console.error("Cleanup endpoint error:", error)
    return NextResponse.json({ success: false, error: "Cleanup failed" }, { status: 500 })
  }
}
