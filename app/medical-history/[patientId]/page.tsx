"use client"

import { PatientTimeline } from "@/components/medical/patient-timeline"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function MedicalHistoryPage({ params }: { params: { patientId: string } }) {
  const { patientId } = params
  const router = useRouter()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <PatientTimeline patientId={patientId} />
    </div>
  )
}
