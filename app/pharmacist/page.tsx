"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PharmacistDashboard } from "@/components/dashboards/pharmacist-dashboard"

export default function PharmacistPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Pharmacist") {
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

  if (user.role !== "Pharmacist") {
    return null
  }

  return (
    <DashboardLayout>
      <PharmacistDashboard />
    </DashboardLayout>
  )
}
