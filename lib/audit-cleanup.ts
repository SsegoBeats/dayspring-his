import { query } from "@/lib/db"

// Automatic audit log cleanup - removes logs older than 30 days
export async function cleanupAuditLogs() {
  try {
    
    // Delete logs older than 30 days
    const result = await query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`
    )
    const rowCount = (result as any).rowCount || 0

    
    // Don't log cleanup actions to avoid cluttering the audit log
    // The cleanup itself is a system maintenance task, not a user action
    
    return { success: true, deletedCount: rowCount as number }
  } catch (error) {
    console.error("Error during audit log cleanup:", error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Manual cleanup function for testing
export async function manualCleanup() {
  return await cleanupAuditLogs()
}
