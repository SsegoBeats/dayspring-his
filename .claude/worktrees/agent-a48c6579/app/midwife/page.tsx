"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MidwifeDashboard } from "@/components/dashboards/midwife-dashboard"

export default function MidwifePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Midwife") {
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

  if (user.role !== "Midwife") {
    return null
  }

  return (
    <DashboardLayout>
      <MidwifeDashboard />
    </DashboardLayout>
  )
}
