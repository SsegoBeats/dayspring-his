"use client"
import { useState } from "react"
import { Settings } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { MidwifeNotificationBell } from "@/components/midwife/midwife-notification-bell"
import { MidwifeOverview } from "@/components/midwife/midwife-overview"
import { MidwifePatientRecords } from "@/components/midwife/midwife-patient-records"
import { MidwifeANCVisits } from "@/components/midwife/midwife-anc-visits"
import { MidwifeLaborDelivery } from "@/components/midwife/midwife-labor-delivery"
import { MidwifeClinicalActions } from "@/components/midwife/midwife-clinical-actions"
import { MidwifeExports } from "@/components/midwife/midwife-exports"

type Tab = "overview" | "patients" | "anc" | "labor" | "clinical" | "exports"

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "patients", label: "Patients" },
  { id: "anc", label: "ANC Visits" },
  { id: "labor", label: "Labor & Delivery" },
  { id: "clinical", label: "Clinical" },
  { id: "exports", label: "Exports" },
]

export function MidwifeShell() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [ancOpenNew, setAncOpenNew] = useState(false)
  const [laborOpenNew, setLaborOpenNew] = useState(false)
  const [clinicalSection, setClinicalSection] = useState<"rx" | "lab" | "referral" | null>("rx")

  function navigateTo(tab: string, section?: string) {
    if (tab === "anc" && section === "new") {
      setAncOpenNew(true)
    } else {
      setAncOpenNew(false)
    }
    if (tab === "labor" && section === "new") {
      setLaborOpenNew(true)
    } else {
      setLaborOpenNew(false)
    }
    setActiveTab(tab as Tab)
    if (tab === "clinical" && section) {
      setClinicalSection(section as "rx" | "lab" | "referral")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal header */}
      <div className="bg-white border-b border-rose-100 shadow-sm shadow-rose-100/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Identity */}
            <div>
              <p className="text-sm font-bold text-slate-800">Dayspring HIS — Midwifery</p>
              {user && (
                <p className="text-xs text-rose-600">
                  {user.name} · Midwife
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <MidwifeNotificationBell />
              <Link href="/midwife/settings">
                <button
                  type="button"
                  aria-label="Settings"
                  className="rounded-lg p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </Link>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigateTo(tab.id)}
                className={cn(
                  "whitespace-nowrap px-4 py-3 text-sm transition-colors border-b-2 shrink-0",
                  activeTab === tab.id
                    ? "border-rose-600 text-rose-700 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200",
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
        {activeTab === "overview" && <MidwifeOverview onNavigate={navigateTo} />}
        {activeTab === "patients" && <MidwifePatientRecords />}
        {activeTab === "anc" && (
          <MidwifeANCVisits
            openNewOnMount={ancOpenNew}
            key={ancOpenNew ? "anc-new" : "anc"}
          />
        )}
        {activeTab === "labor" && (
          <MidwifeLaborDelivery
            openNewOnMount={laborOpenNew}
            key={laborOpenNew ? "labor-new" : "labor"}
          />
        )}
        {activeTab === "clinical" && <MidwifeClinicalActions defaultSection={clinicalSection} />}
        {activeTab === "exports" && <MidwifeExports />}
      </div>
    </div>
  )
}
