"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Stethoscope, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface Procedure {
  id: string
  procedure_name: string
  procedure_type: string
  status: string
  ordered_at: string
  completed_at?: string
  ordered_by_name?: string
  completed_by_name?: string
  notes?: string
  procedure_date?: string | null
  procedure_time?: string | null
  performed_by_name?: string | null
  performer_name?: string | null
  reason_indication?: string | null
  findings?: string | null
  procedure_notes?: string | null
  outcome?: string | null
  follow_up_instructions?: string | null
  is_other_procedure?: boolean
  other_procedure_name?: string | null
}

interface ProceduresViewProps {
  patientId: string
}

export function ProceduresView({ patientId }: ProceduresViewProps) {
  const { user } = useAuth()
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [loading, setLoading] = useState(true)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null)
  const [completionForm, setCompletionForm] = useState({
    procedureDate: "",
    procedureTime: "",
    performedBy: "",
    reasonIndication: "",
    findings: "",
    procedureNotes: "",
    outcome: "",
    followUpInstructions: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const openCompletionForm = (procedure: Procedure) => {
    const now = new Date()
    setSelectedProcedure(procedure)
    setCompletionForm({
      procedureDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      procedureTime: now.toTimeString().slice(0, 5),
      performedBy: user?.name || "",
      reasonIndication: procedure.reason_indication || "",
      findings: procedure.findings || "",
      procedureNotes: procedure.procedure_notes || procedure.notes || "",
      outcome: procedure.outcome || "",
      followUpInstructions: procedure.follow_up_instructions || "",
    })
    setCompleteDialogOpen(true)
  }

  const loadProcedures = async () => {
    try {
      setLoading(true)
      const qs = new URLSearchParams({ patientId })
      if (user?.facilityId) qs.set('facilityId', user.facilityId)
      const res = await fetch(`/api/procedures?${qs.toString()}`, { credentials: 'include' })

      if (!res.ok) throw new Error('Failed to load procedures')
      const data = await res.json()
      setProcedures(data.procedures || [])
    } catch (error) {
      console.error('Failed to load procedures:', error)
      toast.error('Failed to load procedures')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (patientId) void loadProcedures()
  }, [patientId])

  const handleComplete = async () => {
    if (!selectedProcedure) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/procedures', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          procedureId: selectedProcedure.id,
          procedureDate: completionForm.procedureDate,
          procedureTime: completionForm.procedureTime,
          performedBy: completionForm.performedBy.trim(),
          reasonIndication: completionForm.reasonIndication.trim(),
          findings: completionForm.findings.trim(),
          procedureNotes: completionForm.procedureNotes.trim(),
          outcome: completionForm.outcome.trim(),
          followUpInstructions: completionForm.followUpInstructions.trim(),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to mark procedure as completed')
      }

      toast.success('Procedure marked as completed')
      setCompleteDialogOpen(false)
      setSelectedProcedure(null)
      await loadProcedures()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to complete procedure')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>
      case 'ordered':
        return <Badge variant="secondary">Ordered</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading procedures...</p>
  }

  if (procedures.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            No procedures ordered for this patient.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Procedure</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Ordered</TableHead>
            <TableHead>Ordered By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {procedures.map((proc) => (
            <TableRow key={proc.id}>
              <TableCell className="font-medium">
                <div>{proc.procedure_name}</div>
                {proc.reason_indication && <p className="mt-1 text-xs text-muted-foreground">Indication: {proc.reason_indication}</p>}
                {proc.procedure_notes && <p className="mt-1 text-xs text-muted-foreground">Instructions: {proc.procedure_notes}</p>}
                {proc.findings && <p className="mt-1 text-xs text-muted-foreground">Findings: {proc.findings}</p>}
                {proc.outcome && <p className="mt-1 text-xs text-muted-foreground">Outcome: {proc.outcome}</p>}
                {proc.follow_up_instructions && <p className="mt-1 text-xs text-muted-foreground">Follow-up: {proc.follow_up_instructions}</p>}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{proc.procedure_type}</TableCell>
              <TableCell className="text-sm">
                {new Date(proc.ordered_at).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm">{proc.ordered_by_name || '—'}</TableCell>
              <TableCell>{getStatusBadge(proc.status)}</TableCell>
              <TableCell>
                {proc.status === 'ordered' && (
                  <Dialog open={completeDialogOpen && selectedProcedure?.id === proc.id} onOpenChange={(open) => {
                    setCompleteDialogOpen(open)
                    if (!open) setSelectedProcedure(null)
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCompletionForm(proc)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Document & Complete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Complete Procedure</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <p className="text-sm font-medium">Procedure: {proc.procedure_name}</p>
                          <p className="text-xs text-muted-foreground">Type: {proc.procedure_type}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label htmlFor="procedure-date">Date performed</Label>
                            <Input id="procedure-date" type="date" value={completionForm.procedureDate}
                              onChange={(e) => setCompletionForm((form) => ({ ...form, procedureDate: e.target.value }))} required />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="procedure-time">Time performed</Label>
                            <Input id="procedure-time" type="time" value={completionForm.procedureTime}
                              onChange={(e) => setCompletionForm((form) => ({ ...form, procedureTime: e.target.value }))} required />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label htmlFor="procedure-performer">Person who performed it</Label>
                            <Input id="procedure-performer" value={completionForm.performedBy}
                              onChange={(e) => setCompletionForm((form) => ({ ...form, performedBy: e.target.value }))} required />
                          </div>
                        </div>
                        {([
                          ["reasonIndication", "Reason / indication", "Clinical reason for the procedure"],
                          ["findings", "Findings", "Findings during or after the procedure"],
                          ["procedureNotes", "Procedure notes", "Technique, steps, or relevant observations"],
                          ["outcome", "Outcome", "Immediate result or response"],
                          ["followUpInstructions", "Follow-up instructions", "Aftercare and follow-up plan"],
                        ] as const).map(([field, label, placeholder]) => (
                          <div key={field} className="space-y-1">
                            <Label htmlFor={`procedure-${field}`}>{label}</Label>
                            <Textarea id={`procedure-${field}`} value={completionForm[field]}
                              onChange={(e) => setCompletionForm((form) => ({ ...form, [field]: e.target.value }))}
                              placeholder={placeholder} />
                          </div>
                        ))}
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleComplete} disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Procedure Record'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
                {proc.status === 'completed' && proc.completed_at && (
                  <div className="text-xs text-muted-foreground">
                    <p>Completed: {new Date(proc.completed_at).toLocaleString()}</p>
                    {proc.completed_by_name && <p>By: {proc.completed_by_name}</p>}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
