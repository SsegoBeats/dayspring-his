"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    
    if (!user) {
      router.push("/")
      return
    }

    // Redirect to portal-specific settings based on user role
    const roleRoutes: Record<string, string> = {
      "Hospital Admin": "/admin/settings",
      "Receptionist": "/receptionist/settings", 
      "Doctor": "/doctor/settings",
      "Midwife": "/midwife/settings",
      "Dentist": "/dentist/settings",
      "Clinician": "/doctor/settings",
      "Nurse": "/nurse/settings",
      "Lab Tech": "/lab-tech/settings",
      "Radiologist": "/radiologist/settings",
      "Pharmacist": "/pharmacist/settings",
      "Cashier": "/cashier/settings"
    }

    const settingsRoute = roleRoutes[user.role]
    if (settingsRoute) {
      router.replace(settingsRoute)
    } else {
      // Fallback to admin settings for unknown roles
      router.replace("/admin/settings")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Redirecting to your settings...</div>
    </div>
  )
}
