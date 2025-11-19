"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ReceptionistDashboard } from "@/components/dashboards/receptionist-dashboard"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { MidwifeDashboard } from "@/components/dashboards/midwife-dashboard"
import { DentistDashboard } from "@/components/dashboards/dentist-dashboard"
import { RadiologistDashboard } from "@/components/dashboards/radiologist-dashboard"
import { NurseDashboard } from "@/components/dashboards/nurse-dashboard"
import { LabTechDashboard } from "@/components/dashboards/lab-tech-dashboard"
import { AdminDashboard } from "@/components/dashboards/admin-dashboard"
import { CashierDashboard } from "@/components/dashboards/cashier-dashboard"
import { PharmacistDashboard } from "@/components/dashboards/pharmacist-dashboard"
import { EmailVerificationModal } from "@/components/email-verification-modal"

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [showVerificationModal, setShowVerificationModal] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    // Check if user needs email verification
    if (user && user.emailVerified === false) {
      setShowVerificationModal(true)
    }
  }, [user, isLoading, router])

  if (!isLoading && !user) {
    return null
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const renderDashboard = () => {
    if (!user) return null
    switch (user.role) {
      case "Receptionist":
        return <ReceptionistDashboard />
      case "Doctor":
        return <DoctorDashboard />
      case "Midwife":
        return <MidwifeDashboard />
      case "Dentist":
        return <DentistDashboard />
      case "Clinician":
        return <DoctorDashboard />
      case "Radiologist":
        return <RadiologistDashboard />
      case "Nurse":
        return <NurseDashboard />
      case "Lab Tech":
        return <LabTechDashboard />
      case "Hospital Admin":
        return <AdminDashboard />
      case "Cashier":
        return <CashierDashboard />
      case "Pharmacist":
        return <PharmacistDashboard />
      default:
        return <div>Invalid role: {user.role}</div>
    }
  }

  return (
    <>
      {user && (
        <EmailVerificationModal
          isOpen={showVerificationModal}
          userName={user.name}
          userEmail={user.email}
        />
      )}
      <DashboardLayout>{renderDashboard()}</DashboardLayout>
    </>
  )
}
