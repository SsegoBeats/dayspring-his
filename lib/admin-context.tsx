"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/security"

export type UserRole =
  | "Receptionist"
  | "Clinician"
  | "Radiologist"
  | "Nurse"
  | "Lab Tech"
  | "Hospital Admin"
  | "Cashier"
  | "Pharmacist"
  | "Midwife"
  | "Dentist"

export interface SystemUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: "active" | "inactive"
  createdAt: string
  lastLogin?: string
}

export interface UserSummary {
  total: number
  active: number
  inactive: number
  byRole: Record<string, number>
}

export interface FetchUsersOptions {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  status?: string
  createdAfter?: string
  createdBefore?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

interface AdminContextType {
  users: SystemUser[]
  total: number
  summary: UserSummary | null
  loading: boolean
  fetchUsers: (opts?: FetchUsersOptions) => Promise<{ users: SystemUser[]; total: number }>
  fetchSummary: () => Promise<UserSummary | null>
  addUser: (user: Omit<SystemUser, "id" | "createdAt">) => Promise<any>
  updateUser: (id: string, updates: Partial<SystemUser>) => Promise<void>
  deleteUser: (id: string) => Promise<void>
}

const mapUser = (u: any): SystemUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role || "Hospital Admin",
  status: u.status ? "active" : "inactive",
  createdAt: u.created_at,
  lastLogin: u.last_login || undefined,
})

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<UserSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSummary = useCallback(async (): Promise<UserSummary | null> => {
    try {
      const res = await fetch("/api/admin/users?summary=1", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        const s = data.summary || { total: 0, active: 0, inactive: 0, byRole: {} }
        setSummary(s)
        return s
      }
      return null
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.warn("[AdminContext] fetchSummary:", err)
      return null
    }
  }, [])

  const fetchUsers = useCallback(async (opts: FetchUsersOptions = {}): Promise<{ users: SystemUser[]; total: number }> => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(opts.page ?? 1))
      params.set("pageSize", String(opts.pageSize ?? 20))
      if (opts.search) params.set("q", opts.search)
      if (opts.role) params.set("role", opts.role)
      if (opts.status) params.set("status", opts.status)
      if (opts.createdAfter) params.set("createdAfter", opts.createdAfter)
      if (opts.createdBefore) params.set("createdBefore", opts.createdBefore)
      if (opts.sortBy) params.set("sortBy", opts.sortBy)
      if (opts.sortOrder) params.set("sortOrder", opts.sortOrder)

      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        const list = (data.users || []).map(mapUser)
        setUsers(list)
        setTotal(data.total ?? 0)
        return { users: list, total: data.total ?? 0 }
      }
      if (res.status === 401 || res.status === 403) {
        setUsers([])
        setTotal(0)
        return { users: [], total: 0 }
      }
      return { users: [], total: 0 }
    } catch (err) {
      if (process.env.NODE_ENV === "development") console.warn("[AdminContext] fetchUsers:", err)
      setUsers([])
      setTotal(0)
      return { users: [], total: 0 }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user || !can(user.role, "users", "read")) return
    void fetchSummary()
  }, [user, fetchSummary])

  const addUser = async (user: Omit<SystemUser, "id" | "createdAt">) => {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ 
        name: user.name, 
        email: user.email, 
        password: (user as any).password, // Use user-provided password
        role: user.role 
      }),
    })
    if (res.ok) {
      const data = await res.json()
      await fetchSummary()
      return data
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to create user")
    }
  }

  const updateUser = async (id: string, updates: Partial<SystemUser>) => {
    const payload: Record<string, unknown> = {}
    // Don't allow changing name, email, or password through admin panel
    if (updates.role !== undefined) payload.role = updates.role
    if (updates.status !== undefined) payload.status = updates.status === "active"
    
    const res = await fetch(`/api/admin/users/${id}`, { 
      method: "PUT", 
      headers: { "Content-Type": "application/json" }, 
      credentials: "include", 
      body: JSON.stringify(payload) 
    })
    
    if (res.ok) {
      await fetchSummary()
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to update user")
    }
  }

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      await fetchSummary()
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to delete user")
    }
  }

  return (
    <AdminContext.Provider value={{ users, total, summary, loading, fetchUsers, fetchSummary, addUser, updateUser, deleteUser }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}
