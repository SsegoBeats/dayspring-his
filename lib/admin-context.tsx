"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

export type UserRole =
  | "Receptionist"
  | "Doctor"
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

interface AdminContextType {
  users: SystemUser[]
  addUser: (user: Omit<SystemUser, "id" | "createdAt">) => void
  updateUser: (id: string, updates: Partial<SystemUser>) => void
  deleteUser: (id: string) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<SystemUser[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/admin/users", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          setUsers(
            (data.users || []).map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role || "Hospital Admin", // Keep database format
              status: u.status ? "active" : "inactive",
              createdAt: u.created_at,
              lastLogin: u.last_login || undefined,
            })),
          )
        }
      } catch {}
    })()
  }, [])

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
      // Refresh users list
      const me = await fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json())
      setUsers((me.users || []).map((u: any) => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        role: u.role || "Hospital Admin", 
        status: u.status ? "active" : "inactive", 
        createdAt: u.created_at, 
        lastLogin: u.last_login || undefined 
      })))
      return data
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to create user")
    }
  }

  const updateUser = async (id: string, updates: Partial<SystemUser>) => {
    const payload: any = { 
      // Don't allow changing name, email, or password through admin panel
      role: updates.role, 
      status: updates.status === "active" 
    }
    
    const res = await fetch(`/api/admin/users/${id}`, { 
      method: "PUT", 
      headers: { "Content-Type": "application/json" }, 
      credentials: "include", 
      body: JSON.stringify(payload) 
    })
    
    if (res.ok) {
      const me = await fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json())
      setUsers((me.users || []).map((u: any) => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        role: u.role || "Hospital Admin", 
        status: u.status ? "active" : "inactive", 
        createdAt: u.created_at, 
        lastLogin: u.last_login || undefined 
      })))
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to update user")
    }
  }

  const deleteUser = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      const me = await fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json())
      setUsers((me.users || []).map((u: any) => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        role: u.role || "Hospital Admin", 
        status: u.status ? "active" : "inactive", 
        createdAt: u.created_at, 
        lastLogin: u.last_login || undefined 
      })))
    } else {
      const error = await res.json()
      throw new Error(error.error || "Failed to delete user")
    }
  }

  return (
    <AdminContext.Provider value={{ users, addUser, updateUser, deleteUser }}>
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
