"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

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

interface User {
  id: string
  name: string
  role: UserRole
  email: string
  emailVerified?: boolean
}

export interface SystemUser {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  status: "active" | "inactive"
  createdAt: string
  lastLogin?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEFAULT_ADMIN: SystemUser = {
  id: "admin-default",
  name: "System Administrator",
  email: "admin@dayspring.com",
  password: "Admin@123",
  role: "admin",
  status: "active",
  createdAt: new Date().toISOString(),
}

const initializeSystemUsers = () => {
  // Legacy no-op retained to avoid breaking initial render paths
  return [DEFAULT_ADMIN]
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    initializeSystemUsers()
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (res.ok) {
          const data = await res.json()
          if (data?.user) {
            setUser({
              ...data.user,
              emailVerified: !!data.user.email_verified_at,
            })
          }
        }
      } catch {}
      setIsLoading(false)
    })()
  }, [])

  const login = async (email: string, password: string, role: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // Handle specific error cases with detailed messages
        if (data.code === "ACCOUNT_INACTIVE") {
          return { success: false, error: data.message || data.error }
        }
        return { success: false, error: data.error || "Login failed" }
      }
      const data = await res.json()
      setUser({
        ...data,
        emailVerified: !!data.emailVerified
      })
      // As a last resort in dev, attach token to subsequent requests
      if (process.env.NODE_ENV !== "production" && data?.token) {
        try {
          localStorage.setItem("session_dev_bearer", data.token)
          // also set a non-HttpOnly cookie so fetch() immediately includes it
          const maxAge = 60 * 60 * 8
          document.cookie = `session_dev=${data.token}; Path=/; Max-Age=${maxAge}`
        } catch {}
      }
      // Ensure browser stores cookie before providers fire requests
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" })
        if (me.ok) {
          const m = await me.json()
          if (m?.user) setUser(m.user)
        } else if (typeof window !== "undefined") {
          // Fallback: force a full navigation so Set-Cookie is applied
          window.location.href = "/dashboard"
        }
      } catch {}
      if (typeof window !== "undefined") {
        const event = new CustomEvent("audit-log", {
          detail: {
            action: "LOGIN",
            category: "AUTHENTICATION",
            entityType: "User",
            entityId: data.id,
            description: `User ${data.name} logged in as ${data.role}`,
          },
        })
        window.dispatchEvent(event)
      }
      return { success: true }
    } catch {
      return { success: false, error: "An error occurred" }
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {}
    if (user && typeof window !== "undefined") {
      const event = new CustomEvent("audit-log", {
        detail: {
          action: "LOGOUT",
          category: "AUTHENTICATION",
          entityType: "User",
          entityId: user.id,
          description: `User ${user.name} logged out`,
        },
      })
      window.dispatchEvent(event)
    }
    // Clear any locally persisted user-specific UI state
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("theme")
        localStorage.removeItem("lastThemeUser")
      }
    } catch {}
    setUser(null)
    // Navigate back to sign-in to ensure a clean session
    try { if (typeof window !== "undefined") window.location.href = "/" } catch {}
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

