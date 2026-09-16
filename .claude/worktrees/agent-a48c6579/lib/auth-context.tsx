"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

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

export interface User {
  id: string
  name: string
  role: UserRole
  email: string
  emailVerified?: boolean
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshUser: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.status === 401 || res.status === 403) {
        setUser(null)
        return
      }
      if (!res.ok) return
      const data = await res.json()
      if (data?.user) {
        setUser({
          ...data.user,
          emailVerified: !!data.user.email_verified_at,
        })
      } else {
        setUser(null)
      }
    } catch {
      // Preserve the current auth state on transient failures.
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      await refreshUser()
      setIsLoading(false)
    })()
  }, [refreshUser])

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
        await refreshUser()
        if (typeof window !== "undefined" && !document.cookie.match(/(?:^|;\s)(session=|session_dev=)/)) {
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

  return <AuthContext.Provider value={{ user, login, logout, refreshUser, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
