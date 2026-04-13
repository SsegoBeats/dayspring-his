"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NurseDashboard } from "@/components/dashboards/nurse-dashboard"
import { EmailVerificationModal } from "@/components/email-verification-modal"

/**
 * Nurse portal home. Renders the nurse dashboard (patient vitals, nursing notes, triage).
 * Nurses can use /nurse as their canonical home; /dashboard also shows the same content.
 */
export default function NursePortalPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Nurse") {
      router.replace("/dashboard")
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

  if (user.role !== "Nurse") {
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
        <NurseDashboard />
      </DashboardLayout>
    </>
  )
}
