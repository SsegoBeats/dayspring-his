"use client"

import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { PharmacyPreferencesSettings } from "@/components/pharmacy/pharmacy-preferences-settings"
import { Pill } from "lucide-react"

export default function PharmacistSettingsPage() {
  return (
    <SettingsLayout
      title="Pharmacist Settings"
      description="Manage your pharmacy account and medication preferences"
      icon={<Pill className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <PreferenceSettings />
            <PharmacyPreferencesSettings />
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
