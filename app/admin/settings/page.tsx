"use client"

import { useEffect, Suspense } from "react"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { OrgSettings } from "@/components/settings/org-settings"
import { Settings, Mail, Lock, User, Bell, Palette } from "lucide-react"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"

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
      <div className="space-y-6">
        <OrgSettings />
        <ProfileSettings />
        <EmailSettings />
        <PasswordSettings />
        <NotificationSettings />
        <PreferenceSettings />
      </div>
    </SettingsLayout>
  )
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
