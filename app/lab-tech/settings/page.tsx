"use client"

import { SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { Microscope, Mail, Lock, User, Bell, Palette } from "lucide-react"

export default function LabTechSettingsPage() {
  return (
    <SettingsLayout
      title="Lab Technician Settings"
      description="Manage your laboratory account and testing preferences"
      icon={<Microscope className="h-5 w-5" />}
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
