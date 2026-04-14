"use client"
import { useState, useEffect } from "react"
import type { Patient } from "@/lib/patient-context"
import type { User } from "@/lib/auth-context"
import { useLab } from "@/lib/lab-context"
import type { LabTest } from "@/lib/lab-context"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrderLabTest } from "@/components/doctor/order-lab-test"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LabsTabProps {
  patient: Patient
  user: User
  labStream: EventSource | null
}

interface LabRow extends Omit<LabTest, 'status'> {
  status: string
  orderedDate?: string | null
  completedDate?: string | null
  orderedBy?: string | null
  pdfUrl?: string | null
  is_critical?: boolean
}

export function LabsTab({ patient, user: _user, labStream }: LabsTabProps) {
  const { tests, refresh } = useLab()
  const labResults = tests
    .filter((t) => t.patientId === patient.id)
    .map((t) => t as LabRow)
  const [orderOpen, setOrderOpen] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  // SSE live updates
  useEffect(() => {
    if (!labStream) return
    const handler = (_e: MessageEvent) => {
      refresh()
    }
    labStream.addEventListener("message", handler)
    return () => labStream.removeEventListener("message", handler)
  }, [labStream, refresh])

  const handleMarkReviewed = async (id: string) => {
    setReviewing(id)
    try {
      const res = await fetch(`/api/lab-tests/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: true }),
      })
      if (!res.ok) throw new Error("Failed to mark reviewed")
      toast.success("Result marked as reviewed.")
      await refresh()
    } catch {
      toast.error("Failed to update lab result.")
    } finally {
      setReviewing(null)
    }
  }

  const statusBadgeCls = (status: string) => {
    if (status === "Reviewed") return "bg-teal-100 text-teal-800"
    if (status === "Completed") return "bg-emerald-100 text-emerald-800"
    return "bg-amber-100 text-amber-800"
  }

  const selectedLab = labResults.find((l) => l.id === selectedLabId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Lab Results</p>
        <Button
          size="sm"
          className="bg-violet-600 text-white hover:bg-violet-700"
          onClick={() => setOrderOpen(true)}
        >
          Order Lab Test
        </Button>
      </div>

      {labResults.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <FlaskConical className="h-8 w-8 text-violet-300" />
          <p className="text-sm text-slate-500">No lab results for this patient yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-violet-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Test</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Ordered</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Result</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-violet-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labResults.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "cursor-pointer",
                    row.is_critical ? "bg-rose-50 border-l-[3px] border-rose-500" : "",
                  )}
                  onClick={() => setSelectedLabId(row.id)}
                >
                  <TableCell className="font-medium text-slate-900">
                    {row.testName || row.testType || "—"}
                    {row.is_critical && (
                      <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Critical</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {row.orderedAt ? new Date(row.orderedAt).toLocaleDateString() : (row.orderedDate ?? "—")}
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusBadgeCls(row.status))}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {row.results ?? "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {row.status !== "Reviewed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewing === row.id}
                          onClick={() => handleMarkReviewed(row.id)}
                          className="border-teal-400 text-teal-700 hover:bg-teal-50"
                        >
                          {reviewing === row.id ? "…" : "Mark Reviewed"}
                        </Button>
                      )}
                      {row.pdfUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-violet-400 text-violet-700 hover:bg-violet-50"
                          aria-label={`View PDF for ${row.testName}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(row.pdfUrl!, "_blank")
                          }}
                        >
                          PDF
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Order Lab Test dialog */}
      <OrderLabTest
        open={orderOpen}
        onOpenChange={setOrderOpen}
        patientId={patient.id}
      />

      {/* Result detail dialog */}
      <Dialog open={!!selectedLabId} onOpenChange={(o) => { if (!o) setSelectedLabId(null) }}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>Lab Result Details</DialogTitle>
            <DialogDescription>Full result, status, and notes for this test.</DialogDescription>
          </DialogHeader>
          {selectedLab && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div><span className="text-slate-500">Test:</span> <span>{selectedLab.testName || selectedLab.testType}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="capitalize">{selectedLab.status}</span></div>
                <div><span className="text-slate-500">Ordered by:</span> <span>{selectedLab.doctorName || selectedLab.orderedBy || "—"}</span></div>
                <div><span className="text-slate-500">Ordered:</span> <span>{selectedLab.orderedAt ? new Date(selectedLab.orderedAt).toLocaleString() : (selectedLab.orderedDate ?? "—")}</span></div>
                {(selectedLab.completedAt || selectedLab.completedDate) && (
                  <div><span className="text-slate-500">Completed:</span> <span>{selectedLab.completedAt ? new Date(selectedLab.completedAt).toLocaleString() : selectedLab.completedDate}</span></div>
                )}
              </div>
              {selectedLab.results && (
                <div>
                  <div className="mb-1 font-medium">Results</div>
                  <div className="rounded border bg-slate-50 p-3 whitespace-pre-wrap">{selectedLab.results}</div>
                </div>
              )}
              {selectedLab.notes && (
                <div>
                  <div className="mb-1 font-medium">Notes</div>
                  <div className="rounded border bg-slate-50 p-3 whitespace-pre-wrap">{selectedLab.notes}</div>
                </div>
              )}
              <div className="text-right">
                <Button onClick={() => setSelectedLabId(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
