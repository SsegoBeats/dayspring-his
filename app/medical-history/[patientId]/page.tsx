"use client"

import { useEffect } from "react"
import { PatientTimeline } from "@/components/medical/patient-timeline"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function MedicalHistoryPage() {
  const router = useRouter()
  const params = useParams() as { patientId: string }
  const patientId = params.patientId
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

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
