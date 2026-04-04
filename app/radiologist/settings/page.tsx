"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { RadiologistWorkflowSettings } from "@/components/settings/radiologist-workflow-settings"
import { Scan } from "lucide-react"

export default function RadiologistSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    if ((user.role || "").toLowerCase() !== "radiologist") {
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

  if ((user.role || "").toLowerCase() !== "radiologist") {
    return null
  }

  return (
    <SettingsLayout
      title="Radiologist Settings"
      description="Manage your radiology account, workflow defaults, and imaging preferences"
      icon={<Scan className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <RadiologistWorkflowSettings />
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
