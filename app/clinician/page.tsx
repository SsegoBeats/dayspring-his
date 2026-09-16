"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { DoctorDashboard } from "@/components/dashboards/doctor-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Download, FileText, TableIcon } from "lucide-react"
import { EmailVerificationModal } from "@/components/email-verification-modal"
import { DashboardLayout } from "@/components/dashboard-layout"

const CLINICIAN_ROLES = ["Clinician", "Dentist", "Midwife", "Hospital Admin"]

export default function ClinicianPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const todayStr = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(todayStr)
  const [to, setTo] = useState(todayStr)
  const [exportMineOnly, setExportMineOnly] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user && !CLINICIAN_ROLES.includes(user.role)) {
      router.replace("/dashboard")
    }
  }, [user, isLoading, router])

  async function handleExport(dataset: "medical_records" | "prescriptions", format: "csv" | "xlsx" | "pdf") {
    setExporting(`${dataset}-${format}`)
    try {
      const res = await fetch("/api/exports/direct", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          format,
          filters: {
            from: from ? `${from}T00:00:00.000Z` : undefined,
            to: to ? `${to}T23:59:59.999Z` : undefined,
            recordedByUserId: exportMineOnly || undefined,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { error?: string })?.error ?? "Export failed")
        return
      }
      const blob = await res.blob()
      const ext = format === "xlsx" ? "xlsx" : format === "pdf" ? "pdf" : "csv"
      const label = dataset === "medical_records" ? "medical-records" : "prescriptions"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${label}-${from}-to-${to}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Export downloaded")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(null)
    }
  }

  if (isLoading || !user) return null

  return (
    <DashboardLayout>
      <EmailVerificationModal
        isOpen={user.emailVerified === false}
        userName={user.name}
        userEmail={user.email}
      />
    <div className="space-y-6">
      <DoctorDashboard />

      <div className="mx-auto max-w-6xl px-4 pb-8">
        <Card className="border border-teal-100 shadow-sm">
          <CardHeader className="border-b border-teal-50 bg-teal-50/40 pb-4">
            <CardTitle className="flex items-center gap-2 text-teal-900">
              <Download className="h-5 w-5" />
              Export Records
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="expFrom" className="text-teal-700">From</Label>
                <Input id="expFrom" name="exportFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="expTo" className="text-teal-700">To</Label>
                <Input id="expTo" name="exportTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 pb-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportMineOnly}
                  onChange={(e) => setExportMineOnly(e.target.checked)}
                  className="rounded border-teal-300 accent-teal-700"
                />
                My records only
              </label>
            </div>

            <Separator className="bg-teal-100" />

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <FileText className="h-4 w-4 text-teal-600" />
                Medical Records
              </p>
              <div className="flex flex-wrap gap-2">
                {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    disabled={!!exporting}
                    onClick={() => handleExport("medical_records", fmt)}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    {exporting === `medical_records-${fmt}` ? "Exporting…" : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <TableIcon className="h-4 w-4 text-teal-600" />
                Prescriptions
              </p>
              <div className="flex flex-wrap gap-2">
                {(["csv", "xlsx", "pdf"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    disabled={!!exporting}
                    onClick={() => handleExport("prescriptions", fmt)}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    {exporting === `prescriptions-${fmt}` ? "Exporting…" : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  )
}
