"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LabTechDashboard } from "@/components/dashboards/lab-tech-dashboard"
import { EmailVerificationModal } from "@/components/email-verification-modal"

/**
 * Lab Technician portal home. Renders the lab tech dashboard (test queue, results entry, exports).
 * Lab Techs can use /lab-tech as their canonical home; /dashboard also shows the same content.
 */
export default function LabTechPortalPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Lab Tech") {
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

  if (user.role !== "Lab Tech") {
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
        <LabTechDashboard />
      </DashboardLayout>
    </>
  )
}
