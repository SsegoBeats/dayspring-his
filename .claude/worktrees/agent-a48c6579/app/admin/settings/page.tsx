"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { OrgSettings } from "@/components/settings/org-settings"
import { Settings } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

function SettingsContent() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Show success message if redirected from email verification
    if (searchParams.get("emailVerified") === "true") {
      toast.success("Email verified successfully! Your email address has been updated.")
    }
  }, [searchParams])

  return (
    <SettingsLayout
      title="Admin Settings"
      description="Manage your administrator account settings and system preferences"
      icon={<Settings className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <OrgSettings />
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

export default function AdminSettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }

    const normalizedRole = (user.role || "").toLowerCase()
    if (normalizedRole !== "hospital admin" && normalizedRole !== "admin") {
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

  const normalizedRole = (user.role || "").toLowerCase()
  if (normalizedRole !== "hospital admin" && normalizedRole !== "admin") {
    return null
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
