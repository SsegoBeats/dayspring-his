"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Stethoscope } from "lucide-react"

export default function DentistSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    if ((user.role || "").toLowerCase() !== "dentist") {
      router.replace("/settings")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  if ((user.role || "").toLowerCase() !== "dentist") {
    return null
  }

  return (
    <SettingsLayout
      title="Dentist Settings"
      description="Manage your dental practice settings and patient care preferences"
      icon={<Stethoscope className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <PreferenceSettings />
          </>
        }
        secondary={
          <>
            <EmailSettings />
            <PasswordSettings />
            <NotificationSettings />
          </>
        }
      />
    </SettingsLayout>
  )
}
