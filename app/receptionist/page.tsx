"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ReceptionistDashboard } from "@/components/dashboards/receptionist-dashboard"
import { EmailVerificationModal } from "@/components/email-verification-modal"

export default function ReceptionistPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if ((user.role || "").toLowerCase() !== "receptionist") {
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

  if ((user.role || "").toLowerCase() !== "receptionist") {
    return null
  }

  return (
    <>
      <EmailVerificationModal
        isOpen={user.emailVerified === false}
        userName={user.name}
        userEmail={user.email}
      />
      <DashboardLayout>
        <ReceptionistDashboard />
      </DashboardLayout>
    </>
  )
}
