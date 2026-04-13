"use client"

import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Scan } from "lucide-react"

export default function RadiologistSettingsPage() {
  return (
    <SettingsLayout
      title="Radiologist Settings"
      description="Manage your radiology account and imaging preferences"
      icon={<Scan className="h-5 w-5" />}
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
