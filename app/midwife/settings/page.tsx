"use client"

import { SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { HeartHandshake } from "lucide-react"

export default function MidwifeSettingsPage() {
  return (
    <SettingsLayout
      title="Midwifery Settings"
      description="Manage your midwifery practice settings and patient care preferences"
      icon={<HeartHandshake className="h-5 w-5" />}
    >
      <div className="space-y-6">
        <ProfileSettings />
        <EmailSettings />
        <PasswordSettings />
        <NotificationSettings />
        <PreferenceSettings />
      </div>
    </SettingsLayout>
  )
}

