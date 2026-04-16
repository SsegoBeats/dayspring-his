"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Printer, FileText, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Summary {
  id: string
  patient_name: string
  patient_number: string
  visit_type: "avs" | "discharge"
  generated_at: string
  status: string
  doctor_name: string | null
}

export default function PrintQueuePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.push("/"); return }
    const role = (user.role || "").toLowerCase()
    if (role !== "hospital admin" && role !== "admin") { router.replace("/dashboard"); return }
    void loadSummaries()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading])

  const loadSummaries = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/exports/patient-summary?status=pending_print", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load print queue")
      const data = await res.json()
      setSummaries(data.summaries ?? [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load print queue"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const openPDF = (summaryId: string) => {
    window.open(`/api/exports/patient-summary/${summaryId}`, "_blank")
  }

  const markPrinted = async (summaryId: string) => {
    try {
      setMarkingId(summaryId)
      const res = await fetch(`/api/exports/patient-summary/${summaryId}/print`, {
        method: "PATCH",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to mark as printed")
      }
      toast.success("Marked as printed")
      setSummaries((prev) => prev.filter((s) => s.id !== summaryId))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to mark as printed"
      toast.error(msg)
    } finally {
      setMarkingId(null)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const role = (user.role || "").toLowerCase()
  if (role !== "hospital admin" && role !== "admin") return null

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Print Queue</h1>
          <Button variant="outline" size="sm" onClick={loadSummaries} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Pending Summaries ({summaries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : summaries.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No summaries pending print.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.patient_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{s.patient_number}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.visit_type === "discharge" ? "destructive" : "secondary"}>
                          {s.visit_type === "avs" ? "After-Visit" : "Discharge"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(s.generated_at).toLocaleString("en-UG", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{s.doctor_name ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPDF(s.id)}>
                            <FileText className="mr-1.5 h-3 w-3" />
                            View PDF
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => markPrinted(s.id)}
                            disabled={markingId === s.id}
                          >
                            {markingId === s.id ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1.5 h-3 w-3" />
                            )}
                            Mark Printed
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
