import { query } from "@/lib/db"

// Automatic audit log cleanup - removes logs older than 30 days
export async function cleanupAuditLogs() {
  try {
    console.log("Starting automatic audit log cleanup...")
    
    // Delete logs older than 30 days
    const { rowCount } = await query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'`
    )
    
    console.log(`Audit log cleanup completed: ${rowCount} records deleted`)
    
    // Don't log cleanup actions to avoid cluttering the audit log
    // The cleanup itself is a system maintenance task, not a user action
    
    return { success: true, deletedCount: rowCount }
  } catch (error) {
    console.error("Error during audit log cleanup:", error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Manual cleanup function for testing
export async function manualCleanup() {
  return await cleanupAuditLogs()
}
