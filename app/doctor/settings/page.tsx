"use client"

import { SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Stethoscope, Mail, Lock, User, Bell, Palette } from "lucide-react"

export default function DoctorSettingsPage() {
  return (
    <SettingsLayout
      title="Doctor Settings"
      description="Manage your medical practice settings and patient care preferences"
      icon={<Stethoscope className="h-5 w-5" />}
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
