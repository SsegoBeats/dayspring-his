"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PatientWorkflowBoard } from "@/components/workflow/patient-workflow-board"
import { useAuth } from "@/lib/auth-context"

export default function WorkflowPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) router.push("/")
  }, [isLoading, router, user])

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>
  }

  return (
    <DashboardLayout>
      <PatientWorkflowBoard />
    </DashboardLayout>
  )
}
