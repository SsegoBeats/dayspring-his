"use client"

import type { ReactNode } from "react"
import { AuditProvider } from "@/lib/audit-context"
import { PatientProvider } from "@/lib/patient-context"
import { MedicalProvider } from "@/lib/medical-context"
import { LabProvider } from "@/lib/lab-context"
import { PharmacyProvider } from "@/lib/pharmacy-context"
import { BillingProvider } from "@/lib/billing-context"
import { NursingProvider } from "@/lib/nursing-context"
import { AdminProvider } from "@/lib/admin-context"
import { AnalyticsProvider } from "@/lib/analytics-context"
import { useAuth } from "@/lib/auth-context"

export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <>{children}</>
  return (
    <AuditProvider>
      <PatientProvider>
        <MedicalProvider>
          <LabProvider>
          <PharmacyProvider>
            <BillingProvider>
              <AnalyticsProvider>
                <NursingProvider>
                  <AdminProvider>{children}</AdminProvider>
                </NursingProvider>
              </AnalyticsProvider>
            </BillingProvider>
          </PharmacyProvider>
          </LabProvider>
        </MedicalProvider>
      </PatientProvider>
    </AuditProvider>
  )
}
