"use client"

import { SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Pill, Mail, Lock, User, Bell, Palette } from "lucide-react"

export default function PharmacistSettingsPage() {
  return (
    <SettingsLayout
      title="Pharmacist Settings"
      description="Manage your pharmacy account and medication preferences"
      icon={<Pill className="h-5 w-5" />}
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
