"use client"

import { SettingsColumns, SettingsLayout } from "@/components/settings/settings-layout"
import { EmailSettings } from "@/components/settings/email-settings"
import { PasswordSettings } from "@/components/settings/password-settings"
import { ProfileSettings, NotificationSettings, PreferenceSettings } from "@/components/settings/preference-settings"
import { LabTechWorkflowSettings } from "@/components/settings/lab-tech-workflow-settings"
import { Microscope } from "lucide-react"

export default function LabTechSettingsPage() {
  return (
    <SettingsLayout
      title="Lab Technician Settings"
      description="Manage your laboratory account, workflow defaults, and testing preferences"
      icon={<Microscope className="h-5 w-5" />}
    >
      <SettingsColumns
        primary={
          <>
            <ProfileSettings />
            <LabTechWorkflowSettings />
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
