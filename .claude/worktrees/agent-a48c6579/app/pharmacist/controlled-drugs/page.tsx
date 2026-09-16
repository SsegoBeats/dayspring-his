"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ControlledDrugsRegister } from "@/components/pharmacy/controlled-drugs-register"

export default function ControlledDrugsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "Pharmacist" && user.role !== "Hospital Admin") {
      router.push("/dashboard")
    }
  }, [user, isLoading, router])

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-in fade-in-0 duration-300">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  if (user.role !== "Pharmacist" && user.role !== "Hospital Admin") {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Controlled Drugs Register</h1>
            <p className="text-sm text-muted-foreground">
              NDA-mandated register — Schedule I / II / III substances
            </p>
          </div>
        </div>
        <ControlledDrugsRegister />
      </div>
    </DashboardLayout>
  )
}
