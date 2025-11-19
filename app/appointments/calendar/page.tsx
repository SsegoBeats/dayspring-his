"use client"

import { AppointmentCalendar } from "@/components/appointments/appointment-calendar"
import { PatientProvider } from "@/lib/patient-context"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AppointmentCalendarPage() {
  const router = useRouter()

  return (
    <PatientProvider>
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      <AppointmentCalendar />
    </div>
    </PatientProvider>
  )
}
