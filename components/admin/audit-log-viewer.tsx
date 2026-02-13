"use client"

import { useState, useEffect, useCallback } from "react"
import { useAudit, type AuditAction, type AuditCategory } from "@/lib/audit-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Search, RefreshCw, AlertCircle, Loader2, Trash2, Settings, BarChart3, Eye, CheckCircle2, LogOut, AlertTriangle, ShieldCheck, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { format } from "date-fns"
import { toast } from "sonner"

export function AuditLogViewer() {
  const { logs, loading, error, getLogs, exportLogs, refreshLogs } = useAudit()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "ALL">("ALL")
  const [actionFilter, setActionFilter] = useState<AuditAction | "ALL">("ALL")
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("week")
  const [showManagement, setShowManagement] = useState(false)
  const [cleanupDays, setCleanupDays] = useState(30)
  const [managementLoading, setManagementLoading] = useState(false)
  const [filteredLogs, setFilteredLogs] = useState(logs)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogs, setTotalLogs] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const limit = 50

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      applyFilters(currentPage).catch(() => {})
    }, 60000)
    return () => clearInterval(id)
  }, [autoRefresh, currentPage, applyFilters])

  const handleCleanup = async (days: number) => {
    try {
      setManagementLoading(true)
      const response = await fetch(`/api/audit-logs/manage?days=${days}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to cleanup audit logs (${response.status})`)
      }

      const result = await response.json()

      // Refresh the logs
      await applyFilters(1)
      
      // Small delay to ensure UI has updated
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Show success message after data refresh
      toast.success(`${result.deletedCount} audit logs older than ${days} days have been deleted`)
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("Error cleaning up logs:", err)
      toast.error("Failed to cleanup audit logs")
    } finally {
      setManagementLoading(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL audit logs? This action cannot be undone.')) {
      return
    }

    try {
      setManagementLoading(true)
      const response = await fetch('/api/audit-logs/manage?deleteAll=true', {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Failed to delete all audit logs (${response.status})`)
      }

      const result = await response.json()
      console.log('Delete all result:', result)
      
      // Refresh the logs
      await applyFilters(1)
      
      // Small delay to ensure UI has updated
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Show success message after data refresh
      toast.success(`All ${result.deletedCount} audit logs have been deleted`)
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("Error deleting all logs:", err)
      toast.error("Failed to delete all audit logs")
    } finally {
      setManagementLoading(false)
    }
  }

  const getDateFilter = useCallback(() => {
    const now = new Date()
    const endOfToday = new Date(now)
    endOfToday.setHours(23, 59, 59, 999)
    switch (dateRange) {
      case "today": {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        return { startDate: start, endDate: endOfToday }
      }
      case "week": {
        const start = new Date(now)
        start.setDate(start.getDate() - 7)
        return { startDate: start, endDate: new Date(now) }
      }
      case "month": {
        const start = new Date(now)
        start.setDate(start.getDate() - 30)
        return { startDate: start, endDate: new Date(now) }
      }
      default:
        return {}
    }
  }, [dateRange])

  const applyFilters = useCallback(async (page: number) => {
    try {
      const filterParams = {
        search: search || undefined,
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        ...getDateFilter(),
        page,
        limit,
      }
      
      const result = await getLogs(filterParams)
      setFilteredLogs(result.logs)
      setTotalLogs(result.total)
      setTotalPages(result.totalPages)
      setCurrentPage(result.page)
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("Error applying filters:", err)
      toast.error("Failed to apply filters")
    }
  }, [search, categoryFilter, actionFilter, getDateFilter, getLogs, limit])

  const handleExport = async () => {
    try {
      const filters = {
        search: search || undefined,
        category: categoryFilter !== "ALL" ? categoryFilter : undefined,
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        ...getDateFilter(),
      }
      
      await exportLogs(filters)
      toast.success("Audit logs exported successfully")
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("Error exporting logs:", err)
      toast.error("Failed to export audit logs")
    }
  }

  const handleRefresh = useCallback(async () => {
    try {
      await applyFilters(currentPage)
      toast.success("Audit logs refreshed successfully")
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.error("Error refreshing logs:", err)
      toast.error("Failed to refresh audit logs")
    }
  }, [applyFilters, currentPage])

  useEffect(() => {
    setCurrentPage(1)
    applyFilters(1)
  }, [search, categoryFilter, actionFilter, dateRange, applyFilters])

  useEffect(() => {
    setFilteredLogs(logs)
  }, [logs])

  const activeFilterCount = [
    search ? 1 : 0,
    categoryFilter !== 'ALL' ? 1 : 0,
    actionFilter !== 'ALL' ? 1 : 0,
    dateRange !== 'week' ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const getActionColor = (action: AuditAction) => {
    switch (action) {
      case "CREATE":
        return "bg-green-500"
      case "UPDATE":
        return "bg-blue-500"
      case "DELETE":
        return "bg-red-500"
      case "LOGIN":
        return "bg-emerald-500"
      case "LOGOUT":
        return "bg-gray-500"
      case "LOGIN_FAILED":
        return "bg-red-600"
      case "APPROVE":
        return "bg-green-600"
      case "REJECT":
        return "bg-orange-500"
      case "EXPORT":
        return "bg-purple-500"
      default:
        return "bg-gray-400"
    }
  }

  const getCategoryColor = (category: AuditCategory) => {
    switch (category) {
      case "AUTHENTICATION":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
      case "PATIENT":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      case "APPOINTMENT":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
      case "BILLING":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300"
      case "USER_MANAGEMENT":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      case "SYSTEM":
        return "bg-muted text-foreground"
      default:
        return "bg-muted text-foreground"
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const failedLogins = filteredLogs.filter((l:any) => l.action === 'LOGIN_FAILED').length
  const deletions = filteredLogs.filter((l:any) => l.action === 'DELETE').length
  const userMgmt = filteredLogs.filter((l:any) => l.category === 'USER_MANAGEMENT').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Audit Trail</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {filteredLogs.length} logs
            </Badge>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              <span>Auto-refresh</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setAutoRefresh((v) => !v)}
              >
                {autoRefresh ? 'On' : 'Off'}
              </Button>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManagement(!showManagement)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 flex flex-wrap items-center gap-3 text-xs">
          {failedLogins > 0 || deletions > 0 || userMgmt > 0 ? (
            <>
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Anomalies snapshot
              </span>
              <span className="inline-flex items-center gap-1">
                Failed logins: <span className="font-semibold text-amber-700">{failedLogins}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                User management events: <span className="font-semibold text-sky-700">{userMgmt}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                Deletions: <span className="font-semibold text-rose-700">{deletions}</span>
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              No unusual activity detected for the selected period.
            </span>
          )}
        </div>
        {showManagement && (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-5 w-5" />
              <h3 className="font-semibold">Audit Log Management</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="cleanup-days" className="text-sm font-medium">
                    Delete logs older than:
                  </label>
                  <Select value={cleanupDays.toString()} onValueChange={(v) => setCleanupDays(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCleanup(cleanupDays)}
                  disabled={managementLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {managementLoading ? "Cleaning..." : "Cleanup"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={managementLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {managementLoading ? "Deleting..." : "Delete All Logs"}
                </Button>
                <span className="text-sm text-muted-foreground">This will permanently delete all audit logs</span>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="audit-search"
                name="audit-search"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
              <SelectItem value="PATIENT">Patient</SelectItem>
              <SelectItem value="APPOINTMENT">Appointment</SelectItem>
              <SelectItem value="CONSULTATION">Consultation</SelectItem>
              <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
              <SelectItem value="LAB_TEST">Lab Test</SelectItem>
              <SelectItem value="RADIOLOGY">Radiology</SelectItem>
              <SelectItem value="BILLING">Billing</SelectItem>
              <SelectItem value="PAYMENT">Payment</SelectItem>
              <SelectItem value="PHARMACY">Pharmacy</SelectItem>
              <SelectItem value="NURSING">Nursing</SelectItem>
              <SelectItem value="USER_MANAGEMENT">User Management</SelectItem>
              <SelectItem value="SYSTEM">System</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="VIEW">View</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
              <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
              <SelectItem value="EXPORT">Export</SelectItem>
              <SelectItem value="APPROVE">Approve</SelectItem>
              <SelectItem value="REJECT">Reject</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] ml-auto">
              {search && (
                <button type="button" className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5" onClick={() => setSearch("")}>
                  <span className="font-medium">Search:</span>
                  <span>{search}</span>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {categoryFilter !== 'ALL' && (
                <button type="button" className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5" onClick={() => setCategoryFilter('ALL')}>
                  <span className="font-medium">Category:</span>
                  <span>{categoryFilter}</span>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {actionFilter !== 'ALL' && (
                <button type="button" className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5" onClick={() => setActionFilter('ALL')}>
                  <span className="font-medium">Action:</span>
                  <span>{actionFilter}</span>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              {dateRange !== 'week' && (
                <button type="button" className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5" onClick={() => setDateRange('week')}>
                  <span className="font-medium">Range:</span>
                  <span>{dateRange}</span>
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
              <span className="text-muted-foreground">{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>

        <div className="rounded-md border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading audit logs...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log, idx) => (
                  <TableRow key={log.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <TableCell className="text-sm" title={format(log.timestamp, "MMM dd, yyyy HH:mm:ss")}>{format(log.timestamp, "dd MMM yyyy HH:mm:ss")}</TableCell>
                    <TableCell className="font-medium">{log.userName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.userRole}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getActionColor(log.action)} text-white flex items-center gap-1 text-[11px]`}>
                        {log.action === 'LOGIN' && <CheckCircle2 className="h-3 w-3" />}
                        {log.action === 'LOGOUT' && <LogOut className="h-3 w-3" />}
                        {log.action === 'LOGIN_FAILED' && <AlertTriangle className="h-3 w-3" />}
                        {log.action === 'DELETE' && <Trash2 className="h-3 w-3" />}
                        <span>{log.action}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryColor(log.category)}>{log.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate" title={log.description}>{log.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.ipAddress}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSelectedLog(log); setDetailsOpen(true) }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Timestamp:</span> {format(selectedLog.timestamp, "MMM dd, yyyy HH:mm:ss")}</div>
                  <div><span className="text-muted-foreground">User:</span> {selectedLog.userName} ({selectedLog.userRole})</div>
                  <div><span className="text-muted-foreground">Action:</span> {selectedLog.action}</div>
                  <div><span className="text-muted-foreground">Category:</span> {selectedLog.category}</div>
                  <div><span className="text-muted-foreground">Entity:</span> {selectedLog.entityType}{selectedLog.entityId ? ` (${selectedLog.entityId})` : ''}</div>
                  <div><span className="text-muted-foreground">IP:</span> {selectedLog.ipAddress}</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Description</div>
                  <div className="rounded bg-muted p-2 whitespace-pre-wrap">{selectedLog.description}</div>
                </div>
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <div className="font-medium mb-1">Metadata</div>
                    <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-64">
{JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <div>
                    <div className="font-medium mb-1">Changes</div>
                    <pre className="rounded bg-muted p-3 text-xs overflow-auto max-h-64">
{JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <div>
            Showing {filteredLogs.length} of {totalLogs} log{totalLogs !== 1 ? "s" : ""}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyFilters(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1 || loading}
              >
                Previous
              </Button>
              <span className="text-xs">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyFilters(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          )}
          <div className="text-xs">
            Last updated: {logs.length > 0 ? format(logs[0]?.timestamp || new Date(), "MMM dd, yyyy HH:mm:ss") : "Never"}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}



