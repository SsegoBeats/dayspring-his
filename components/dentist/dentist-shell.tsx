"use client"
import { useState } from "react"
import { Settings } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { DentistNotificationBell } from "@/components/dentist/dentist-notification-bell"
import { DentistOverview } from "@/components/dentist/dentist-overview"
import { DentistPatientRecords } from "@/components/dentist/dentist-patient-records"
import { DentistSchedule } from "@/components/dentist/dentist-schedule"
import { DentistClinicalActions } from "@/components/dentist/dentist-clinical-actions"
import { DentistExports } from "@/components/dentist/dentist-exports"

type Tab = "overview" | "patients" | "schedule" | "clinical" | "exports"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "patients", label: "Patients" },
  { id: "schedule", label: "Schedule" },
  { id: "clinical", label: "Clinical" },
  { id: "exports", label: "Exports" },
]

export function DentistShell() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [clinicalSection, setClinicalSection] = useState<"rx" | "lab" | "radiology" | null>("rx")

  function navigateTo(tab: string, section?: string) {
    setActiveTab(tab as Tab)
    if (tab === "clinical" && section) {
      setClinicalSection(section as "rx" | "lab" | "radiology")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Portal header strip */}
      <div className="bg-white border-b border-cyan-100 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Identity */}
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Dayspring HIS — Dental
              </p>
              {user && (
                <p className="text-xs text-cyan-600 dark:text-cyan-400">
                  {user.name} · Dental Surgeon
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <DentistNotificationBell />
              <Link href="/dentist/settings">
                <button
                  type="button"
                  aria-label="Settings"
                  className="rounded-lg p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors dark:text-slate-300 dark:hover:text-cyan-400 dark:hover:bg-slate-800"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm transition-colors border-b-2",
                  activeTab === tab.id
                    ? "border-cyan-600 text-cyan-700 font-semibold dark:text-cyan-300 dark:border-cyan-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:border-slate-700",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "overview" && (
          <DentistOverview onNavigate={navigateTo} />
        )}
        {activeTab === "patients" && (
          <DentistPatientRecords />
        )}
        {activeTab === "schedule" && (
          <DentistSchedule />
        )}
        {activeTab === "clinical" && (
          <DentistClinicalActions defaultSection={clinicalSection} />
        )}
        {activeTab === "exports" && (
          <DentistExports />
        )}
      </div>
    </div>
  )
}
