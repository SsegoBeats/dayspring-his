"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { CashierDashboard } from "@/components/dashboards/cashier-dashboard"
import { EmailVerificationModal } from "@/components/email-verification-modal"

export default function CashierPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const isCashier = (user?.role || "").toLowerCase() === "cashier"

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (!isCashier) {
      router.push("/dashboard")
      return
    }
  }, [user, isCashier, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isCashier) {
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
        <CashierDashboard />
      </DashboardLayout>
    </>
  )
}
