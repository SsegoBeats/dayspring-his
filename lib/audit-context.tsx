"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useAuth } from "./auth-context"

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "EXPORT"
  | "PRINT"
  | "APPROVE"
  | "REJECT"
  | "DISPENSE"
  | "CANCEL"

export type AuditCategory =
  | "AUTHENTICATION"
  | "PATIENT"
  | "APPOINTMENT"
  | "CONSULTATION"
  | "PRESCRIPTION"
  | "LAB_TEST"
  | "RADIOLOGY"
  | "BILLING"
  | "PAYMENT"
  | "PHARMACY"
  | "NURSING"
  | "USER_MANAGEMENT"
  | "SYSTEM"

export interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  userName: string
  userRole: string
  action: AuditAction
  category: AuditCategory
  entityType: string
  entityId: string
  description: string
  ipAddress?: string
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  metadata?: Record<string, any>
}

interface AuditContextType {
  logs: AuditLog[]
  loading: boolean
  error: string | null
  logAction: (
    action: AuditAction,
    category: AuditCategory,
    entityType: string,
    entityId: string,
    description: string,
    changes?: { field: string; oldValue: any; newValue: any }[],
    metadata?: Record<string, any>,
  ) => Promise<void>
  getLogs: (filters?: {
    userId?: string
    category?: AuditCategory
    action?: AuditAction
    startDate?: Date
    endDate?: Date
    search?: string
  }) => Promise<AuditLog[]>
  exportLogs: (filters?: any) => Promise<void>
  refreshLogs: () => Promise<void>
}

const AuditContext = createContext<AuditContextType | undefined>(undefined)

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = async (filters?: {
    userId?: string
    category?: AuditCategory
    action?: AuditAction
    startDate?: Date
    endDate?: Date
    search?: string
  }) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (filters?.search) params.append('search', filters.search)
      if (filters?.category) params.append('category', filters.category)
      if (filters?.action) params.append('action', filters.action)
      if (filters?.startDate) params.append('startDate', filters.startDate.toISOString())
      if (filters?.endDate) params.append('endDate', filters.endDate.toISOString())

      const response = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch audit logs')
      }

      const data = await response.json()
      const formattedLogs = data.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }))
      
      setLogs(formattedLogs)
      return formattedLogs
    } catch (err) {
      console.error('Error fetching audit logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
      return []
    } finally {
      setLoading(false)
    }
  }

  const logAction = async (
    action: AuditAction,
    category: AuditCategory,
    entityType: string,
    entityId: string | null,
    description: string,
    changes?: { field: string; oldValue: any; newValue: any }[],
    metadata?: Record<string, any>,
  ) => {
    // Log audit actions silently - don't block or throw errors
    // This ensures the main functionality continues even if audit logging fails
    try {
      const response = await fetch('/api/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action,
          entityType,
          entityId,
          details: {
            category,
            description,
            changes,
            metadata
          },
          ipAddress: '127.0.0.1' // In production, get real IP
        })
      })

      if (!response.ok) {
        // Silently fail - don't log errors for audit logging failures
        // This prevents error spam and ensures main functionality isn't affected
        return
      }
    } catch (err) {
      // Silently fail - audit logging should never break main functionality
      return
    }
  }

  const getLogs = async (filters?: {
    userId?: string
    category?: AuditCategory
    action?: AuditAction
    startDate?: Date
    endDate?: Date
    search?: string
  }) => {
    return await fetchLogs(filters)
  }

  const exportLogs = async (filters?: any) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/audit-logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...filters,
          format: 'csv'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to export audit logs')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      // Log the export action
      await logAction("EXPORT", "SYSTEM", "AuditLog", null, `Exported audit logs with filters: ${JSON.stringify(filters)}`)
    } catch (err) {
      console.error('Error exporting audit logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to export audit logs')
    } finally {
      setLoading(false)
    }
  }

  const refreshLogs = async () => {
    await fetchLogs()
  }

  useEffect(() => {
    const handleAuditLog = (event: any) => {
      const { action, category, entityType, entityId, description, changes, metadata } = event.detail
      logAction(action, category, entityType, entityId, description, changes, metadata)
    }

    window.addEventListener("audit-log", handleAuditLog)
    return () => window.removeEventListener("audit-log", handleAuditLog)
  }, [user])

  return <AuditContext.Provider value={{ logs, loading, error, logAction, getLogs, exportLogs, refreshLogs }}>{children}</AuditContext.Provider>
}

export function useAudit() {
  const context = useContext(AuditContext)
  if (!context) {
    throw new Error("useAudit must be used within AuditProvider")
  }
  return context
}
