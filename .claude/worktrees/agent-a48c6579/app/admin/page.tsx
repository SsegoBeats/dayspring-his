"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"

export default function AdminPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    const role = (user.role || "").toLowerCase()
    if (role !== "hospital admin" && role !== "admin") {
      router.push("/dashboard")
      return
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const role = (user.role || "").toLowerCase()
  if (role !== "hospital admin" && role !== "admin") {
    return null
  }

  return (
    <DashboardLayout>
      <AdminDashboard />
    </DashboardLayout>
  )
}
