"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { UserCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

function ReceptionistSettingsContent() {
  return (
    <SettingsLayout
      title="Receptionist Settings"
      description="Manage your receptionist account and patient management preferences"
      icon={<UserCheck className="h-5 w-5" />}
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

export default function ReceptionistSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }

    if ((user.role || "").toLowerCase() !== "receptionist") {
      router.replace("/settings")
    }
  }, [isLoading, router, user])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  if ((user.role || "").toLowerCase() !== "receptionist") {
    return null
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading settings...</div>}>
      <ReceptionistSettingsContent />
    </Suspense>
  )
}
