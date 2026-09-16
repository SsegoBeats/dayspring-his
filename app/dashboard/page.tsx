"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Spinner } from "@/components/ui/spinner"

const ROLE_PORTAL_MAP: Record<string, string> = {
  "Hospital Admin": "/admin",
  "Receptionist": "/receptionist",
  "Clinician": "/clinician",
  "Nurse": "/nurse",
  "Midwife": "/midwife",
  "Dentist": "/dentist",
  "Radiologist": "/radiologist",
  "Lab Tech": "/lab-tech",
  "Pharmacist": "/pharmacist",
  "Cashier": "/cashier",
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      router.push("/")
      return
    }

    // ✅ NEW: Redirect to role-specific portal
    const portal = ROLE_PORTAL_MAP[user.role]
    if (portal) {
      router.push(portal)
    } else {
      // Fallback: if role doesn't have a mapped portal, stay on dashboard
      console.warn(`No portal mapped for role: ${user.role}`)
    }
  }, [user, isLoading, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <Spinner className="mx-auto h-8 w-8" />
        <p className="text-sm text-muted-foreground">Redirecting to your portal...</p>
      </div>
    </div>
  )
}
