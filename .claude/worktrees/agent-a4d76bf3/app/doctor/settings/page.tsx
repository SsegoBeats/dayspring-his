"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DoctorSettingsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/clinician/settings")
  }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to clinician settings...</p>
    </div>
  )
}
